from fastapi import FastAPI, Depends, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import engine, Base, get_db
from .config import settings
from . import models, schemas
from .auth_utils import hash_password, verify_password, generate_session_token, session_expiry
from datetime import datetime

Base.metadata.create_all(bind=engine)

app = FastAPI(title="UserScout API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_current_user(request: Request, db: Session = Depends(get_db)) -> models.User:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = db.query(models.Session).filter(models.Session.token == token).first()
    if not session or session.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Session expired")
    user = db.query(models.User).filter(models.User.id == session.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@app.post("/api/auth/register")
async def register(body: schemas.UserCreate, response: Response, db: Session = Depends(get_db)):
    username = body.username.strip().lower()
    if len(username) < 3 or len(username) > 24:
        raise HTTPException(status_code=422, detail="Username must be 3-24 characters")
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    existing = db.query(models.User).filter(models.User.username == username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    user = models.User(username=username, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = generate_session_token()
    session = models.Session(user_id=user.id, token=token, expires_at=session_expiry())
    db.add(session)
    db.commit()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.environment == "production",
        max_age=30*24*3600,
    )
    return {"user": {"id": user.id, "username": user.username, "created_at": user.created_at}}

@app.post("/api/auth/login")
async def login(body: schemas.UserLogin, response: Response, db: Session = Depends(get_db)):
    username = body.username.strip().lower()
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = generate_session_token()
    session = models.Session(user_id=user.id, token=token, expires_at=session_expiry())
    db.add(session)
    db.commit()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.environment == "production",
        max_age=30*24*3600,
    )
    return {"user": {"id": user.id, "username": user.username, "created_at": user.created_at}}

@app.post("/api/auth/logout")
async def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        db.query(models.Session).filter(models.Session.token == token).delete()
        db.commit()
    response.delete_cookie(settings.session_cookie_name)
    return {"ok": True}

@app.get("/api/auth/me")
async def me(user: models.User = Depends(get_current_user)):
    return {"user": {"id": user.id, "username": user.username, "created_at": user.created_at}}

@app.get("/api/projects")
async def list_projects(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    projects = db.query(models.Project).filter(models.Project.owner_id == user.id).order_by(models.Project.created_at.desc()).all()
    return {"projects": [p.__dict__ for p in projects]}

@app.post("/api/projects")
async def create_project(body: schemas.ProjectCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = body.profile
    project = models.Project(
        owner_id=user.id,
        full_name=profile.get("fullName", ""),
        description=profile.get("description", ""),
        url=profile.get("url", ""),
        homepage=profile.get("homepage", ""),
        primary_language=profile.get("primaryLanguage", ""),
        languages=profile.get("languages", {}),
        topics=profile.get("topics", []),
        stars=profile.get("stars", 0),
        forks=profile.get("forks", 0),
        open_issues=profile.get("openIssues", 0),
        license=profile.get("license", ""),
        readme_excerpt=profile.get("readmeExcerpt", ""),
        keywords=profile.get("keywords", []),
        problem_space=profile.get("problemSpace", []),
        audience=profile.get("audience", []),
        query_terms=profile.get("queryTerms", []),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return {"project": project.__dict__}

@app.get("/api/prospects")
async def list_prospects(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    prospects = db.query(models.Prospect).filter(models.Prospect.owner_id == user.id).all()
    return {"prospects": [p.__dict__ for p in prospects]}

@app.post("/api/prospects")
async def create_prospect(body: schemas.ProspectCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == body.project_id, models.Project.owner_id == user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    prospect = models.Prospect(
        project_id=body.project_id,
        owner_id=user.id,
        login=body.login,
        name=body.name,
        avatar_url=body.avatar_url,
        html_url=body.html_url,
        bio=body.bio,
        score=body.score,
        confidence=body.confidence,
        explanation=body.explanation,
        signals=body.signals,
        sources=body.sources,
        contact_channels=body.contact_channels,
        context=body.context,
        caution_signals=body.caution_signals,
        last_activity_at=body.last_activity_at,
        recommended_action=body.recommended_action,
    )
    db.add(prospect)
    db.commit()
    db.refresh(prospect)
    return {"prospect": prospect.__dict__}

@app.get("/api/health")
async def health():
    return {"status": "ok", "database": "connected"}

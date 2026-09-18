from fastapi import FastAPI, Depends, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import engine, Base, get_db
from .config import settings
from . import models, schemas
from .auth_utils import hash_password, verify_password, generate_session_token, session_expiry
from .enrichment import enrich_from_github_profile
from .migrations_util import ensure_columns
from datetime import datetime

Base.metadata.create_all(bind=engine)
ensure_columns(engine)

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



@app.post("/api/prospects/{prospect_id}/enrich-contacts")
async def enrich_prospect_contacts(prospect_id: str, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    prospect = db.query(models.Prospect).filter(models.Prospect.id == prospect_id, models.Prospect.owner_id == user.id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    result = enrich_from_github_profile(prospect.login)

    # Delete existing auto-discovered channels (keep manual ones).
    db.query(models.ContactChannel).filter(
        models.ContactChannel.prospect_id == prospect.id,
        models.ContactChannel.source_type != "manual",
    ).delete(synchronize_session=False)

    created = []
    for ch in result.channels:
        row = models.ContactChannel(
            prospect_id=prospect.id,
            owner_id=user.id,
            type=ch.type,
            value=ch.value,
            url=ch.url,
            source_url=ch.source_url,
            source_type=ch.source_type,
            confidence=ch.confidence,
            is_public=ch.is_public,
            is_verified=ch.is_verified,
        )
        db.add(row)
        created.append(row)
    db.commit()
    for row in created:
        db.refresh(row)

    return {
        "channels": [_serialize_channel(c) for c in created],
        "errors": result.errors,
        "fetched": result.fetched,
    }


@app.get("/api/prospects/{prospect_id}/contact-channels")
async def list_contact_channels(prospect_id: str, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    prospect = db.query(models.Prospect).filter(models.Prospect.id == prospect_id, models.Prospect.owner_id == user.id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    rows = db.query(models.ContactChannel).filter(models.ContactChannel.prospect_id == prospect.id).order_by(models.ContactChannel.confidence.desc()).all()
    return {"channels": [_serialize_channel(c) for c in rows]}


def _serialize_channel(c: models.ContactChannel):
    return {
        "id": c.id,
        "type": c.type,
        "value": c.value,
        "url": c.url,
        "source_url": c.source_url,
        "source_type": c.source_type,
        "confidence": c.confidence,
        "is_public": c.is_public,
        "is_verified": c.is_verified,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }



@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id, models.Project.owner_id == user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Cascade deletion is handled by SQLAlchemy relationships (cascade="all, delete-orphan")
    # for prospects -> contact_channel_rows and events. Delete explicit children first for safety
    # in case any were created without a proper relationship.
    db.query(models.ContactChannel).filter(
        models.ContactChannel.prospect_id.in_(
            db.query(models.Prospect.id).filter(models.Prospect.project_id == project_id)
        )
    ).delete(synchronize_session=False)
    db.query(models.OutreachMessage).filter(models.OutreachMessage.prospect_id.in_(
        db.query(models.Prospect.id).filter(models.Prospect.project_id == project_id)
    )).delete(synchronize_session=False)
    db.query(models.OutreachEvent).filter(models.OutreachEvent.project_id == project_id).delete(synchronize_session=False)
    db.query(models.Feedback).filter(models.Feedback.project_id == project_id).delete(synchronize_session=False)
    db.query(models.Prospect).filter(models.Prospect.project_id == project_id).delete(synchronize_session=False)
    db.delete(project)
    db.commit()
    return {"ok": True, "deleted": project_id}


@app.delete("/api/prospects/{prospect_id}")
async def delete_prospect(prospect_id: str, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    prospect = db.query(models.Prospect).filter(models.Prospect.id == prospect_id, models.Prospect.owner_id == user.id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    db.query(models.ContactChannel).filter(models.ContactChannel.prospect_id == prospect_id).delete(synchronize_session=False)
    db.query(models.OutreachMessage).filter(models.OutreachMessage.prospect_id == prospect_id).delete(synchronize_session=False)
    db.query(models.OutreachEvent).filter(models.OutreachEvent.prospect_id == prospect_id).delete(synchronize_session=False)
    db.query(models.Feedback).filter(models.Feedback.prospect_id == prospect_id).delete(synchronize_session=False)
    db.delete(prospect)
    db.commit()
    return {"ok": True, "deleted": prospect_id}


@app.patch("/api/prospects/{prospect_id}/archive")
async def archive_prospect(prospect_id: str, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    prospect = db.query(models.Prospect).filter(models.Prospect.id == prospect_id, models.Prospect.owner_id == user.id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    prospect.archived = True
    db.commit()
    db.refresh(prospect)
    return {"prospect": prospect.__dict__}


@app.patch("/api/prospects/{prospect_id}/unarchive")
async def unarchive_prospect(prospect_id: str, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    prospect = db.query(models.Prospect).filter(models.Prospect.id == prospect_id, models.Prospect.owner_id == user.id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    prospect.archived = False
    db.commit()
    db.refresh(prospect)
    return {"prospect": prospect.__dict__}



@app.patch("/api/prospects/{prospect_id}/status")
async def update_prospect_status(prospect_id: str, body: dict, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    prospect = db.query(models.Prospect).filter(models.Prospect.id == prospect_id, models.Prospect.owner_id == user.id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    status = body.get("status", prospect.status)
    channel = body.get("channel", prospect.contact_channel)
    prospect.status = status
    prospect.contact_channel = channel
    if status == "contacted":
        prospect.contacted_at = datetime.utcnow()
    elif status == "replied":
        prospect.replied_at = datetime.utcnow()
    elif status == "user":
        prospect.converted_at = datetime.utcnow()
    db.commit()
    db.refresh(prospect)
    return {"prospect": prospect.__dict__}


@app.post("/api/outreach")
async def add_outreach_event(body: dict, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    prospect_id = body.get("prospect_id")
    prospect = db.query(models.Prospect).filter(models.Prospect.id == prospect_id, models.Prospect.owner_id == user.id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    event = models.OutreachEvent(
        prospect_id=prospect.id,
        project_id=prospect.project_id,
        owner_id=user.id,
        type=body.get("type", "note"),
        message=body.get("message", ""),
        channel=body.get("channel"),
        to_status=body.get("to_status"),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return {"event": event.__dict__}


@app.post("/api/feedback")
async def add_feedback(body: dict, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    prospect_id = body.get("prospect_id")
    prospect = db.query(models.Prospect).filter(models.Prospect.id == prospect_id, models.Prospect.owner_id == user.id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    existing = db.query(models.Feedback).filter(models.Feedback.prospect_id == prospect.id).first()
    if existing:
        existing.rating = int(body.get("rating", existing.rating))
        existing.useful = body.get("useful", existing.useful)
        existing.confusing = body.get("confusing", existing.confusing)
        existing.improve = body.get("improve", existing.improve)
        existing.would_use_again = body.get("wouldUseAgain", existing.would_use_again)
        existing.notes = body.get("notes", existing.notes)
        fb = existing
    else:
        fb = models.Feedback(
            prospect_id=prospect.id,
            project_id=prospect.project_id,
            owner_id=user.id,
            rating=int(body.get("rating", 0)),
            useful=body.get("useful", ""),
            confusing=body.get("confusing", ""),
            improve=body.get("improve", ""),
            would_use_again=body.get("wouldUseAgain", "maybe"),
            notes=body.get("notes", ""),
        )
        db.add(fb)
    db.commit()
    db.refresh(fb)
    return {"feedback": fb.__dict__}

@app.get("/api/health")
async def health():
    return {"status": "ok", "database": "connected"}

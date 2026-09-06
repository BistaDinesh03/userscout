from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, JSON, Float
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from .database import Base
import uuid

def generate_id():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=generate_id)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")

class Session(Base):
    __tablename__ = "sessions"
    id = Column(String, primary_key=True, default=generate_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True, default=generate_id)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    full_name = Column(String, nullable=False)
    description = Column(Text, default="")
    url = Column(String, default="")
    homepage = Column(String, default="")
    primary_language = Column(String, default="")
    languages = Column(JSON, default=dict)
    topics = Column(JSON, default=list)
    stars = Column(Integer, default=0)
    forks = Column(Integer, default=0)
    open_issues = Column(Integer, default=0)
    license = Column(String, default="")
    readme_excerpt = Column(Text, default="")
    keywords = Column(JSON, default=list)
    problem_space = Column(JSON, default=list)
    audience = Column(JSON, default=list)
    query_terms = Column(JSON, default=list)
    discoverable = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_discovery_at = Column(DateTime, nullable=True)
    owner = relationship("User", back_populates="projects")
    prospects = relationship("Prospect", back_populates="project", cascade="all, delete-orphan")

class Prospect(Base):
    __tablename__ = "prospects"
    id = Column(String, primary_key=True, default=generate_id)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    login = Column(String, nullable=False, index=True)
    name = Column(String, default="")
    avatar_url = Column(String, default="")
    html_url = Column(String, default="")
    bio = Column(Text, default="")
    score = Column(Float, default=0)
    confidence = Column(String, default="low")
    explanation = Column(Text, default="")
    signals = Column(JSON, default=list)
    sources = Column(JSON, default=list)
    status = Column(String, default="saved", index=True)
    contacted_at = Column(DateTime, nullable=True)
    contact_channel = Column(String, nullable=True)
    replied_at = Column(DateTime, nullable=True)
    converted_at = Column(DateTime, nullable=True)
    archived = Column(Boolean, default=False)
    contact_channels = Column(JSON, default=list)
    context = Column(JSON, default=dict)
    caution_signals = Column(JSON, default=list)
    last_activity_at = Column(DateTime, nullable=True)
    recommended_action = Column(String, default="")
    first_seen_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("Project", back_populates="prospects")
    events = relationship("OutreachEvent", back_populates="prospect", cascade="all, delete-orphan")

class OutreachEvent(Base):
    __tablename__ = "outreach_events"
    id = Column(String, primary_key=True, default=generate_id)
    prospect_id = Column(String, ForeignKey("prospects.id"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)
    message = Column(Text, default="")
    channel = Column(String, nullable=True)
    from_status = Column(String, nullable=True)
    to_status = Column(String, nullable=True)
    at = Column(DateTime, default=datetime.utcnow)
    prospect = relationship("Prospect", back_populates="events")

class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(String, primary_key=True, default=generate_id)
    prospect_id = Column(String, ForeignKey("prospects.id"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, default=0)
    useful = Column(Text, default="")
    confusing = Column(Text, default="")
    improve = Column(Text, default="")
    would_use_again = Column(String, default="maybe")
    notes = Column(Text, default="")
    at = Column(DateTime, default=datetime.utcnow)

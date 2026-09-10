from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    created_at: datetime

class ProjectCreate(BaseModel):
    profile: Dict[str, Any]

class ProjectResponse(BaseModel):
    id: str
    owner_id: str
    profile: Dict[str, Any]
    discoverable: bool
    created_at: datetime
    updated_at: datetime
    last_discovery_at: Optional[datetime]

class ProspectCreate(BaseModel):
    project_id: str
    login: str
    name: str = ""
    avatar_url: str = ""
    html_url: str = ""
    bio: str = ""
    score: float = 0
    confidence: str = "low"
    explanation: str = ""
    signals: List[Dict[str, Any]] = []
    sources: List[str] = []
    contact_channels: List[Dict[str, Any]] = []
    context: Dict[str, Any] = {}
    caution_signals: List[Dict[str, Any]] = []
    last_activity_at: Optional[datetime] = None
    recommended_action: str = ""

class OutreachEventCreate(BaseModel):
    prospect_id: str
    type: str
    message: str = ""
    channel: Optional[str] = None
    to_status: Optional[str] = None

class FeedbackCreate(BaseModel):
    prospect_id: str
    rating: int
    useful: str = ""
    confusing: str = ""
    improve: str = ""
    would_use_again: str = "maybe"
    notes: str = ""

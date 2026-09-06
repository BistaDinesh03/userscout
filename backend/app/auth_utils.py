from passlib.context import CryptContext
from datetime import datetime, timedelta
import secrets
from .config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

SESSION_TTL_HOURS = 720  # 30 days

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def generate_session_token() -> str:
    return secrets.token_urlsafe(32)

def session_expiry() -> datetime:
    return datetime.utcnow() + timedelta(hours=SESSION_TTL_HOURS)

from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    database_url: str = "sqlite:///./data/userscout.db"
    secret_key: str = "dev-secret-key-change-in-production"
    environment: str = "development"
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    session_cookie_name: str = "userscout_session"

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"

settings = Settings()

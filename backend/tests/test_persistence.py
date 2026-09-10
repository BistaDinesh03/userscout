from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, get_db
from app.main import app

# Use file-based SQLite for persistence test
TEST_DB_PATH = "data/test_userscout.db"
if os.path.exists(TEST_DB_PATH):
    os.remove(TEST_DB_PATH)

engine = create_engine(
    f"sqlite:///{TEST_DB_PATH}",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def test_register_login_logout():
    # Register
    r = client.post("/api/auth/register", json={"username": "testuser", "password": "password123"})
    assert r.status_code == 200
    assert "user" in r.json()
    
    # Logout
    r = client.post("/api/auth/logout")
    assert r.status_code == 200
    
    # Login
    r = client.post("/api/auth/login", json={"username": "testuser", "password": "password123"})
    assert r.status_code == 200
    assert r.json()["user"]["username"] == "testuser"

def test_persistence_across_sessions():
    # Login
    client.post("/api/auth/login", json={"username": "testuser", "password": "password123"})
    
    # Create project
    project_data = {
        "profile": {
            "fullName": "owner/testrepo",
            "description": "Test repo",
            "url": "https://github.com/owner/testrepo",
            "homepage": "",
            "primaryLanguage": "Python",
            "languages": {"Python": 100},
            "topics": ["testing"],
            "stars": 0,
            "forks": 0,
            "openIssues": 0,
            "license": "MIT",
            "readmeExcerpt": "",
            "keywords": ["test"],
            "problemSpace": ["testing"],
            "audience": ["developers"],
            "queryTerms": ["test"],
        }
    }
    r = client.post("/api/projects", json=project_data)
    assert r.status_code == 200
    project_id = r.json()["project"]["id"]
    
    # Logout
    client.post("/api/auth/logout")
    
    # Login again (simulates restart)
    client.post("/api/auth/login", json={"username": "testuser", "password": "password123"})
    
    # Fetch projects - should still exist
    r = client.get("/api/projects")
    assert r.status_code == 200
    projects = r.json()["projects"]
    assert len(projects) == 1
    assert projects[0]["id"] == project_id

def test_authorization():
    # Register second user
    client.post("/api/auth/register", json={"username": "testuser2", "password": "password123"})
    
    # Try to access first user's projects (should fail or return empty)
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"username": "testuser2", "password": "password123"})
    r = client.get("/api/projects")
    assert r.status_code == 200
    assert len(r.json()["projects"]) == 0  # Empty, not other user's data

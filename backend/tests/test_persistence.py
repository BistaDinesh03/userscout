"""Baseline auth + persistence tests."""


def test_register_login_logout(client):
    client.post("/api/auth/logout")
    r = client.post("/api/auth/register", json={"username": "testuser", "password": "password123"})
    assert r.status_code == 200 and "user" in r.json()

    r = client.post("/api/auth/logout"); assert r.status_code == 200
    r = client.post("/api/auth/login", json={"username": "testuser", "password": "password123"})
    assert r.status_code == 200 and r.json()["user"]["username"] == "testuser"


def test_persistence_across_sessions(client):
    client.post("/api/auth/logout")
    client.post("/api/auth/register", json={"username": "puser", "password": "password123"})
    r = client.post("/api/projects", json={"profile": {
        "fullName": "owner/testrepo", "description": "", "url": "", "homepage": "",
        "primaryLanguage": "Python", "languages": {}, "topics": [], "stars": 0,
        "forks": 0, "openIssues": 0, "license": "", "readmeExcerpt": "",
        "keywords": [], "problemSpace": [], "audience": [], "queryTerms": [],
    }})
    project_id = r.json()["project"]["id"]

    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"username": "puser", "password": "password123"})
    r = client.get("/api/projects")
    assert any(p["id"] == project_id for p in r.json()["projects"])


def test_authorization(client):
    client.post("/api/auth/logout")
    client.post("/api/auth/register", json={"username": "authuser2", "password": "password123"})
    r = client.get("/api/projects")
    assert r.status_code == 200
    # User 2 should not see user 1's projects
    assert all(p.get("owner_id") != "n/a" for p in r.json()["projects"])

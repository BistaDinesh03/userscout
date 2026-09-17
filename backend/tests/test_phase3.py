"""Phase 3: delete project, delete prospect, archive, ownership."""


def _register(client, name):
    client.post("/api/auth/logout")
    client.post("/api/auth/register", json={"username": name, "password": "password123"})


def _make_project(client, repo):
    r = client.post("/api/projects", json={"profile": {
        "fullName": repo, "description": "", "url": "", "homepage": "",
        "primaryLanguage": "Python", "languages": {}, "topics": [], "stars": 0,
        "forks": 0, "openIssues": 0, "license": "", "readmeExcerpt": "",
        "keywords": [], "problemSpace": [], "audience": [], "queryTerms": [],
    }})
    assert r.status_code == 200
    return r.json()["project"]["id"]


def _make_prospect(client, project_id, login):
    r = client.post("/api/prospects", json={
        "project_id": project_id, "login": login, "name": "", "avatar_url": "",
        "html_url": "", "bio": "", "score": 0, "confidence": "low",
        "explanation": "", "signals": [], "sources": [],
        "contact_channels": [], "context": {}, "caution_signals": [],
    })
    assert r.status_code == 200
    return r.json()["prospect"]["id"]


def test_owner_can_delete_project(client):
    _register(client, "delowner")
    pid = _make_project(client, "a/b")
    r = client.delete(f"/api/projects/{pid}")
    assert r.status_code == 200 and r.json()["ok"] is True
    r = client.get("/api/projects")
    assert all(p["id"] != pid for p in r.json()["projects"])


def test_deleted_project_stays_deleted_after_relogin(client):
    _register(client, "delpersist")
    pid = _make_project(client, "c/d")
    client.delete(f"/api/projects/{pid}")
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"username": "delpersist", "password": "password123"})
    r = client.get("/api/projects")
    assert all(p["id"] != pid for p in r.json()["projects"])


def test_non_owner_cannot_delete_project(client):
    _register(client, "owner1")
    pid = _make_project(client, "e/f")
    _register(client, "attacker")
    r = client.delete(f"/api/projects/{pid}")
    assert r.status_code == 404
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"username": "owner1", "password": "password123"})
    r = client.get("/api/projects")
    assert any(p["id"] == pid for p in r.json()["projects"])


def test_owner_can_delete_prospect(client):
    _register(client, "delpro")
    pid = _make_project(client, "g/h")
    prosp_id = _make_prospect(client, pid, "prospectuser")
    r = client.delete(f"/api/prospects/{prosp_id}")
    assert r.status_code == 200
    r = client.get("/api/prospects")
    assert all(p["id"] != prosp_id for p in r.json()["prospects"])


def test_non_owner_cannot_delete_prospect(client):
    _register(client, "proowner")
    pid = _make_project(client, "i/j")
    prosp_id = _make_prospect(client, pid, "victim")
    _register(client, "proattacker")
    r = client.delete(f"/api/prospects/{prosp_id}")
    assert r.status_code == 404


def test_owner_can_archive_and_unarchive(client):
    _register(client, "arcowner")
    pid = _make_project(client, "k/l")
    prosp_id = _make_prospect(client, pid, "archprospect")
    r = client.patch(f"/api/prospects/{prosp_id}/archive")
    assert r.status_code == 200
    r = client.get("/api/prospects")
    p = next((x for x in r.json()["prospects"] if x["id"] == prosp_id), None)
    assert p is not None and p["archived"] is True
    r = client.patch(f"/api/prospects/{prosp_id}/unarchive")
    assert r.status_code == 200
    r = client.get("/api/prospects")
    p = next((x for x in r.json()["prospects"] if x["id"] == prosp_id), None)
    assert p is not None and p["archived"] is False


def test_delete_project_cascades_children(client):
    _register(client, "casowner")
    pid = _make_project(client, "m/n")
    _make_prospect(client, pid, "child1")
    _make_prospect(client, pid, "child2")
    r = client.delete(f"/api/projects/{pid}")
    assert r.status_code == 200
    r = client.get("/api/prospects")
    assert [p for p in r.json()["prospects"] if p["project_id"] == pid] == []

"""Phase 1 tests: new models + migration persistence."""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app import models

TEST_DB = "data/test_phase1.db"
if os.path.exists(TEST_DB):
    os.remove(TEST_DB)

engine = create_engine(
    f"sqlite:///{TEST_DB}",
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


def _fresh_user(name: str):
    client.post("/api/auth/logout")
    client.post("/api/auth/register", json={"username": name, "password": "password123"})


def test_contact_channel_model_persists():
    _fresh_user("cchuser")
    db = TestingSessionLocal()
    user = db.query(models.User).filter(models.User.username == "cchuser").first()
    project = models.Project(owner_id=user.id, full_name="owner/repo")
    db.add(project)
    db.commit()
    prospect = models.Prospect(project_id=project.id, owner_id=user.id, login="alex")
    db.add(prospect)
    db.commit()
    prospect_id = prospect.id

    ch = models.ContactChannel(
        prospect_id=prospect_id,
        owner_id=user.id,
        type="email",
        value="alex@example.com",
        source_url="https://alex.dev/contact",
        source_type="website-contact",
        confidence="high",
        is_public=True,
        is_verified=False,
    )
    db.add(ch)
    db.commit()
    db.close()

    # New session: verify persistence
    db2 = TestingSessionLocal()
    found = db2.query(models.ContactChannel).filter(models.ContactChannel.prospect_id == prospect_id).all()
    assert len(found) == 1
    assert found[0].value == "alex@example.com"
    assert found[0].source_url == "https://alex.dev/contact"
    assert found[0].confidence == "high"
    db2.close()


def test_outreach_message_model_persists():
    _fresh_user("omuser")
    db = TestingSessionLocal()
    user = db.query(models.User).filter(models.User.username == "omuser").first()
    project = models.Project(owner_id=user.id, full_name="owner/repo")
    db.add(project); db.commit()
    prospect = models.Prospect(project_id=project.id, owner_id=user.id, login="bob")
    db.add(prospect); db.commit()

    msg = models.OutreachMessage(
        user_id=user.id,
        prospect_id=prospect.id,
        recipient="bob@example.com",
        subject="Hi",
        body="Hello",
        direction="outbound",
        status="draft",
    )
    db.add(msg); db.commit()
    msg_id = msg.id
    db.close()

    db2 = TestingSessionLocal()
    found = db2.query(models.OutreachMessage).filter(models.OutreachMessage.id == msg_id).first()
    assert found is not None
    assert found.status == "draft"
    assert found.direction == "outbound"
    db2.close()


def test_email_integration_model_persists():
    _fresh_user("eiuser")
    db = TestingSessionLocal()
    user = db.query(models.User).filter(models.User.username == "eiuser").first()
    integ = models.EmailIntegration(
        user_id=user.id,
        provider="microsoft",
        account_email="user@outlook.com",
        scopes="Mail.Send",
    )
    db.add(integ); db.commit()
    integ_id = integ.id
    db.close()

    db2 = TestingSessionLocal()
    found = db2.query(models.EmailIntegration).filter(models.EmailIntegration.id == integ_id).first()
    assert found is not None
    assert found.provider == "microsoft"
    assert found.access_token_enc is None  # never populated without OAuth
    db2.close()

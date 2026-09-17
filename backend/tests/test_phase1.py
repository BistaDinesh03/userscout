"""Phase 1 tests: new models + migration persistence."""

from app import models


def test_contact_channel_model_persists(client, db_session):
    client.post("/api/auth/logout")
    client.post("/api/auth/register", json={"username": "cchuser", "password": "password123"})

    db = db_session()
    user = db.query(models.User).filter(models.User.username == "cchuser").first()
    assert user is not None, "user must exist in the same DB session used by the API"

    project = models.Project(owner_id=user.id, full_name="owner/repo")
    db.add(project); db.commit()
    prospect = models.Prospect(project_id=project.id, owner_id=user.id, login="alex")
    db.add(prospect); db.commit()
    prospect_id = prospect.id

    ch = models.ContactChannel(
        prospect_id=prospect_id, owner_id=user.id, type="email",
        value="alex@example.com", source_url="https://alex.dev/contact",
        source_type="website-contact", confidence="high",
        is_public=True, is_verified=False,
    )
    db.add(ch); db.commit()
    db.close()

    db2 = db_session()
    found = db2.query(models.ContactChannel).filter(models.ContactChannel.prospect_id == prospect_id).all()
    assert len(found) == 1
    assert found[0].value == "alex@example.com"
    assert found[0].source_url == "https://alex.dev/contact"
    assert found[0].confidence == "high"
    db2.close()


def test_outreach_message_model_persists(client, db_session):
    client.post("/api/auth/logout")
    client.post("/api/auth/register", json={"username": "omuser", "password": "password123"})

    db = db_session()
    user = db.query(models.User).filter(models.User.username == "omuser").first()
    assert user is not None
    project = models.Project(owner_id=user.id, full_name="owner/repo")
    db.add(project); db.commit()
    prospect = models.Prospect(project_id=project.id, owner_id=user.id, login="bob")
    db.add(prospect); db.commit()

    msg = models.OutreachMessage(
        user_id=user.id, prospect_id=prospect.id,
        recipient="bob@example.com", subject="Hi", body="Hello",
        direction="outbound", status="draft",
    )
    db.add(msg); db.commit()
    msg_id = msg.id
    db.close()

    db2 = db_session()
    found = db2.query(models.OutreachMessage).filter(models.OutreachMessage.id == msg_id).first()
    assert found is not None and found.status == "draft" and found.direction == "outbound"
    db2.close()


def test_email_integration_model_persists(client, db_session):
    client.post("/api/auth/logout")
    client.post("/api/auth/register", json={"username": "eiuser", "password": "password123"})

    db = db_session()
    user = db.query(models.User).filter(models.User.username == "eiuser").first()
    assert user is not None
    integ = models.EmailIntegration(
        user_id=user.id, provider="microsoft",
        account_email="user@outlook.com", scopes="Mail.Send",
    )
    db.add(integ); db.commit()
    integ_id = integ.id
    db.close()

    db2 = db_session()
    found = db2.query(models.EmailIntegration).filter(models.EmailIntegration.id == integ_id).first()
    assert found is not None and found.provider == "microsoft"
    assert found.access_token_enc is None
    db2.close()

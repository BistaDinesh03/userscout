"""One-shot cleanup: collapse duplicate prospects by (project_id, owner_id, login),
keeping the most recently updated record."""

import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app import models

def main():
    db = SessionLocal()
    try:
        # Find all duplicate groups
        rows = db.query(models.Prospect).order_by(models.Prospect.updated_at.desc()).all()
        seen = {}
        deleted = 0
        for p in rows:
            key = (p.project_id, p.owner_id, p.login)
            if key in seen:
                # This is a duplicate — move its child rows to the keeper, then delete
                keeper = seen[key]
                db.query(models.ContactChannel).filter(models.ContactChannel.prospect_id == p.id).update({"prospect_id": keeper.id})
                db.query(models.OutreachEvent).filter(models.OutreachEvent.prospect_id == p.id).update({"prospect_id": keeper.id})
                db.query(models.OutreachMessage).filter(models.OutreachMessage.prospect_id == p.id).update({"prospect_id": keeper.id})
                db.query(models.Feedback).filter(models.Feedback.prospect_id == p.id).update({"prospect_id": keeper.id})
                db.delete(p)
                deleted += 1
            else:
                seen[key] = p
        db.commit()
        print(f"Deduplicated {deleted} prospect row(s).")
    finally:
        db.close()

if __name__ == "__main__":
    main()

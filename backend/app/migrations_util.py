"""Lightweight schema migration: add missing columns to existing SQLite DB
without dropping it. Idempotent. Called on startup."""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ensure_columns(engine: Engine) -> None:
    """Add columns that were introduced after the initial schema, if missing."""
    # (table, column_name, sqlite_type_default_clause)
    additions = [
        ("prospects", "evidence_strength", "TEXT"),
        ("prospects", "recency_level", "TEXT"),
        ("prospects", "contactability_level", "TEXT"),
        ("prospects", "confidence_level", "TEXT"),
        ("prospects", "why_this_person", "TEXT DEFAULT ''"),
        ("prospects", "why_now", "TEXT DEFAULT ''"),
    ]
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, column, coltype in additions:
            if table not in existing_tables:
                continue
            existing_cols = {c["name"] for c in inspector.get_columns(table)}
            if column in existing_cols:
                continue
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}"))

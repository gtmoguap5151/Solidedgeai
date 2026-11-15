"""GALINYX OS SQLite schema migrations.

Version 1: core entity runtime and preservation-first legacy task conversion.
Version 2: local human/workspace ownership tables.
"""
from database_migrations import Migration


def _table_exists(db, name):
    return db.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone() is not None


def _core_schema(db):
    db.execute(
        "CREATE TABLE IF NOT EXISTS entities("
        "id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, "
        "capabilities TEXT NOT NULL, created_at TEXT NOT NULL)"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS memories("
        "entity_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, "
        "PRIMARY KEY(entity_id,key), FOREIGN KEY(entity_id) REFERENCES entities(id))"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS events("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, entity_id TEXT NOT NULL, "
        "event_type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, "
        "FOREIGN KEY(entity_id) REFERENCES entities(id))"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS storyworlds("
        "entity_id TEXT NOT NULL, world_key TEXT NOT NULL, canon TEXT NOT NULL, "
        "PRIMARY KEY(entity_id,world_key), FOREIGN KEY(entity_id) REFERENCES entities(id))"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS assets("
        "entity_id TEXT NOT NULL, asset_id TEXT NOT NULL, data TEXT NOT NULL, "
        "PRIMARY KEY(entity_id,asset_id), FOREIGN KEY(entity_id) REFERENCES entities(id))"
    )
    if not _table_exists(db, "tasks"):
        db.execute(
            "CREATE TABLE tasks("
            "request_id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, action TEXT NOT NULL, "
            "payload_hash TEXT, result TEXT NOT NULL, created_at TEXT NOT NULL, "
            "FOREIGN KEY(entity_id) REFERENCES entities(id))"
        )
    else:
        columns = {row[1] for row in db.execute("PRAGMA table_info(tasks)")}
        if "payload_hash" not in columns:
            # Legacy request records are retained. A missing digest cannot be
            # reconstructed, so NULL deliberately prevents safe replay.
            db.execute("ALTER TABLE tasks RENAME TO tasks_legacy_migration")
            db.execute(
                "CREATE TABLE tasks("
                "request_id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, action TEXT NOT NULL, "
                "payload_hash TEXT, result TEXT NOT NULL, created_at TEXT NOT NULL, "
                "FOREIGN KEY(entity_id) REFERENCES entities(id))"
            )
            db.execute(
                "INSERT INTO tasks(request_id,entity_id,action,payload_hash,result,created_at) "
                "SELECT request_id,entity_id,action,NULL,result,created_at "
                "FROM tasks_legacy_migration WHERE EXISTS "
                "(SELECT 1 FROM entities WHERE entities.id=tasks_legacy_migration.entity_id)"
            )
            db.execute(
                "CREATE TABLE IF NOT EXISTS legacy_tasks_archive("
                "request_id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, action TEXT NOT NULL, "
                "payload_hash TEXT, result TEXT NOT NULL, created_at TEXT NOT NULL, "
                "archive_reason TEXT NOT NULL)"
            )
            db.execute(
                "INSERT INTO legacy_tasks_archive "
                "(request_id,entity_id,action,payload_hash,result,created_at,archive_reason) "
                "SELECT request_id,entity_id,action,NULL,result,created_at,'missing_entity_reference' "
                "FROM tasks_legacy_migration WHERE NOT EXISTS "
                "(SELECT 1 FROM entities WHERE entities.id=tasks_legacy_migration.entity_id)"
            )
            db.execute("DROP TABLE tasks_legacy_migration")
    db.execute(
        "CREATE TABLE IF NOT EXISTS legacy_tasks_archive("
        "request_id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, action TEXT NOT NULL, "
        "payload_hash TEXT, result TEXT NOT NULL, created_at TEXT NOT NULL, "
        "archive_reason TEXT NOT NULL)"
    )
    db.execute("CREATE INDEX IF NOT EXISTS idx_events_entity_id_id ON events(entity_id,id)")


def _workspace_schema(db):
    db.execute(
        "CREATE TABLE IF NOT EXISTS principals("
        "principal_id TEXT PRIMARY KEY, principal_type TEXT NOT NULL "
        "CHECK(principal_type='human'), active INTEGER NOT NULL DEFAULT 1 "
        "CHECK(active IN (0,1)), created_at TEXT NOT NULL)"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS tenants("
        "tenant_id TEXT PRIMARY KEY, tenant_type TEXT NOT NULL CHECK(tenant_type='personal'), "
        "owner_principal_id TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 "
        "CHECK(active IN (0,1)), created_at TEXT NOT NULL, "
        "FOREIGN KEY(owner_principal_id) REFERENCES principals(principal_id))"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS tenant_memberships("
        "tenant_id TEXT NOT NULL, principal_id TEXT NOT NULL, "
        "role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')), "
        "active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL, "
        "PRIMARY KEY(tenant_id,principal_id), "
        "FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id), "
        "FOREIGN KEY(principal_id) REFERENCES principals(principal_id))"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS resource_ownership("
        "resource_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, owner_principal_id TEXT NOT NULL, "
        "created_at TEXT NOT NULL, FOREIGN KEY(resource_id) REFERENCES entities(id), "
        "FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id), "
        "FOREIGN KEY(owner_principal_id) REFERENCES principals(principal_id))"
    )
    db.execute("CREATE INDEX IF NOT EXISTS idx_events_entity_id_id ON events(entity_id,id)")


GALINYX_MIGRATIONS = (
    Migration(1, "core_runtime_schema", _core_schema),
    Migration(2, "workspace_identity_schema", _workspace_schema),
)

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



def _ahaf_persistence_schema(db):
    db.execute(
        "CREATE TABLE IF NOT EXISTS ahaf_agent_bindings("
        "agent_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, owner_principal_id TEXT NOT NULL, "
        "binding_ref TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, "
        "FOREIGN KEY(agent_id) REFERENCES entities(id), "
        "FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id), "
        "FOREIGN KEY(owner_principal_id) REFERENCES principals(principal_id))"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS ahaf_agent_binding_revocations("
        "agent_id TEXT PRIMARY KEY, actor_principal_id TEXT NOT NULL, revoked_at TEXT NOT NULL, "
        "reason TEXT NOT NULL, FOREIGN KEY(agent_id) REFERENCES ahaf_agent_bindings(agent_id), "
        "FOREIGN KEY(actor_principal_id) REFERENCES principals(principal_id))"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS ahaf_authority_grants("
        "grant_id TEXT PRIMARY KEY, subject_agent_id TEXT NOT NULL, issuer_type TEXT NOT NULL "
        "CHECK(issuer_type IN ('human','agent')), issuer_id TEXT NOT NULL, parent_grant_id TEXT, "
        "policy_version TEXT NOT NULL, actions_json TEXT NOT NULL, resources_json TEXT NOT NULL, "
        "expires_at TEXT NOT NULL, budget_limit_units INTEGER NOT NULL CHECK(budget_limit_units>=0), "
        "budget_unit TEXT NOT NULL, max_transaction_units INTEGER, transaction_unit TEXT, "
        "transaction_actions_json TEXT NOT NULL, approval_required_json TEXT NOT NULL, "
        "delegable_actions_json TEXT NOT NULL, delegation_depth INTEGER NOT NULL "
        "CHECK(delegation_depth>=0), created_at TEXT NOT NULL, "
        "CHECK((max_transaction_units IS NULL AND transaction_unit IS NULL) OR "
        "(max_transaction_units IS NOT NULL AND max_transaction_units>=0 AND transaction_unit IS NOT NULL)), "
        "FOREIGN KEY(subject_agent_id) REFERENCES ahaf_agent_bindings(agent_id), "
        "FOREIGN KEY(parent_grant_id) REFERENCES ahaf_authority_grants(grant_id))"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS ahaf_grant_revocations("
        "grant_id TEXT PRIMARY KEY, actor_principal_id TEXT NOT NULL, revoked_at TEXT NOT NULL, "
        "reason TEXT NOT NULL, FOREIGN KEY(grant_id) REFERENCES ahaf_authority_grants(grant_id), "
        "FOREIGN KEY(actor_principal_id) REFERENCES principals(principal_id))"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS ahaf_budget_reservations("
        "reservation_id TEXT PRIMARY KEY, leaf_grant_id TEXT NOT NULL, request_id TEXT NOT NULL, "
        "amount_units INTEGER NOT NULL CHECK(amount_units>0), unit_code TEXT NOT NULL, "
        "created_at TEXT NOT NULL, UNIQUE(leaf_grant_id,request_id), "
        "FOREIGN KEY(leaf_grant_id) REFERENCES ahaf_authority_grants(grant_id))"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS ahaf_budget_ledger("
        "entry_id INTEGER PRIMARY KEY AUTOINCREMENT, reservation_id TEXT NOT NULL, "
        "grant_id TEXT NOT NULL, entry_type TEXT NOT NULL CHECK(entry_type IN ('reserve','commit','release')), "
        "amount_units INTEGER NOT NULL CHECK(amount_units>0), unit_code TEXT NOT NULL, "
        "idempotency_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, "
        "UNIQUE(reservation_id,grant_id,entry_type), "
        "FOREIGN KEY(reservation_id) REFERENCES ahaf_budget_reservations(reservation_id), "
        "FOREIGN KEY(grant_id) REFERENCES ahaf_authority_grants(grant_id))"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS ahaf_approvals("
        "approval_id TEXT PRIMARY KEY, grant_id TEXT NOT NULL, approver_principal_id TEXT NOT NULL, "
        "request_id TEXT NOT NULL, action TEXT NOT NULL, resource_id TEXT NOT NULL, "
        "amount_units INTEGER, unit_code TEXT, decision TEXT NOT NULL "
        "CHECK(decision IN ('approved','denied')), issued_at TEXT NOT NULL, expires_at TEXT NOT NULL, "
        "nonce TEXT NOT NULL UNIQUE, FOREIGN KEY(grant_id) REFERENCES ahaf_authority_grants(grant_id), "
        "FOREIGN KEY(approver_principal_id) REFERENCES principals(principal_id))"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS ahaf_audit_events("
        "event_id INTEGER PRIMARY KEY AUTOINCREMENT, occurred_at TEXT NOT NULL, "
        "actor_type TEXT NOT NULL, actor_id TEXT NOT NULL, agent_id TEXT, tenant_id TEXT, "
        "grant_id TEXT, request_id TEXT, action TEXT, resource_id TEXT, decision TEXT, "
        "policy_version TEXT NOT NULL, payload_json TEXT NOT NULL, previous_hash TEXT, "
        "event_hash TEXT NOT NULL UNIQUE, FOREIGN KEY(agent_id) REFERENCES ahaf_agent_bindings(agent_id), "
        "FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id), "
        "FOREIGN KEY(grant_id) REFERENCES ahaf_authority_grants(grant_id))"
    )
    append_only = (
        "ahaf_agent_bindings", "ahaf_agent_binding_revocations",
        "ahaf_authority_grants", "ahaf_grant_revocations",
        "ahaf_budget_reservations", "ahaf_budget_ledger",
        "ahaf_approvals", "ahaf_audit_events",
    )
    for table in append_only:
        db.execute(
            f"CREATE TRIGGER IF NOT EXISTS {table}_no_update "
            f"BEFORE UPDATE ON {table} BEGIN "
            "SELECT RAISE(ABORT, 'AHAF records are append-only'); END"
        )
        db.execute(
            f"CREATE TRIGGER IF NOT EXISTS {table}_no_delete "
            f"BEFORE DELETE ON {table} BEGIN "
            "SELECT RAISE(ABORT, 'AHAF records are append-only'); END"
        )
    db.execute("CREATE INDEX IF NOT EXISTS idx_ahaf_grants_subject ON ahaf_authority_grants(subject_agent_id)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_ahaf_grants_parent ON ahaf_authority_grants(parent_grant_id)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_ahaf_ledger_grant ON ahaf_budget_ledger(grant_id,entry_type)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_ahaf_audit_request ON ahaf_audit_events(request_id,event_id)")


GALINYX_MIGRATIONS = (
    Migration(1, "core_runtime_schema", _core_schema),
    Migration(2, "workspace_identity_schema", _workspace_schema),
    Migration(3, "ahaf_persistent_records", _ahaf_persistence_schema),
)

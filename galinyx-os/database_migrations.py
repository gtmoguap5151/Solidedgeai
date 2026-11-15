"""Small, explicit SQLite schema migration runner for GALINYX OS.

Migrations must use Connection.execute/executemany (not executescript), because
executescript may commit an active transaction. This module owns version
metadata and applies each upgrade under BEGIN IMMEDIATE.
"""
from dataclasses import dataclass
import sqlite3


@dataclass(frozen=True)
class Migration:
    version: int
    name: str
    apply: object


class MigrationError(RuntimeError):
    """Base class for migration failures."""


class UnsupportedSchemaVersion(MigrationError):
    """Raised when a database was created by a newer runtime."""


class MigrationRunner:
    META_TABLE = "schema_meta"
    VERSION_KEY = "schema_version"

    def __init__(self, connection, migrations):
        if not isinstance(connection, sqlite3.Connection):
            raise TypeError("connection must be a sqlite3.Connection")
        self.connection = connection
        self.migrations = tuple(migrations)
        versions = [m.version for m in self.migrations]
        if any(not isinstance(v, int) or isinstance(v, bool) or v < 1 for v in versions):
            raise ValueError("migration versions must be positive integers")
        if versions != sorted(set(versions)):
            raise ValueError("migration versions must be unique and strictly increasing")
        if versions and versions != list(range(1, versions[-1] + 1)):
            raise ValueError("migration versions must be contiguous starting at 1")
        for migration in self.migrations:
            if not isinstance(migration.name, str) or not migration.name.strip():
                raise ValueError("migration name is required")
            if not callable(migration.apply):
                raise ValueError("migration apply must be callable")

    @property
    def target_version(self):
        return self.migrations[-1].version if self.migrations else 0

    def current_version(self):
        exists = self.connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
            (self.META_TABLE,),
        ).fetchone()
        if exists is None:
            return 0
        columns = {row[1] for row in self.connection.execute(
            f"PRAGMA table_info({self.META_TABLE})"
        )}
        if not {"key", "value"}.issubset(columns):
            raise MigrationError("schema_meta table has an unsupported shape")
        row = self.connection.execute(
            f"SELECT value FROM {self.META_TABLE} WHERE key=?",
            (self.VERSION_KEY,),
        ).fetchone()
        if row is None:
            return 0
        try:
            version = int(row[0])
        except (TypeError, ValueError):
            raise MigrationError("schema version metadata is invalid") from None
        if version < 0:
            raise MigrationError("schema version cannot be negative")
        return version

    def migrate(self):
        # Acquire the SQLite write reservation before reading version metadata;
        # this prevents two processes from racing the same upgrade.
        self.connection.execute("BEGIN IMMEDIATE")
        try:
            self.connection.execute(
                "CREATE TABLE IF NOT EXISTS schema_meta "
                "(key TEXT PRIMARY KEY, value TEXT NOT NULL)"
            )
            current = self.current_version()
            if current > self.target_version:
                raise UnsupportedSchemaVersion(
                    f"database schema version {current} is newer than supported "
                    f"version {self.target_version}"
                )
            for migration in self.migrations:
                if migration.version <= current:
                    continue
                migration.apply(self.connection)
                self.connection.execute(
                    "INSERT INTO schema_meta(key,value) VALUES (?,?) "
                    "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                    (self.VERSION_KEY, str(migration.version)),
                )
            self.connection.commit()
        except Exception:
            self.connection.rollback()
            raise
        return self.current_version()

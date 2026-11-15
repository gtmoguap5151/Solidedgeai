import sqlite3
import tempfile
import unittest
from pathlib import Path

from runtime import Runtime
from database_migrations import UnsupportedSchemaVersion


class RuntimeMigrationIntegrationTests(unittest.TestCase):
    def test_version_one_database_upgrades_without_losing_records(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "version-one.db"
            db = sqlite3.connect(path)
            db.executescript("""
                CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                INSERT INTO schema_meta VALUES ('schema_version','1');
                CREATE TABLE entities (
                    id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL,
                    capabilities TEXT NOT NULL, created_at TEXT NOT NULL
                );
                CREATE TABLE tasks (
                    request_id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, action TEXT NOT NULL,
                    payload_hash TEXT, result TEXT NOT NULL, created_at TEXT NOT NULL
                );
                CREATE TABLE events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, entity_id TEXT NOT NULL,
                    event_type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL
                );
                INSERT INTO entities VALUES ('agent-1','agent','Researcher','[]','2026-01-01T00:00:00+00:00');
                INSERT INTO tasks VALUES ('req-1','agent-1','memory.write','digest','{"status":"completed"}','2026-01-01T00:00:01+00:00');
                INSERT INTO events(entity_id,event_type,payload,created_at)
                    VALUES ('agent-1','task.completed','{}','2026-01-01T00:00:01+00:00');
            """)
            db.commit()
            db.close()

            runtime = Runtime(path)
            try:
                self.assertEqual(runtime.schema_version(), 3)
                self.assertEqual(runtime.entity("agent-1")["name"], "Researcher")
                self.assertEqual(runtime.db.execute(
                    "SELECT result FROM tasks WHERE request_id='req-1'"
                ).fetchone()[0], '{"status":"completed"}')
                self.assertEqual(runtime.db.execute(
                    "SELECT event_type FROM events WHERE entity_id='agent-1'"
                ).fetchone()[0], "task.completed")
                self.assertIsNotNone(runtime.db.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='principals'"
                ).fetchone())
            finally:
                runtime.close()

    def test_legacy_task_rows_are_preserved_or_archived_by_reference_validity(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "legacy.db"
            db = sqlite3.connect(path)
            db.executescript("""
                CREATE TABLE entities (
                    id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL,
                    capabilities TEXT NOT NULL, created_at TEXT NOT NULL
                );
                CREATE TABLE tasks (
                    request_id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, action TEXT NOT NULL,
                    result TEXT NOT NULL, created_at TEXT NOT NULL
                );
                INSERT INTO entities VALUES ('present','agent','Present','[]','2026-01-01');
                INSERT INTO tasks VALUES ('valid-req','present','memory.write','{"ok":true}','2026-01-02');
                INSERT INTO tasks VALUES ('orphan-req','missing','memory.write','{"ok":false}','2026-01-03');
            """)
            db.commit()
            db.close()

            runtime = Runtime(path)
            try:
                self.assertEqual(runtime.db.execute(
                    "SELECT payload_hash FROM tasks WHERE request_id='valid-req'"
                ).fetchone()[0], None)
                self.assertEqual(runtime.db.execute(
                    "SELECT archive_reason FROM legacy_tasks_archive WHERE request_id='orphan-req'"
                ).fetchone()[0], "missing_entity_reference")
                self.assertEqual(runtime.db.execute(
                    "SELECT COUNT(*) FROM tasks"
                ).fetchone()[0], 1)
            finally:
                runtime.close()

    def test_future_schema_is_rejected_before_runtime_tables_are_created(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "future.db"
            db = sqlite3.connect(path)
            db.execute("CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
            db.execute("INSERT INTO schema_meta VALUES ('schema_version','99')")
            db.commit()
            db.close()

            with self.assertRaises(UnsupportedSchemaVersion):
                Runtime(path)

            db = sqlite3.connect(path)
            try:
                self.assertEqual(db.execute(
                    "SELECT value FROM schema_meta WHERE key='schema_version'"
                ).fetchone()[0], "99")
                self.assertIsNone(db.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='entities'"
                ).fetchone())
            finally:
                db.close()

    def test_current_database_reopens_without_reapplying_migrations(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "current.db"
            first = Runtime(path)
            first.register_human("human-1")
            first.close()
            second = Runtime(path)
            try:
                self.assertEqual(second.schema_version(), 3)
                self.assertEqual(second.db.execute(
                    "SELECT COUNT(*) FROM principals WHERE principal_id='human-1'"
                ).fetchone()[0], 1)
            finally:
                second.close()


if __name__ == "__main__":
    unittest.main()

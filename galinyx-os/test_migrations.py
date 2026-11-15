import sqlite3
import tempfile
import unittest
from pathlib import Path
from runtime import Runtime

class MigrationTests(unittest.TestCase):
    def test_legacy_task_rows_are_preserved_and_not_replayed(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "legacy.db"
            connection = sqlite3.connect(database)
            connection.execute(
                "CREATE TABLE tasks("
                "request_id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, action TEXT NOT NULL, "
                "result TEXT NOT NULL, created_at TEXT NOT NULL)"
            )
            connection.execute(
                "INSERT INTO tasks VALUES (?,?,?,?,?)",
                ("legacy-request", "old-entity", "memory.write", '{"status":"completed"}', "2026-01-01T00:00:00+00:00")
            )
            connection.commit()
            connection.close()

            runtime = Runtime(database)
            self.assertEqual(runtime.schema_version(), 1)
            row = runtime.db.execute(
                "SELECT request_id,entity_id,action,payload_hash,result,created_at FROM tasks"
            ).fetchone()
            self.assertEqual(row[0], "legacy-request")
            self.assertIsNone(row[3])
            self.assertEqual(row[4], '{"status":"completed"}')
            entity_id = runtime.create("New entity", "application", ["memory.write"])
            with self.assertRaises(ValueError):
                runtime.execute(entity_id, "memory.write", {"key": "x", "value": 1}, "legacy-request")
            runtime.close()

if __name__ == "__main__":
    unittest.main()

import sqlite3
import tempfile
import unittest
from pathlib import Path
from runtime import Runtime

class CompatibilityTests(unittest.TestCase):
    def test_old_schema_migrates_and_archives_orphaned_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/"legacy.db"
            db=sqlite3.connect(path)
            db.execute("CREATE TABLE tasks (request_id TEXT PRIMARY KEY, entity_id TEXT, action TEXT, result TEXT, created_at TEXT)")
            db.execute("INSERT INTO tasks VALUES ('old','entity','action','{}','2026-01-01')")
            db.commit()
            db.close()
            runtime=Runtime(path)
            self.assertEqual(runtime.schema_version(), 6)
            self.assertEqual(runtime.db.execute("SELECT count(*) FROM tasks").fetchone()[0],0)
            archived=runtime.db.execute(
                "SELECT request_id,archive_reason FROM legacy_tasks_archive"
            ).fetchone()
            self.assertEqual(archived,("old","missing_entity_reference"))
            runtime.close()

    def test_invalid_capabilities_fail_closed(self):
        runtime=Runtime()
        with self.assertRaises(ValueError):
            runtime.create("Untrusted","creator",["payments.transfer"])
        runtime.close()

if __name__=="__main__":
    unittest.main()

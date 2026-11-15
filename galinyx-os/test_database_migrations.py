import sqlite3
import unittest

from database_migrations import (
    Migration, MigrationError, MigrationRunner, UnsupportedSchemaVersion,
)


class MigrationRunnerTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")

    def tearDown(self):
        self.db.close()

    def test_fresh_database_applies_ordered_migrations(self):
        def first(db):
            db.execute("CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT NOT NULL)")
        def second(db):
            db.execute("ALTER TABLE records ADD COLUMN category TEXT NOT NULL DEFAULT 'general'")
        runner = MigrationRunner(self.db, [
            Migration(1, "create records", first),
            Migration(2, "add category", second),
        ])
        self.assertEqual(runner.migrate(), 2)
        self.assertEqual(runner.current_version(), 2)
        self.assertEqual(
            [row[1] for row in self.db.execute("PRAGMA table_info(records)")],
            ["id", "value", "category"],
        )

    def test_reopening_current_database_is_idempotent(self):
        calls = []
        runner = MigrationRunner(self.db, [
            Migration(1, "create marker", lambda db: (calls.append(1), db.execute(
                "CREATE TABLE marker (id INTEGER PRIMARY KEY)"
            ))),
        ])
        self.assertEqual(runner.migrate(), 1)
        self.assertEqual(runner.migrate(), 1)
        self.assertEqual(calls, [1])

    def test_failed_migration_rolls_back_schema_and_version(self):
        def create_then_fail(db):
            db.execute("CREATE TABLE partial (id INTEGER)")
            raise RuntimeError("simulated migration failure")
        runner = MigrationRunner(self.db, [Migration(1, "failing", create_then_fail)])
        with self.assertRaises(RuntimeError):
            runner.migrate()
        self.assertIsNone(self.db.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='partial'"
        ).fetchone())
        self.assertEqual(runner.current_version(), 0)

    def test_future_schema_is_rejected_without_writes(self):
        self.db.execute("CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        self.db.execute("INSERT INTO schema_meta VALUES ('schema_version','9')")
        self.db.commit()
        runner = MigrationRunner(self.db, [Migration(1, "initial", lambda db: db.execute(
            "CREATE TABLE should_not_exist (id INTEGER)"
        ))])
        with self.assertRaises(UnsupportedSchemaVersion):
            runner.migrate()
        self.assertEqual(runner.current_version(), 9)
        self.assertIsNone(self.db.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='should_not_exist'"
        ).fetchone())

    def test_existing_schema_without_version_is_treated_as_legacy_zero(self):
        self.db.execute("CREATE TABLE existing_data (value TEXT)")
        self.db.execute("INSERT INTO existing_data VALUES ('preserve me')")
        self.db.commit()
        runner = MigrationRunner(self.db, [Migration(1, "record initial schema", lambda db: db.execute(
            "CREATE TABLE new_table (id INTEGER PRIMARY KEY)"
        ))])
        self.assertEqual(runner.migrate(), 1)
        self.assertEqual(self.db.execute("SELECT value FROM existing_data").fetchone()[0], "preserve me")

    def test_versions_must_be_contiguous_and_ordered(self):
        with self.assertRaises(ValueError):
            MigrationRunner(self.db, [
                Migration(1, "one", lambda db: None),
                Migration(3, "three", lambda db: None),
            ])
        with self.assertRaises(ValueError):
            MigrationRunner(self.db, [
                Migration(2, "two", lambda db: None),
                Migration(1, "one", lambda db: None),
            ])

    def test_invalid_schema_metadata_fails_closed(self):
        self.db.execute("CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        self.db.execute("INSERT INTO schema_meta VALUES ('schema_version','not-a-number')")
        self.db.commit()
        runner = MigrationRunner(self.db, [Migration(1, "initial", lambda db: None)])
        with self.assertRaises(MigrationError):
            runner.migrate()


if __name__ == "__main__":
    unittest.main()

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from cli import main

class CliTests(unittest.TestCase):
    def test_init_and_create_entity(self):
        with tempfile.TemporaryDirectory() as directory:
            database = str(Path(directory) / "galinyx.db")
            manifest = Path(directory) / "entity.json"
            manifest.write_text(json.dumps({
                "schema_version": 1, "name": "Local App", "kind": "application",
                "capabilities": ["memory.write"]
            }), encoding="utf-8")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(main(["init", "--database", database]), 0)
                self.assertEqual(main(["create-entity", str(manifest), "--database", database]), 0)
                self.assertEqual(main(["list-entities", "--database", database]), 0)
            records = [json.loads(line) for line in output.getvalue().splitlines()]
            self.assertTrue(records[0]["initialized"])
            self.assertEqual(records[1]["kind"], "application")
            self.assertEqual(records[2][0]["name"], "Local App")

    def test_validate_manifest_without_database(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "entity.json"
            manifest.write_text(json.dumps({
                "schema_version": 1, "name": "Validator", "kind": "service",
                "capabilities": []
            }), encoding="utf-8")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(main(["validate-manifest", str(manifest)]), 0)
            self.assertTrue(json.loads(output.getvalue())["valid"])

if __name__ == "__main__":
    unittest.main()

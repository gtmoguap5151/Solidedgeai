import unittest
from runtime import Runtime

class BoundaryTests(unittest.TestCase):
    def test_invalid_payload_and_id(self):
        runtime = Runtime()
        entity = runtime.create("Example", "creator", ["memory.write"])
        with self.assertRaises(ValueError):
            runtime.execute(entity, "memory.write", "invalid")
        with self.assertRaises(ValueError):
            runtime.execute(entity, "memory.write", {}, "")
        runtime.close()

    def test_changed_payload_rejected(self):
        runtime = Runtime()
        entity = runtime.create("Example", "creator", ["memory.write"])
        runtime.execute(entity, "memory.write", {"key": "a", "value": 1}, "request-1")
        with self.assertRaises(ValueError):
            runtime.execute(entity, "memory.write", {"key": "a", "value": 2}, "request-1")
        runtime.close()

if __name__ == "__main__":
    unittest.main()

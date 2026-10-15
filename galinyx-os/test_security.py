import unittest
from runtime import Runtime

class SecurityRegressionTests(unittest.TestCase):
    def test_unsupported_actions_never_execute(self):
        runtime = Runtime()
        with self.assertRaises(ValueError):
            runtime.create("Example", "creator", ["social.publish", "payments.transfer"])
        entity = runtime.create("Example", "creator", ["memory.write"])
        self.assertEqual(runtime.execute(entity, "social.publish")["status"], "denied")
        self.assertEqual(runtime.execute(entity, "payments.transfer")["status"], "denied")
        runtime.close()

    def test_request_id_collision_is_rejected(self):
        runtime = Runtime()
        first = runtime.create("One", "creator", ["memory.write"])
        second = runtime.create("Two", "creator", ["memory.write"])
        runtime.execute(first, "memory.write", {"key": "k", "value": 1}, "shared-id")
        with self.assertRaises(ValueError):
            runtime.execute(second, "memory.write", {"key": "k", "value": 2}, "shared-id")
        runtime.close()

if __name__ == "__main__":
    unittest.main()

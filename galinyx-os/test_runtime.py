import tempfile
import unittest
from pathlib import Path
from runtime import Runtime

class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.r=Runtime()
        self.a=self.r.create("Creator","creator",["memory.write","story.plan"])
        self.b=self.r.create("Researcher","researcher",["memory.write"])

    def tearDown(self):
        self.r.close()

    def test_isolation(self):
        self.r.execute(self.a,"memory.write",{"key":"secret","value":"creator only"})
        self.assertEqual(self.r.remember(self.a,"secret"),"creator only")
        self.assertIsNone(self.r.remember(self.b,"secret"))

    def test_denied_side_effects(self):
        self.assertEqual(self.r.execute(self.a,"social.publish")["status"],"denied")
        self.assertEqual(self.r.execute(self.a,"payments.transfer")["status"],"denied")

    def test_capabilities(self):
        self.assertEqual(self.r.execute(self.a,"story.plan")["status"],"completed")
        self.assertEqual(self.r.execute(self.b,"story.plan")["status"],"denied")

    def test_idempotency(self):
        first=self.r.execute(self.a,"memory.write",{"key":"x","value":1},"same-request")
        second=self.r.execute(self.a,"memory.write",{"key":"x","value":2},"same-request")
        self.assertEqual(first,second)
        self.assertEqual(self.r.remember(self.a,"x"),1)
        self.assertEqual(sum(e["type"]=="task.completed" for e in self.r.events(self.a)),1)

    def test_durable_state(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/"runtime.db"
            x=Runtime(path)
            eid=x.create("Persisted","creator",["memory.write"])
            x.execute(eid,"memory.write",{"key":"canon","value":{"chapter":1}})
            x.close()
            y=Runtime(path)
            self.assertEqual(y.remember(eid,"canon"),{"chapter":1})
            y.close()

if __name__=="__main__":
    unittest.main()

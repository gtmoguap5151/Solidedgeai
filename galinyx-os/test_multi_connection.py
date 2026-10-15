import tempfile
import unittest
from pathlib import Path
from runtime import Runtime

class MultiConnectionTests(unittest.TestCase):
    def test_duplicate_request_is_not_replayed_across_connections(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/"shared.sqlite"
            first=Runtime(path)
            entity=first.create("Example","creator",["memory.write"])
            second=Runtime(path)
            try:
                a=first.execute(entity,"memory.write",{"key":"x","value":1},"shared")
                b=second.execute(entity,"memory.write",{"key":"x","value":1},"shared")
                self.assertEqual(a,b)
                with self.assertRaises(ValueError):
                    second.execute(entity,"memory.write",{"key":"x","value":2},"shared")
                self.assertEqual(second.remember(entity,"x"),1)
            finally:
                second.close()
                first.close()

if __name__=="__main__":
    unittest.main()

import unittest
from runtime import Runtime

class LimitsTests(unittest.TestCase):
    def setUp(self):
        self.runtime=Runtime()
        self.entity=self.runtime.create("Test","creator",["memory.write"])
    def tearDown(self):
        self.runtime.close()
    def test_oversized_payload_rejected(self):
        with self.assertRaisesRegex(ValueError,"64 KiB"):
            self.runtime.execute(self.entity,"memory.write",{"key":"x","value":"a"*70000})
    def test_long_request_id_rejected(self):
        with self.assertRaises(ValueError):
            self.runtime.execute(self.entity,"memory.write",{"key":"x","value":1},"a"*129)
    def test_non_finite_numbers_rejected(self):
        with self.assertRaises(ValueError):
            self.runtime.execute(self.entity,"memory.write",{"key":"x","value":float("nan")})
    def test_no_record_on_invalid_payload(self):
        with self.assertRaises(ValueError):
            self.runtime.execute(self.entity,"memory.write",{"key":"x","value":"a"*70000})
        self.assertIsNone(self.runtime.remember(self.entity,"x"))

if __name__=="__main__":
    unittest.main()

import unittest
from runtime import Runtime

class ManifestAndRightsTests(unittest.TestCase):
    def test_entity_manifest_validation(self):
        runtime=Runtime()
        with self.assertRaises(ValueError):
            runtime.create("Bad", "unknown", [])
        with self.assertRaises(ValueError):
            runtime.create("Bad", "creator", [1])
        runtime.close()

    def test_rights_reference_required(self):
        runtime=Runtime()
        entity=runtime.create("Studio","creator",["story.plan","creator.draft","creator.rights","creator.review"])
        runtime.execute(entity,"story.plan",{"world_key":"w","canon":{"setting":"Station"}})
        asset=runtime.execute(entity,"creator.draft",{"world_key":"w","prompt":"An arrival"})["asset_id"]
        with self.assertRaises(ValueError):
            runtime.execute(entity,"creator.rights",{"asset_id":asset,"status":"cleared"})
        runtime.execute(entity,"creator.rights",{"asset_id":asset,"status":"cleared","evidence":"license-ledger:001"})
        runtime.execute(entity,"creator.review",{"asset_id":asset,"decision":"approve"})
        record=runtime.asset(entity,asset)
        self.assertEqual(record["rights_evidence_reference"],"license-ledger:001")
        self.assertFalse(record["published"])
        runtime.close()

if __name__=="__main__":
    unittest.main()

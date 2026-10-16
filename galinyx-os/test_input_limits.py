import unittest
from runtime import Runtime

class InputLimitsTests(unittest.TestCase):
    def setUp(self):
        self.runtime=Runtime()
        self.creator=self.runtime.create("Studio","creator",["memory.write","story.plan","creator.draft"])
    def tearDown(self):
        self.runtime.close()
    def test_entity_id_type_checked(self):
        with self.assertRaises(ValueError):
            self.runtime.entity([])
    def test_memory_key_limit(self):
        with self.assertRaises(ValueError):
            self.runtime.execute(self.creator,"memory.write",{"key":"k"*257,"value":"x"})
    def test_story_canon_limit(self):
        with self.assertRaises(ValueError):
            self.runtime.execute(self.creator,"story.plan",{"world_key":"w","canon":{"blob":"x"*33000}})
    def test_creator_prompt_limit_and_setting_type(self):
        self.runtime.execute(self.creator,"story.plan",{"world_key":"w","canon":{"setting":"Station"}})
        with self.assertRaises(ValueError):
            self.runtime.execute(self.creator,"creator.draft",{"world_key":"w","prompt":"x"*4001})
        for invalid_setting in (42, "", "   ", "s" * 257):
            with self.subTest(setting_type=type(invalid_setting).__name__, length=len(invalid_setting) if isinstance(invalid_setting, str) else None):
                with self.assertRaises(ValueError):
                    self.runtime.execute(
                        self.creator,
                        "story.plan",
                        {"world_key": "bad", "canon": {"setting": invalid_setting}},
                    )

if __name__=="__main__":
    unittest.main()

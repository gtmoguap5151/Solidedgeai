import tempfile
import unittest
from pathlib import Path

from runtime import Runtime


class RuntimeIdentityBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.runtime = Runtime()
        self.runtime.register_human("human-a")
        self.runtime.register_human("human-b")
        self.runtime.create_personal_workspace("tenant-a", "human-a")
        self.runtime.create_personal_workspace("tenant-b", "human-b")
        self.entity_a = self.runtime.create_owned_entity(
            "human-a", "tenant-a", "Owner Agent", "agent", ["memory.write"]
        )
        self.entity_b = self.runtime.create_owned_entity(
            "human-b", "tenant-b", "Other Agent", "agent", ["memory.write"]
        )

    def tearDown(self):
        self.runtime.close()

    def test_owner_can_execute_agent_task(self):
        result = self.runtime.execute_as(
            "human-a", "tenant-a", self.entity_a,
            "memory.write", {"key": "note", "value": "authorized"}
        )
        self.assertEqual(result["status"], "completed")
        self.assertEqual(self.runtime.remember(self.entity_a, "note"), "authorized")

    def test_other_workspace_owner_cannot_execute_agent(self):
        with self.assertRaises(PermissionError):
            self.runtime.execute_as(
                "human-b", "tenant-b", self.entity_a,
                "memory.write", {"key": "intrusion", "value": True}
            )
        self.assertIsNone(self.runtime.remember(self.entity_a, "intrusion"))

    def test_tenant_substitution_does_not_authorize(self):
        with self.assertRaises(PermissionError):
            self.runtime.execute_as(
                "human-a", "tenant-b", self.entity_b,
                "memory.write", {"key": "intrusion", "value": True}
            )

    def test_viewer_cannot_execute_mutating_agent_task(self):
        self.runtime.grant_workspace_membership("tenant-a", "human-b", "viewer")
        with self.assertRaises(PermissionError):
            self.runtime.execute_as(
                "human-b", "tenant-a", self.entity_a,
                "memory.write", {"key": "viewer-write", "value": True}
            )
        self.assertIsNone(self.runtime.remember(self.entity_a, "viewer-write"))

    def test_editor_can_execute_but_cannot_delete_resource(self):
        self.runtime.grant_workspace_membership("tenant-a", "human-b", "editor")
        allowed, reason = self.runtime.authorize_resource(
            "human-b", "tenant-a", self.entity_a, "resource.write"
        )
        self.assertTrue(allowed, reason)
        allowed, reason = self.runtime.authorize_resource(
            "human-b", "tenant-a", self.entity_a, "resource.delete"
        )
        self.assertFalse(allowed)
        self.assertEqual(reason, "role_permission_denied")

    def test_revoked_membership_stops_runtime_access(self):
        self.runtime.grant_workspace_membership("tenant-a", "human-b", "editor")
        self.assertTrue(self.runtime.revoke_workspace_membership("tenant-a", "human-b"))
        with self.assertRaises(PermissionError):
            self.runtime.execute_as(
                "human-b", "tenant-a", self.entity_a,
                "memory.write", {"key": "after-revoke", "value": True}
            )

    def test_unregistered_human_cannot_create_owned_agent(self):
        with self.assertRaises(PermissionError):
            self.runtime.create_owned_entity(
                "unknown-human", "tenant-a", "Intruder", "agent", ["memory.write"]
            )

    def test_workspace_owner_cannot_claim_another_personal_workspace(self):
        with self.assertRaises(PermissionError):
            self.runtime.create_owned_entity(
                "human-a", "tenant-b", "Claimed Agent", "agent", ["memory.write"]
            )

    def test_unknown_resource_and_action_fail_closed(self):
        self.assertEqual(
            self.runtime.authorize_resource(
                "human-a", "tenant-a", "missing-resource", "resource.write"
            ),
            (False, "membership_or_ownership_required")
        )
        self.assertEqual(
            self.runtime.authorize_resource(
                "human-a", "tenant-a", self.entity_a, "payments.transfer"
            ),
            (False, "unknown_action_denied")
        )

    def test_workspace_and_ownership_survive_runtime_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "identity-runtime.db"
            first = Runtime(database)
            first.register_human("persistent-human")
            first.create_personal_workspace("persistent-tenant", "persistent-human")
            entity_id = first.create_owned_entity(
                "persistent-human", "persistent-tenant", "Persistent Agent",
                "agent", ["memory.write"]
            )
            first.close()

            second = Runtime(database)
            allowed, reason = second.authorize_resource(
                "persistent-human", "persistent-tenant", entity_id, "resource.write"
            )
            self.assertTrue(allowed, reason)
            second.close()


if __name__ == "__main__":
    unittest.main()

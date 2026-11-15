import unittest

from identity import IdentityDirectory, IdentityPolicyError


class IdentityPolicyTests(unittest.TestCase):
    def setUp(self):
        self.directory = IdentityDirectory()
        self.directory.register_human("human-a")
        self.directory.register_human("human-b")
        self.directory.create_personal_workspace("tenant-a", "human-a")
        self.directory.create_personal_workspace("tenant-b", "human-b")
        self.directory.register_resource("resource-a", "tenant-a", "human-a")
        self.directory.register_resource("resource-b", "tenant-b", "human-b")

    def test_workspace_owner_can_read_and_write_own_resource(self):
        for action in ("resource.read", "resource.write", "resource.delete"):
            decision = self.directory.authorize("human-a", "tenant-a", "resource-a", action)
            self.assertTrue(decision.allowed, (action, decision.reason))

    def test_other_human_cannot_access_private_workspace_resource(self):
        decision = self.directory.authorize("human-b", "tenant-a", "resource-a", "resource.read")
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason, "active_membership_required")

    def test_tenant_id_substitution_does_not_grant_access(self):
        decision = self.directory.authorize("human-a", "tenant-b", "resource-b", "resource.read")
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason, "active_membership_required")

    def test_resource_from_other_tenant_is_denied_even_with_membership(self):
        self.directory.grant_membership("tenant-a", "human-b", "viewer")
        decision = self.directory.authorize("human-b", "tenant-a", "resource-b", "resource.read")
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason, "cross_tenant_access_denied")

    def test_viewer_cannot_write_or_delete(self):
        self.directory.grant_membership("tenant-a", "human-b", "viewer")
        for action in ("resource.write", "resource.delete", "membership.manage"):
            decision = self.directory.authorize("human-b", "tenant-a", "resource-a", action)
            self.assertFalse(decision.allowed)
            self.assertEqual(decision.reason, "role_permission_denied")

    def test_editor_can_write_but_cannot_delete_or_manage_members(self):
        self.directory.grant_membership("tenant-a", "human-b", "editor")
        self.assertTrue(self.directory.authorize(
            "human-b", "tenant-a", "resource-a", "resource.write"
        ).allowed)
        self.assertFalse(self.directory.authorize(
            "human-b", "tenant-a", "resource-a", "resource.delete"
        ).allowed)
        self.assertFalse(self.directory.authorize(
            "human-b", "tenant-a", "resource-a", "membership.manage"
        ).allowed)

    def test_revoked_membership_stops_authorizing(self):
        self.directory.grant_membership("tenant-a", "human-b", "viewer")
        self.assertTrue(self.directory.authorize(
            "human-b", "tenant-a", "resource-a", "resource.read"
        ).allowed)
        self.assertTrue(self.directory.revoke_membership("tenant-a", "human-b"))
        decision = self.directory.authorize("human-b", "tenant-a", "resource-a", "resource.read")
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason, "active_membership_required")

    def test_disabled_principal_is_denied(self):
        self.assertTrue(self.directory.disable_principal("human-a"))
        decision = self.directory.authorize("human-a", "tenant-a", "resource-a", "resource.read")
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason, "unknown_or_inactive_human")

    def test_unknown_principal_tenant_resource_and_action_fail_closed(self):
        cases = [
            ("not-registered", "tenant-a", "resource-a", "resource.read"),
            ("human-a", "not-a-tenant", "resource-a", "resource.read"),
            ("human-a", "tenant-a", "not-a-resource", "resource.read"),
            ("human-a", "tenant-a", "resource-a", "payments.transfer"),
        ]
        for args in cases:
            with self.subTest(args=args):
                self.assertFalse(self.directory.authorize(*args).allowed)

    def test_personal_workspace_requires_registered_active_human(self):
        with self.assertRaises(IdentityPolicyError):
            self.directory.create_personal_workspace("tenant-x", "unregistered")
        self.directory.disable_principal("human-b")
        with self.assertRaises(IdentityPolicyError):
            self.directory.create_personal_workspace("tenant-y", "human-b")

    def test_resource_owner_cannot_be_forged_during_registration(self):
        with self.assertRaises(IdentityPolicyError):
            self.directory.register_resource("fake-resource", "tenant-a", "human-b")

    def test_duplicate_principals_tenants_and_resources_are_rejected(self):
        with self.assertRaises(IdentityPolicyError):
            self.directory.register_human("human-a")
        with self.assertRaises(IdentityPolicyError):
            self.directory.create_personal_workspace("tenant-a", "human-a")
        with self.assertRaises(IdentityPolicyError):
            self.directory.register_resource("resource-a", "tenant-a", "human-a")

    def test_unknown_roles_are_rejected(self):
        with self.assertRaises(IdentityPolicyError):
            self.directory.grant_membership("tenant-a", "human-b", "superadmin")

    def test_resource_registration_requires_active_tenant_and_owner(self):
        with self.assertRaises(IdentityPolicyError):
            self.directory.register_resource("orphan", "missing-tenant", "human-a")
        self.directory.revoke_membership("tenant-a", "human-a")
        with self.assertRaises(IdentityPolicyError):
            self.directory.register_resource("orphan-2", "tenant-a", "human-a")


if __name__ == "__main__":
    unittest.main()

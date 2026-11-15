import unittest

from runtime import Runtime
from service import AuthenticationError, GalinyxService


class TestAuthenticator:
    """Deterministic test double; not a real authentication mechanism."""
    def __init__(self, credentials):
        self.credentials = credentials

    def authenticate(self, credential):
        if credential not in self.credentials:
            raise ValueError("invalid credential")
        return self.credentials[credential]


class TrustedServiceBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.runtime = Runtime()
        self.runtime.register_human("owner-id")
        self.runtime.register_human("viewer-id")
        self.runtime.create_personal_workspace("workspace", "owner-id")
        self.runtime.grant_workspace_membership("workspace", "viewer-id", "viewer")
        self.agent = self.runtime.create_owned_entity(
            "owner-id", "workspace", "Service Agent", "agent", ["memory.write"]
        )
        self.auth = TestAuthenticator({
            "owner-secret": "owner-id",
            "viewer-secret": "viewer-id",
        })
        self.service = GalinyxService(self.runtime, self.auth)

    def tearDown(self):
        self.runtime.close()

    def test_service_derives_principal_from_credential(self):
        result = self.service.execute_agent(
            "owner-secret", "workspace", self.agent,
            "memory.write", {"key": "proof", "value": "owner"}
        )
        self.assertEqual(result["status"], "completed")
        self.assertEqual(self.service.read_memory(
            "owner-secret", "workspace", self.agent, "proof"
        ), "owner")

    def test_invalid_credential_is_rejected_before_runtime_access(self):
        with self.assertRaises(AuthenticationError):
            self.service.execute_agent(
                "not-a-secret", "workspace", self.agent,
                "memory.write", {"key": "bad", "value": True}
            )
        self.assertIsNone(self.runtime.remember(self.agent, "bad"))

    def test_caller_cannot_supply_principal_id_as_an_argument(self):
        with self.assertRaises(TypeError):
            self.service.execute_agent(
                credential="viewer-secret", tenant_id="workspace",
                entity_id=self.agent, action="memory.write",
                payload={"key": "bad", "value": True}, principal_id="owner-id"
            )

    def test_viewer_can_read_but_cannot_mutate(self):
        self.runtime.execute_as(
            "owner-id", "workspace", self.agent,
            "memory.write", {"key": "shared", "value": "readable"}
        )
        self.assertEqual(self.service.read_memory(
            "viewer-secret", "workspace", self.agent, "shared"
        ), "readable")
        with self.assertRaises(PermissionError):
            self.service.execute_agent(
                "viewer-secret", "workspace", self.agent,
                "memory.write", {"key": "blocked", "value": True}
            )

    def test_viewer_can_inspect_but_other_workspace_cannot(self):
        self.assertEqual(
            self.service.inspect_agent("viewer-secret", "workspace", self.agent)["id"],
            self.agent
        )
        self.runtime.register_human("other-id")
        self.runtime.create_personal_workspace("other-workspace", "other-id")
        other_service = GalinyxService(
            self.runtime, TestAuthenticator({"other-secret": "other-id"})
        )
        with self.assertRaises(PermissionError):
            other_service.inspect_agent("other-secret", "other-workspace", self.agent)

    def test_owner_can_add_and_revoke_workspace_member(self):
        self.runtime.register_human("new-member")
        self.auth.credentials["new-member-secret"] = "new-member"
        self.assertTrue(self.service.add_workspace_member(
            "owner-secret", "workspace", "new-member", "editor"
        ))
        self.assertEqual(
            self.runtime.authorize_resource(
                "new-member", "workspace", self.agent, "resource.write"
            ),
            (True, "authorized")
        )
        self.assertTrue(self.service.remove_workspace_member(
            "owner-secret", "workspace", "new-member"
        ))
        self.assertFalse(
            self.runtime.authorize_resource(
                "new-member", "workspace", self.agent, "resource.write"
            )[0]
        )

    def test_viewer_cannot_manage_workspace_members(self):
        self.runtime.register_human("new-member")
        self.auth.credentials["new-member-secret"] = "new-member"
        with self.assertRaises(PermissionError):
            self.service.add_workspace_member(
                "viewer-secret", "workspace", "new-member", "editor"
            )
        self.assertEqual(
            self.runtime.authorize_resource(
                "new-member", "workspace", self.agent, "resource.read"
            ),
            (False, "membership_or_ownership_required")
        )

    def test_owner_cannot_manage_membership_in_another_workspace(self):
        self.runtime.register_human("other-owner")
        self.runtime.create_personal_workspace("other-workspace", "other-owner")
        self.auth.credentials["other-owner-secret"] = "other-owner"
        with self.assertRaises(PermissionError):
            self.service.add_workspace_member(
                "owner-secret", "other-workspace", "viewer-id", "viewer"
            )

    def test_workspace_owner_cannot_demote_themselves(self):
        with self.assertRaises(PermissionError):
            self.service.add_workspace_member(
                "owner-secret", "workspace", "owner-id", "viewer"
            )
        self.assertEqual(
            self.runtime.authorize_resource(
                "owner-id", "workspace", self.agent, "resource.write"
            ),
            (True, "authorized")
        )

    def test_workspace_owner_cannot_remove_themselves(self):
        with self.assertRaises(PermissionError):
            self.service.remove_workspace_member(
                "owner-secret", "workspace", "owner-id"
            )
        self.assertEqual(
            self.runtime.authorize_resource(
                "owner-id", "workspace", self.agent, "resource.write"
            ),
            (True, "authorized")
        )

    def test_service_rejects_escalating_member_role(self):
        self.runtime.register_human("new-member")
        self.auth.credentials["new-member-secret"] = "new-member"
        with self.assertRaises(ValueError):
            self.service.add_workspace_member(
                "owner-secret", "workspace", "new-member", "owner"
            )

    def test_authenticator_must_be_supplied(self):
        with self.assertRaises(ValueError):
            GalinyxService(self.runtime, None)

    def test_authenticator_must_expose_authenticate(self):
        with self.assertRaises(TypeError):
            GalinyxService(self.runtime, object())

    def test_authenticator_cannot_return_empty_principal(self):
        service = GalinyxService(self.runtime, TestAuthenticator({"bad": ""}))
        with self.assertRaises(AuthenticationError):
            service.inspect_agent("bad", "workspace", self.agent)


if __name__ == "__main__":
    unittest.main()

"""Authenticated service integration tests for governed operating tasks.

The authenticator is a deterministic test double, not production authentication.
"""
import unittest

from runtime import Runtime
from service import AuthenticationError, GalinyxService


class TestAuthenticator:
    def __init__(self, credentials):
        self.credentials = credentials

    def authenticate(self, credential):
        if credential not in self.credentials:
            raise ValueError("invalid credential")
        return self.credentials[credential]


class OperatingTaskServiceTests(unittest.TestCase):
    def setUp(self):
        self.runtime = Runtime()
        for principal in ("owner", "editor", "viewer", "other-owner"):
            self.runtime.register_human(principal)
        self.runtime.create_personal_workspace("tenant-a", "owner")
        self.runtime.grant_workspace_membership("tenant-a", "editor", "editor")
        self.runtime.grant_workspace_membership("tenant-a", "viewer", "viewer")
        self.runtime.create_personal_workspace("tenant-b", "other-owner")
        self.auth = TestAuthenticator({
            "owner-token": "owner",
            "editor-token": "editor",
            "viewer-token": "viewer",
            "other-token": "other-owner",
        })
        self.service = GalinyxService(self.runtime, self.auth)

    def tearDown(self):
        self.runtime.close()

    def create_task(self, **overrides):
        args = {
            "credential": "editor-token",
            "tenant_id": "tenant-a",
            "project_id": "blackpine-field",
            "title": "Verify storefront and offer path",
            "assigned_role": "Commerce & Conversion Lead",
            "approval_required": True,
            "priority": "high",
        }
        args.update(overrides)
        return self.service.create_operating_task(**args)

    def test_authenticated_editor_creates_and_actor_is_derived(self):
        task_id = self.create_task()
        task = self.service.get_operating_task("owner-token", "tenant-a", task_id)
        self.assertEqual(task["created_by"], "editor")
        self.assertEqual(task["tenant_id"], "tenant-a")
        self.assertEqual(task["status"], "open")
        self.assertEqual(task["events"][0]["actor_id"], "editor")

    def test_viewer_can_list_and_read_but_not_mutate(self):
        task_id = self.create_task()
        self.assertEqual(len(self.service.list_operating_tasks(
            "viewer-token", "tenant-a"
        )), 1)
        self.assertIsNotNone(self.service.get_operating_task(
            "viewer-token", "tenant-a", task_id
        ))
        with self.assertRaises(PermissionError):
            self.create_task(credential="viewer-token")
        with self.assertRaises(PermissionError):
            self.service.transition_operating_task(
                "viewer-token", "tenant-a", task_id, "in_progress"
            )
        with self.assertRaises(PermissionError):
            self.service.add_operating_task_evidence(
                "viewer-token", "tenant-a", task_id, "url",
                "https://example.test", "viewer cannot add evidence"
            )

    def test_editor_cannot_approve_even_with_valid_credential(self):
        task_id = self.create_task()
        self.service.transition_operating_task(
            "editor-token", "tenant-a", task_id, "in_progress"
        )
        with self.assertRaises(PermissionError):
            self.service.approve_operating_task(
                "editor-token", "tenant-a", task_id, "approved"
            )

    def test_only_authenticated_workspace_owner_can_approve(self):
        task_id = self.create_task()
        self.service.transition_operating_task(
            "editor-token", "tenant-a", task_id, "in_progress"
        )
        approval_id = self.service.approve_operating_task(
            "owner-token", "tenant-a", task_id, "approved", "Reviewed"
        )
        task = self.service.get_operating_task("owner-token", "tenant-a", task_id)
        self.assertEqual(task["approvals"][0]["approver_id"], "owner")
        self.assertEqual(task["approvals"][0]["approval_id"], approval_id)
        self.service.transition_operating_task(
            "editor-token", "tenant-a", task_id, "completed"
        )
        self.assertEqual(
            self.service.get_operating_task("owner-token", "tenant-a", task_id)["status"],
            "completed"
        )

    def test_completion_remains_blocked_until_owner_approval(self):
        task_id = self.create_task()
        self.service.transition_operating_task(
            "editor-token", "tenant-a", task_id, "in_progress"
        )
        with self.assertRaises(PermissionError):
            self.service.transition_operating_task(
                "editor-token", "tenant-a", task_id, "completed"
            )

    def test_cross_tenant_task_access_is_denied(self):
        task_id = self.create_task()
        with self.assertRaises(PermissionError):
            self.service.transition_operating_task(
                "other-token", "tenant-b", task_id, "in_progress"
            )
        with self.assertRaises(PermissionError):
            self.service.add_operating_task_evidence(
                "other-token", "tenant-b", task_id, "url",
                "https://example.test", "cross tenant"
            )
        self.assertIsNone(self.service.get_operating_task(
            "other-token", "tenant-b", task_id
        ))
        self.assertEqual(self.service.list_operating_tasks(
            "other-token", "tenant-b"
        ), [])

    def test_caller_cannot_forge_actor_identity(self):
        with self.assertRaises(TypeError):
            self.service.create_operating_task(
                credential="owner-token", tenant_id="tenant-a",
                project_id="blackpine-field", title="Forged",
                assigned_role="Executive Operations Director",
                created_by="owner"
            )

    def test_invalid_credential_is_rejected(self):
        with self.assertRaises(AuthenticationError):
            self.service.list_operating_tasks("bad-token", "tenant-a")


if __name__ == "__main__":
    unittest.main()

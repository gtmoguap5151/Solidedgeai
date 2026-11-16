import sqlite3
import unittest

from operating_tasks import OperatingTaskRegistry


class OperatingTaskRegistryTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.registry = OperatingTaskRegistry(self.db)
        self.registry.db.execute(
            "INSERT INTO principals(principal_id,principal_type,active,created_at) VALUES ('owner','human',1,'now')"
        )
        self.registry.db.execute(
            "INSERT INTO tenants(tenant_id,tenant_type,owner_principal_id,active,created_at) "
            "VALUES ('tenant','personal','owner',1,'now')"
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def make_task(self, approval_required=False):
        return self.registry.create_task(
            tenant_id="tenant", project_id="blackpine-field", title="Verify storefront",
            assigned_role="Commerce & Conversion Lead", created_by="owner",
            approval_required=approval_required, priority="high"
        )

    def test_create_and_list_task_with_event(self):
        task_id = self.make_task()
        task = self.registry.get_task(task_id)
        self.assertEqual(task["status"], "open")
        self.assertEqual(task["assigned_role"], "Commerce & Conversion Lead")
        self.assertEqual(len(task["events"]), 1)
        self.assertEqual(self.registry.list_tasks(tenant_id="tenant")[0]["task_id"], task_id)

    def test_status_transition_and_evidence_are_recorded(self):
        task_id = self.make_task()
        self.registry.transition(task_id, actor_id="operator", status="in_progress")
        self.registry.add_evidence(
            task_id, submitted_by="operator", evidence_type="url",
            reference="https://example.com/store", note="Storefront checked"
        )
        task = self.registry.get_task(task_id)
        self.assertEqual(task["status"], "in_progress")
        self.assertEqual(task["evidence"][0]["reference"], "https://example.com/store")
        self.assertEqual(len(task["events"]), 3)

    def test_approval_required_blocks_completion_until_approved(self):
        task_id = self.make_task(approval_required=True)
        self.registry.transition(task_id, actor_id="operator", status="in_progress")
        self.registry.transition(task_id, actor_id="operator", status="awaiting_approval")
        with self.assertRaises(PermissionError):
            self.registry.transition(task_id, actor_id="operator", status="completed")
        self.registry.record_approval(
            task_id, approver_id="owner", decision="approved", note="Reviewed evidence"
        )
        self.registry.transition(task_id, actor_id="operator", status="completed")
        self.assertEqual(self.registry.get_task(task_id)["status"], "completed")

    def test_rejected_approval_does_not_allow_completion(self):
        task_id = self.make_task(approval_required=True)
        self.registry.transition(task_id, actor_id="operator", status="in_progress")
        self.registry.record_approval(task_id, approver_id="owner", decision="rejected")
        with self.assertRaises(PermissionError):
            self.registry.transition(task_id, actor_id="operator", status="completed")

    def test_latest_rejection_invalidates_earlier_approval(self):
        task_id = self.make_task(approval_required=True)
        self.registry.transition(task_id, actor_id="operator", status="in_progress")
        self.registry.record_approval(
            task_id, approver_id="owner", decision="approved"
        )
        self.registry.record_approval(
            task_id, approver_id="owner", decision="rejected",
            note="Approval withdrawn after new evidence"
        )
        with self.assertRaises(PermissionError):
            self.registry.transition(task_id, actor_id="operator", status="completed")

    def test_terminal_tasks_cannot_be_reopened(self):
        task_id = self.make_task()
        self.registry.transition(task_id, actor_id="owner", status="cancelled")
        with self.assertRaises(ValueError):
            self.registry.transition(task_id, actor_id="owner", status="open")

    def test_event_records_are_append_only(self):
        task_id = self.make_task()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "UPDATE operating_task_events SET event_type='tampered' WHERE task_id=?",
                (task_id,)
            )


if __name__ == "__main__":
    unittest.main()

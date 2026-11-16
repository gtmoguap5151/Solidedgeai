import unittest
from unittest.mock import patch

from command_console import CommandConsole


class CommandConsoleTests(unittest.TestCase):
    def setUp(self):
        from test_organization_service import AuthenticatedOrganizationServiceTests
        self.fixture = AuthenticatedOrganizationServiceTests("test_service_derives_proposer_identity_from_workload_credential")
        self.fixture.setUp()
        self.console = CommandConsole(self.fixture.service)

    def tearDown(self):
        self.fixture.tearDown()

    def test_snapshot_requires_authenticated_human_root(self):
        with self.assertRaises(PermissionError):
            self.console.snapshot("invalid-token")

    def test_snapshot_is_read_only_and_reports_registered_governance_state(self):
        before = self.fixture.runtime.db.total_changes
        snapshot = self.console.snapshot("owner-token")
        after = self.fixture.runtime.db.total_changes
        self.assertEqual(before, after)
        self.assertTrue(snapshot["read_only"])
        self.assertEqual(snapshot["organization"]["name"], "GALINYX Ventures")
        self.assertEqual(snapshot["organization"]["authority_model"], "human-root/hybrid-enforcement")
        self.assertEqual(len(snapshot["roles"]), 6)
        self.assertEqual(len(snapshot["authority_grants"]), 2)
        self.assertTrue(snapshot["audit"]["hash_chain_valid"])
        self.assertFalse(snapshot["safety"]["external_actions_enabled"])

    def test_snapshot_tracks_pending_and_approved_proposals_without_executing(self):
        proposal = self.fixture.propose()
        before = self.fixture.runtime.db.total_changes
        pending = self.console.snapshot("owner-token")
        self.assertEqual(len(pending["pending_proposals"]), 1)
        self.fixture.service.approve_proposal("owner-token", proposal["proposal_id"])
        approved = self.console.snapshot("owner-token")
        self.assertEqual(len(approved["pending_proposals"]), 0)
        self.assertEqual(len(approved["approved_awaiting_execution"]), 1)
        self.assertEqual(self.fixture.runtime.db.total_changes, before + 2)
        self.assertEqual(approved["approved_awaiting_execution"][0]["state"], "approved")

    def test_snapshot_limit_is_bounded(self):
        with self.assertRaises(ValueError):
            self.console.snapshot("owner-token", limit=0)
        with self.assertRaises(ValueError):
            self.console.snapshot("owner-token", limit=101)

    def test_render_is_plain_text_and_labels_external_actions_disabled(self):
        snapshot = self.console.snapshot("owner-token")
        rendered = CommandConsole.render(snapshot)
        self.assertIn("GOVERNANCE COMMAND CONSOLE", rendered)
        self.assertIn("External actions: DISABLED", rendered)


if __name__ == "__main__":
    unittest.main()

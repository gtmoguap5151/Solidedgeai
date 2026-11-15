import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from authority import AuthorityPolicy


class AuthorityPolicyTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 15, 20, 0, tzinfo=timezone.utc)
        self.policy = AuthorityPolicy(governance_actors={"human-owner"})
        self.policy.register_agent("manager", "manager", "operations")
        self.policy.register_agent("specialist", "specialist", "research")
        self.policy.register_agent("assistant", "assistant", "collection")
        self.root = self.policy.issue_grant(
            "human-owner", "manager",
            actions={"catalog.read", "quote.compare", "purchase.request"},
            resources={"project-7"},
            expires_at=self.now + timedelta(hours=2),
            budget="100",
            max_transaction="500",
            delegable_actions={"catalog.read", "quote.compare"},
            delegation_depth=2,
            approval_required={"purchase.request"},
        )

    def test_rank_does_not_grant_access(self):
        decision = self.policy.authorize(
            "manager", "payroll.read", "payroll", self.now
        )
        self.assertFalse(decision.allowed)

    def test_agent_cannot_promote_itself(self):
        with self.assertRaises(PermissionError):
            self.policy.set_rank("manager", "manager", "executive")
        self.assertEqual(self.policy._agents["manager"].rank, "manager")

    def test_governance_can_change_rank_without_implicitly_changing_grants(self):
        self.policy.set_rank("human-owner", "manager", "executive")
        decision = self.policy.authorize(
            "manager", "payroll.read", "payroll", self.now
        )
        self.assertFalse(decision.allowed)

    def test_delegation_is_attenuated(self):
        child = self.policy.delegate(
            self.root.grant_id, "manager", "specialist",
            actions={"quote.compare"}, resources={"project-7"},
            expires_at=self.now + timedelta(hours=1),
            budget="25", max_transaction="100",
        )
        decision = self.policy.authorize(
            "specialist", "quote.compare", "project-7", self.now, cost="20"
        )
        self.assertTrue(decision.allowed, decision.reason)
        self.assertEqual(decision.grant_id, child.grant_id)
        self.assertFalse(self.policy.authorize(
            "specialist", "purchase.request", "project-7", self.now
        ).allowed)

    def test_delegation_cannot_add_action_or_resource(self):
        with self.assertRaises(PermissionError):
            self.policy.delegate(
                self.root.grant_id, "manager", "specialist",
                actions={"payroll.read"}, resources={"project-7"},
                expires_at=self.now + timedelta(hours=1), budget="10",
            )
        with self.assertRaises(PermissionError):
            self.policy.delegate(
                self.root.grant_id, "manager", "specialist",
                actions={"quote.compare"}, resources={"payroll"},
                expires_at=self.now + timedelta(hours=1), budget="10",
            )

    def test_delegation_cannot_increase_budget_or_transaction_ceiling(self):
        with self.assertRaises(PermissionError):
            self.policy.delegate(
                self.root.grant_id, "manager", "specialist",
                actions={"quote.compare"}, resources={"project-7"},
                expires_at=self.now + timedelta(hours=1), budget="101",
            )
        with self.assertRaises(PermissionError):
            self.policy.delegate(
                self.root.grant_id, "manager", "specialist",
                actions={"quote.compare"}, resources={"project-7"},
                expires_at=self.now + timedelta(hours=1), budget="10",
                max_transaction="501",
            )

    def test_delegation_cannot_outlive_parent_or_remove_approval(self):
        with self.assertRaises(PermissionError):
            self.policy.delegate(
                self.root.grant_id, "manager", "specialist",
                actions={"quote.compare"}, resources={"project-7"},
                expires_at=self.now + timedelta(hours=3), budget="10",
            )
        with self.assertRaises(PermissionError):
            self.policy.delegate(
                self.root.grant_id, "manager", "specialist",
                actions={"purchase.request"}, resources={"project-7"},
                expires_at=self.now + timedelta(hours=1), budget="10",
                approval_required=set(),
            )

    def test_delegation_depth_is_enforced(self):
        child = self.policy.delegate(
            self.root.grant_id, "manager", "specialist",
            actions={"quote.compare"}, resources={"project-7"},
            expires_at=self.now + timedelta(hours=1), budget="10",
        )
        with self.assertRaises(PermissionError):
            self.policy.delegate(
                child.grant_id, "specialist", "assistant",
                actions={"quote.compare"}, resources={"project-7"},
                expires_at=self.now + timedelta(minutes=30), budget="5",
            )

    def test_revoking_parent_invalidates_descendant(self):
        child = self.policy.delegate(
            self.root.grant_id, "manager", "specialist",
            actions={"quote.compare"}, resources={"project-7"},
            expires_at=self.now + timedelta(hours=1), budget="10",
        )
        self.policy.revoke("human-owner", self.root.grant_id)
        decision = self.policy.authorize(
            "specialist", "quote.compare", "project-7", self.now
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason, "no_valid_grant_or_constraint_failed")

    def test_expired_grant_is_denied(self):
        decision = self.policy.authorize(
            "manager", "catalog.read", "project-7",
            self.now + timedelta(hours=2)
        )
        self.assertFalse(decision.allowed)

    def test_budget_is_independent_from_permission(self):
        self.assertFalse(self.policy.authorize(
            "manager", "payroll.read", "project-7", self.now, cost="1"
        ).allowed)
        self.assertFalse(self.policy.authorize(
            "manager", "catalog.read", "project-7", self.now, cost="101"
        ).allowed)

    def test_budget_is_cumulative_and_delegated_spend_counts_against_parent(self):
        child = self.policy.delegate(
            self.root.grant_id, "manager", "specialist",
            actions={"quote.compare"}, resources={"project-7"},
            expires_at=self.now + timedelta(hours=1), budget="25",
        )
        self.assertTrue(self.policy.authorize(
            "specialist", "quote.compare", "project-7", self.now, cost="20"
        ).allowed)
        # The child has only five units left, even though each request is small.
        self.assertFalse(self.policy.authorize(
            "specialist", "quote.compare", "project-7", self.now, cost="6"
        ).allowed)
        # Parent has 80 units left after the delegated spend; a direct request
        # cannot exceed the remaining parent balance.
        self.assertTrue(self.policy.authorize(
            "manager", "catalog.read", "project-7", self.now, cost="80"
        ).allowed)
        self.assertFalse(self.policy.authorize(
            "manager", "catalog.read", "project-7", self.now, cost="1"
        ).allowed)

    def test_required_approval_cannot_be_self_approved(self):
        self.assertFalse(self.policy.authorize(
            "manager", "purchase.request", "project-7", self.now,
            transaction_amount="100", approved_by="manager"
        ).allowed)
        self.assertTrue(self.policy.authorize(
            "manager", "purchase.request", "project-7", self.now,
            transaction_amount="100", approved_by="human-owner"
        ).allowed)

    def test_transaction_ceiling_is_enforced(self):
        self.assertFalse(self.policy.authorize(
            "manager", "purchase.request", "project-7", self.now,
            transaction_amount="501", approved_by="human-owner"
        ).allowed)

    def test_audit_records_policy_version_and_denials(self):
        self.policy.authorize("manager", "catalog.read", "project-7", self.now)
        self.policy.authorize("manager", "unknown.action", "project-7", self.now)
        self.assertTrue(any(
            event["event"] == "authorization.allowed"
            and event["policy_version"] == "ahaf-0.1"
            for event in self.policy.audit
        ))
        self.assertTrue(any(
            event["event"] == "authorization.denied"
            for event in self.policy.audit
        ))

    def test_malformed_time_and_budget_are_rejected(self):
        with self.assertRaises(ValueError):
            self.policy.authorize("manager", "catalog.read", "project-7", "not-a-time")
        with self.assertRaises(ValueError):
            self.policy.authorize("manager", "catalog.read", "project-7", self.now, cost="-1")


if __name__ == "__main__":
    unittest.main()

import unittest

from org_simulation import (
    Actor, CEO, HUMAN_OWNER, authorize, galinyx_ventures_org, simulate_decision
)


class GalinyxVenturesAuthorityTests(unittest.TestCase):
    def setUp(self):
        self.owner = Actor(HUMAN_OWNER, "human_owner")
        self.ceo = Actor(CEO, "ceo")
        self.product = Actor("exec-product", "division_lead", "product-engineering")
        self.commercial = Actor("exec-commercial", "division_lead", "commercial-strategy")

    def test_org_registry_has_human_root_and_simulation_only_mode(self):
        org = galinyx_ventures_org()
        self.assertEqual(org["root_authority"], HUMAN_OWNER)
        self.assertEqual(org["mode"], "simulation-only")

    def test_ceo_cannot_override_human_root(self):
        result = authorize(self.ceo, "policy.activate")
        self.assertFalse(result.allowed)
        self.assertEqual(result.code, "human_root_required")

    def test_ceo_can_coordinate_and_propose(self):
        self.assertTrue(authorize(self.ceo, "strategy.propose").allowed)
        self.assertTrue(authorize(self.ceo, "org.coordinate").allowed)

    def test_division_cannot_cross_scope(self):
        result = authorize(self.product, "market.research", resource_division="commercial-strategy")
        self.assertFalse(result.allowed)
        self.assertEqual(result.code, "cross_division_denied")

    def test_division_cannot_invent_permissions(self):
        result = authorize(self.product, "funds.transfer")
        self.assertFalse(result.allowed)

    def test_high_impact_requires_human_root_or_approval_gate(self):
        result = authorize(self.product, "policy.activate")
        self.assertFalse(result.allowed)
        self.assertTrue(result.requires_human_approval)
        owner_result = authorize(self.owner, "policy.activate")
        self.assertTrue(owner_result.allowed)

    def test_cross_tenant_access_denied(self):
        result = authorize(self.product, "product.plan", tenant_id="another-company")
        self.assertFalse(result.allowed)
        self.assertEqual(result.code, "cross_tenant_denied")

    def test_no_live_external_action_adapter(self):
        for action in ("external.dispatch", "funds.transfer", "publish.live", "delete.production"):
            self.assertFalse(authorize(self.owner, action).allowed)

    def test_simulated_action_has_no_side_effect(self):
        result = simulate_decision(self.product, "product.plan")
        self.assertTrue(result["allowed"])
        self.assertEqual(result["side_effect"], "none")
        self.assertEqual(result["mode"], "simulation-only")


if __name__ == "__main__":
    unittest.main()

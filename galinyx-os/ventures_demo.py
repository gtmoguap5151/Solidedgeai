"""Run from repository root: python galinyx-os/ventures_demo.py"""
from org_simulation import Actor, galinyx_ventures_org, simulate_decision

print("ORG:", galinyx_ventures_org())
ceo = Actor("exec-ceo", "ceo")
product = Actor("exec-product", "division_lead", "product-engineering")
commercial = Actor("exec-commercial", "division_lead", "commercial-strategy")

for actor, action, extra in [
    (ceo, "strategy.propose", {}),
    (ceo, "policy.activate", {}),
    (product, "product.plan", {}),
    (product, "market.research", {"resource_division": "commercial-strategy"}),
    (commercial, "market.research", {}),
    (product, "external.dispatch", {}),
]:
    print(simulate_decision(actor, action, **extra))

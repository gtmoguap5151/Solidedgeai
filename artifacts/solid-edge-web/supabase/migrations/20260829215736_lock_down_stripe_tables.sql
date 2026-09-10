/*
# Lock down Stripe tables from direct browser access

The Stripe tables (stripe_customers, stripe_subscriptions, stripe_orders) are
managed exclusively by the stripe-checkout and stripe-webhook edge functions
which use the service_role key. The browser client should not be able to
INSERT, UPDATE, or DELETE rows directly.

The existing SELECT policies (scoped TO authenticated) remain in place so that
if auth is added later, signed-in users can view their own data through the
views.

1. Security Changes
  - Revoke INSERT, UPDATE, DELETE on stripe_customers from anon + authenticated
  - Revoke INSERT, UPDATE, DELETE on stripe_subscriptions from anon + authenticated
  - Revoke INSERT, UPDATE, DELETE on stripe_orders from anon + authenticated
*/

REVOKE INSERT, UPDATE, DELETE ON stripe_customers FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON stripe_subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON stripe_orders FROM anon, authenticated;

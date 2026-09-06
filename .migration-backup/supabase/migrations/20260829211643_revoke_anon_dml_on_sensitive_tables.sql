/*
# Revoke direct anon/authenticated DML on sensitive tables

All three tables (course_purchases, download_links, email_signups) have RLS
enabled with no policies, which correctly blocks reads/writes. However the
default column-level grants still allow anon and authenticated full DML.
Since all mutations go through SECURITY DEFINER functions or service-role
edge functions, we revoke direct DML to close the surface.

1. Security Changes
  - Revoke SELECT, INSERT, UPDATE, DELETE on course_purchases from anon + authenticated
  - Revoke SELECT, INSERT, UPDATE, DELETE on download_links from anon + authenticated
  - Revoke SELECT, INSERT, UPDATE, DELETE on email_signups from anon + authenticated

2. Notes
  - Edge functions use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS entirely.
  - subscribe_email RPC is SECURITY DEFINER and already has EXECUTE granted to anon.
  - claim_download RPC is SECURITY DEFINER with EXECUTE only on service_role.
*/

REVOKE SELECT, INSERT, UPDATE, DELETE ON course_purchases FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON download_links FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON email_signups FROM anon, authenticated;

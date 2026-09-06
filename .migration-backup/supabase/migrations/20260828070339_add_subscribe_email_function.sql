/*
# Non-enumerable email signup

1. New function
- `subscribe_email(p_email text)` inserts a normalised email and swallows a duplicate via
  ON CONFLICT DO NOTHING, so a new address and an address already on the list produce an
  identical response. Previously the client used an upsert, whose ON CONFLICT DO UPDATE
  path had no UPDATE policy and therefore returned a distinguishable error for addresses
  that were already subscribed.

2. Changes
- Drop the direct INSERT policy `anon_insert_email_signup` on `email_signups`, so the
  browser can no longer write to the table directly and probe it for unique-constraint
  errors. Signups go through the function instead.

3. Security
- SECURITY DEFINER with a fixed empty search_path.
- Rejects malformed addresses and anything over 254 characters server-side.
- Returns void, so it discloses nothing about existing rows.
- EXECUTE granted to anon and authenticated (the public signup form); the table itself
  now has RLS enabled with no policies, so it is otherwise service-role only.
*/

CREATE OR REPLACE FUNCTION subscribe_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := lower(btrim(coalesce(p_email, '')));

  IF length(v_email) = 0 OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'invalid email';
  END IF;

  IF v_email !~ '^[^@[:space:]]+@[^@[:space:].]+(\.[^@[:space:].]+)+$' THEN
    RAISE EXCEPTION 'invalid email';
  END IF;

  INSERT INTO public.email_signups (email)
  VALUES (v_email)
  ON CONFLICT (email) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION subscribe_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION subscribe_email(text) TO anon, authenticated;

DROP POLICY IF EXISTS "anon_insert_email_signup" ON email_signups;

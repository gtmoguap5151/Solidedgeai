-- Harden the public email signup path without exposing signup data.

ALTER TABLE public.email_signups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.email_signups FROM PUBLIC, anon, authenticated;
GRANT INSERT (email) ON TABLE public.email_signups TO anon, authenticated;

DROP POLICY IF EXISTS "public email signup insert" ON public.email_signups;
CREATE POLICY "public email signup insert"
ON public.email_signups
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(email) >= 3
  AND length(email) <= 254
  AND email = lower(btrim(email))
  AND email NOT LIKE '% %'
  AND email LIKE '%_@_%._%'
);

CREATE OR REPLACE FUNCTION public.subscribe_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
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

  BEGIN
    INSERT INTO public.email_signups (email)
    VALUES (v_email);
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.subscribe_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscribe_email(text) TO anon, authenticated, service_role;

-- claim_download intentionally remains SECURITY DEFINER, but browser roles must not call it directly.
REVOKE ALL ON FUNCTION public.claim_download(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_download(uuid) TO service_role;

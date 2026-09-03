/*
# Atomic download claim

1. New function
- `claim_download(p_token uuid)` performs the cap check and the increment in a single
  conditional UPDATE, so concurrent callers cannot all pass a stale `download_count`
  and exceed `max_downloads`.

2. Security
- SECURITY DEFINER with a fixed empty search_path so it cannot be hijacked by a
  caller-controlled schema.
- EXECUTE is granted only to `service_role`. The anon and authenticated roles cannot
  call it; the download edge function (which holds the service-role key) does.
- Returns no rows when the token is unknown, expired, or already at its cap, so the
  caller treats "no row" as refusal.
*/

CREATE OR REPLACE FUNCTION claim_download(p_token uuid)
RETURNS TABLE (
  id uuid,
  token uuid,
  download_count integer,
  max_downloads integer,
  expires_at timestamptz,
  purchase_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.download_links AS dl
     SET download_count = dl.download_count + 1
   WHERE dl.token = p_token
     AND dl.download_count < dl.max_downloads
     AND dl.expires_at > now()
  RETURNING dl.id, dl.token, dl.download_count, dl.max_downloads, dl.expires_at, dl.purchase_id;
$$;

REVOKE ALL ON FUNCTION claim_download(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_download(uuid) FROM anon;
REVOKE ALL ON FUNCTION claim_download(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_download(uuid) TO service_role;

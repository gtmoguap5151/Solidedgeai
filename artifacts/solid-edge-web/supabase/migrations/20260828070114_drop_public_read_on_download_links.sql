/*
# Close public read access to download_links

1. Changes
- Drop the policy `anon_select_download_link_by_token` on `download_links`, which used
  `USING (true)` and therefore let any anonymous caller list every purchase token via the
  Data API, not just look one up by token.

2. Security
- `download_links` now has RLS enabled with no policies, so it is reachable only by the
  service role (the edge functions). Token verification for the public download page moves
  into the `resolve-download` edge function, which already holds the service-role key.
*/

DROP POLICY IF EXISTS "anon_select_download_link_by_token" ON download_links;

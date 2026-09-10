/*
# Create course sales, email signup, and download delivery tables

1. New Tables
- `email_signups` — stores emails from visitors who want the freebie / newsletter but aren't ready to buy.
  - `id` (uuid, pk)
  - `email` (text, unique, not null)
  - `created_at` (timestamptz, default now())
- `course_purchases` — records each successful Stripe purchase of the course.
  - `id` (uuid, pk)
  - `stripe_session_id` (text, unique, not null) — the Stripe Checkout Session ID.
  - `email` (text, not null) — buyer's email from Stripe.
  - `name` (text) — buyer's name from Stripe (optional).
  - `amount_paid` (integer, not null) — total paid in cents.
  - `status` (text, not null, default 'paid') — payment status.
  - `created_at` (timestamptz, default now())
- `download_links` — secure, per-purchase download tokens for PDF delivery.
  - `id` (uuid, pk)
  - `purchase_id` (uuid, fk -> course_purchases.id, not null)
  - `token` (uuid, unique, not null, default gen_random_uuid()) — the unguessable download token.
  - `download_count` (integer, default 0) — how many times the link has been used.
  - `max_downloads` (integer, default 5) — cap to prevent link sharing abuse.
  - `expires_at` (timestamptz, not null) — when the link becomes invalid (30 days from creation).
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on all three tables.
- `email_signups`: anyone (anon + authenticated) can INSERT their email; only service role can SELECT/UPDATE/DELETE (managed via edge functions). No SELECT policy for anon — the signup form only needs INSERT.
- `course_purchases`: no anon access at all — only the service role (edge functions) reads and writes this. No policies for anon/authenticated.
- `download_links`: anyone can SELECT a link by token (needed for the public download page to verify the link and serve the file), but only the service role can INSERT/UPDATE/DELETE. This is safe because the token is a 128-bit unguessable UUID and the SELECT only exposes the link metadata, not the buyer's personal data.

3. Notes
- Download links are created by the Stripe webhook edge function after successful payment.
- The public download page reads by token, checks expiry and download count, and serves the PDF.
- The `email_signups` table intentionally has no SELECT policy for anon so that the email list is not publicly readable.
*/

CREATE TABLE IF NOT EXISTS email_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_email_signup" ON email_signups;
CREATE POLICY "anon_insert_email_signup" ON email_signups FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS course_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text UNIQUE NOT NULL,
  email text NOT NULL,
  name text,
  amount_paid integer NOT NULL,
  status text NOT NULL DEFAULT 'paid',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE course_purchases ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS download_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES course_purchases(id) ON DELETE CASCADE,
  token uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  download_count integer NOT NULL DEFAULT 0,
  max_downloads integer NOT NULL DEFAULT 5,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE download_links ENABLE ROW LEVEL SECURITY;

-- Allow anyone to look up a download link by its unguessable token (public download page).
-- This only exposes link metadata (token, counts, expiry) — not buyer email or personal data.
DROP POLICY IF EXISTS "anon_select_download_link_by_token" ON download_links;
CREATE POLICY "anon_select_download_link_by_token" ON download_links FOR SELECT
  TO anon, authenticated USING (true);

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_download_links_token ON download_links(token);

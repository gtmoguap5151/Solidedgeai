# GALINYX OS — Supabase backend (Phase 2)

Live project: **galinyx**, org "Lead spark 98", Free plan, us-east-1
URL: https://sebcnrlexkcuuyfmigoq.supabase.co
Details: `../phase-2-supabase.md`

## Apply the migration — DONE 2026-11-19 ~08:04 ET

Migration applied via the dashboard SQL Editor (browser task, ran clean, "Success. No rows returned"). All four tables verified live with RLS enabled: profiles (3 policies), projects, memories, tasks (4 policies each). Yield Flow was never opened; no service_role key used. Sign-in went through GitHub — the Supabase sign-in page has no Google button, and the saved email/password was rejected as invalid.

## Dashboard items still open (Phase 2, later slices)

- **Site URL — DONE 2026-11-19 ~08:04 ET:** set to `https://gtmoguap5151.github.io/Solidedgeai/` and verified persisted after reload.
- **Email confirmation** (Authentication → Providers → Email): on by default.
  New accounts must confirm by email before they can sign in. Matt's call
  whether to keep it on (safer) or off (smoother first run).
- **Google sign-in** (Authentication → Providers → Google): needs a Google
  Cloud OAuth client, then the client ID/secret in the dashboard. The app
  does not attempt Google sign-in yet — email only.

## Never

- Never apply anything to the Yield Flow project — it is Rivet Reach's backend.
- Never open, copy, or use the service_role (secret) key in client code.
  The app ships only the publishable key, which is designed for that.

# Phase 3 — AI wiring: Creator Studio → galinyx-ai Worker → Gemini

Date: 2026-11-19. Ordered by Matt Johnson on the voice call (~08:30 ET):
"Go ahead and hook it up." Built the same morning; deploy pending (see below).

## How it works

```
Creator Studio (public static shell)
    │  POST {prompt}  — no key in the shell, ever
    ▼
galinyx-ai Worker (Cloudflare, server-side)
    │  POST with x-goog-api-key header — key from the Worker secret
    ▼
Gemini API (Google Cloud project "galinyx")
```

- Worker code: `workers/galinyx-ai/worker.js` (+ `wrangler.toml`, `test.mjs`).
- Shell client: `galinyx-site/studio-ai.js` (new file; wiring in
  `galinyx-site/STUDIO_AI_PATCH.md` — NOT yet applied to `index.html`,
  because another agent is editing that file for the identity display).
- Worker URL (once deployed): `https://galinyx-ai.gtmoguap5151.workers.dev`
  — endpoints `GET /health` and `POST /generate`.

## Where the key lives

- The Gemini API key ("Gemini API Key", created 2026-11-19 ~08:13 ET in
  Google AI Studio) lives in exactly two places:
  1. Google AI Studio (aistudio.google.com/api-keys), under the "galinyx"
     project — the only place the value can be viewed or copied.
  2. The `GEMINI_API_KEY` secret on the galinyx-ai Worker (set in the
     Cloudflare dashboard or with `wrangler secret put GEMINI_API_KEY`).
- It is NOT in the repo, NOT in the shell, NOT in any workspace file, and
  NOT in any message. The Worker reads it from `env` at request time and
  sends it only in the server-to-server `x-goog-api-key` header. No
  response ever contains it, and the `/health` endpoint reports only
  whether a key is set (`configured: true/false`).

## Whose key pays

- Matt's key, in his Google Cloud project "galinyx"
  (project-e7e19133-5c22-46b3-b90). Free tier, no billing enabled.
- Free-tier limits (Google's published figures for unpaid API keys,
  Flash models only): about **10 requests/minute** and **250 requests/day**,
  counted per project (not per key), resetting at midnight Pacific time.
  Google's live numbers for the project appear in AI Studio's Rate Limit
  view and can vary — one October 2026 reading showed as low as 20/day per
  model, so treat the published figures as the ceiling, not a promise.
- Because no billing is enabled, the key CANNOT be charged: the worst case
  is a 429 (daily limit reached), which the Worker turns into a clean
  "try again tomorrow" message. Enabling Cloud Billing on the project
  would move it to pay-as-you-go — do not do that without Matt's explicit
  word.
- Model: `gemini-3.5-flash` (single constant `MODEL` in `worker.js`, easy
  to swap if Google rotates the free-tier checkpoints).

## Abuse guards (in the Worker)

- **Origin check**: requests from a browser must come from
  `https://gtmoguap5151.github.io`. Requests with no Origin (curl, tests)
  pass through to the key gate.
- **Rate limits**: 10/minute per IP (matches the free tier's RPM ceiling)
  + 60/minute global (protects the daily quota). In-memory per isolate —
  approximate, not exact; the free tier's own limits are the hard backstop.
- **Size caps**: prompts over 8,000 characters are rejected (413);
  Gemini responses are capped at 1,024 output tokens.
- **Clean errors**: the Worker never forwards upstream bodies or status
  details — a Gemini failure becomes a generic 502, a quota hit becomes a
  429 with a "try again tomorrow" message. Nothing about the key ever
  appears in a response.
- **CORS**: `Access-Control-Allow-Origin` is the shell origin only, never `*`.

## Governance fit

- The v1 plan requires generation to be governed by the Core: drafts to
  staging first, nothing live without approval. The Studio's AI draft
  lands in the user's own draft output (local, editable, copyable) — the
  same place the local structured draft lands. It publishes nothing, sends
  nothing anywhere, and spends nothing. Saving it to Project Memory is the
  user's own action, as before.

## Tests

`workers/galinyx-ai/test.mjs` — 16 checks, all passing (2026-11-19):
health with/without key, key gate 503, happy path with mocked Gemini (key
in the upstream header only, never in the URL or response), wrong-Origin
403, oversized/empty prompt, upstream 500 → clean 502 with no body leak,
upstream 429 → daily-limit message, empty candidates → 502, per-IP rate
limit (10 pass, 11th 429), OPTIONS/CORS, 405, 404. Run: `node test.mjs`
from `workers/galinyx-ai/`. No live Gemini call was made — the key was
never fetched or used from this side.

## Deploy status (2026-11-19)

- **NOT deployed yet.** No authenticated Cloudflare route exists in this
  environment: wrangler is not installed, there is no `~/.wrangler` auth
  config, and no `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` is set.
  No sign-in was improvised and no credential was requested.
- **Route ready:** the phone-deploy package is
  `phase-3-phone-deploy.md` — full Worker code + exact dashboard steps
  for Matt to paste it in on his phone and set the `GEMINI_API_KEY`
  secret from AI Studio. After that, Xena applies `STUDIO_AI_PATCH.md`
  and pushes the shell.
- Alternative route (not attempted): `npx wrangler` + an API token with
  Workers:Edit scope — needs a token Matt creates, via the Secure Vault
  flow, not chat.

## What remains

1. Deploy the Worker (phone-deploy package, or wrangler with a token).
2. Set the `GEMINI_API_KEY` secret on the Worker (from AI Studio).
3. Verify `/health` returns `{"ok":true,"configured":true}`.
4. Apply `STUDIO_AI_PATCH.md` to `index.html` + `sw.js` (after the
   identity-display agent finishes), then push the shell (Matt's word).
5. Live end-to-end test: generate a draft in the Studio from the live site.

## Follow-up (later, not in this build)

- **Per-user auth on the Worker**: verify the caller's Supabase JWT in the
  Worker before calling Gemini, so only signed-in GALINYX accounts can
  generate. Needs the Phase 2 session token plumbed through the shell
  client. Until then, the Origin check + rate limits are the guard.
- **Usage visibility**: a daily count (Worker analytics or a KV counter)
  so Matt can see how much of the 250/day quota the Studio is using.

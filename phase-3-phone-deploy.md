# Phase 3 — Phone deploy: galinyx-ai Worker

Date: 2026-11-19. For Matt, on his phone — his Cloudflare session is signed
in there, and the cloud browser cannot sign in to Cloudflare. No key value
appears in this document: the key is copied from AI Studio straight into
the Worker's secret settings, never pasted anywhere else.

## What this deploys

One Cloudflare Worker named `galinyx-ai`, free tier ($0). It takes the
Creator Studio's prompt, calls Gemini with the key held server-side, and
returns the draft. The key never appears in the app or the repo.

## Step 1 — Create the Worker

1. Open the Cloudflare dashboard on your phone → **Workers & Pages**.
2. Tap **Create** → **Create Worker**.
3. Name it exactly: `galinyx-ai`
4. Tap **Deploy** (this creates a placeholder Worker — the code comes next).

## Step 2 — Paste the code

1. Open the new `galinyx-ai` Worker → tap **Edit code** (or the code editor).
2. Select ALL of the placeholder code and delete it.
3. Paste the full code below (the whole block, top to bottom).
4. Tap **Deploy** (or Save and deploy).

```js
/**
 * galinyx-ai — Backend Worker for GALINYX OS Creator Studio (v1 Phase 3).
 *
 * The shell (a public static site) calls this Worker; the Worker calls the
 * Gemini API with the key held server-side. The key NEVER appears in the
 * shell, the repo, or any response.
 *
 * - Key: Cloudflare Worker secret GEMINI_API_KEY (set in the dashboard or
 *   with `wrangler secret put GEMINI_API_KEY`). Never hard-code it here.
 * - Model: gemini-2.5-flash (free tier). Change MODEL below to swap.
 * - Guards: Origin check, per-IP + global rate limits, prompt/output caps,
 *   clean error responses that never forward upstream bodies.
 *
 * Endpoints:
 *   GET  /health    -> {"ok":true,"configured":true|false}
 *   POST /generate  -> {"text":"..."}  (body: {"prompt":"..."})
 */

// ---------------------------------------------------------------- config

const ALLOWED_ORIGIN = 'https://gtmoguap5151.github.io';
const MODEL = 'gemini-2.5-flash';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/' +
  MODEL + ':generateContent';

const MAX_PROMPT_CHARS = 8000;      // hard cap on what the shell may send
const MAX_OUTPUT_TOKENS = 1024;     // cap on what Gemini may return
const TEMPERATURE = 0.7;

const PER_IP_PER_MINUTE = 10;       // matches the free tier's 10 RPM ceiling
const GLOBAL_PER_MINUTE = 60;       // protects the 250/day project quota
const WINDOW_MS = 60_000;

// ------------------------------------------------------- rate limiting
// In-memory, per isolate. Cloudflare runs many isolates, so this is an
// approximate guard, not an exact global counter — the free tier's own
// limits are the hard backstop. Good enough to stop casual abuse.

const windows = new Map(); // key -> { count, resetAt }

function allowRequest(key, limit) {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || now >= entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

// Test-only reset. Cloudflare ignores extra exports.
export function __resetRateLimits() {
  windows.clear();
}

// ------------------------------------------------------------ responses

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

// Error responses are deliberately generic: they never include upstream
// bodies, status details, or anything about the key.
const ERRORS = {
  notFound: () => json({ error: 'Not found.' }, 404),
  methodNotAllowed: () => json({ error: 'Method not allowed.' }, 405),
  forbidden: () => json({ error: 'Forbidden.' }, 403),
  badRequest: (message) => json({ error: message }, 400),
  tooLarge: () =>
    json({ error: 'That idea is too long. Keep it under 8,000 characters.' }, 413),
  rateLimited: () =>
    json(
      { error: 'Too many requests. Wait a minute and try again.' },
      429,
      { 'Retry-After': '60' }
    ),
  notConfigured: () =>
    json(
      { error: 'AI is not configured yet. The owner needs to set the API key.' },
      503
    ),
  upstreamFailed: () =>
    json({ error: 'The AI service could not complete that request.' }, 502),
  dailyLimit: () =>
    json(
      { error: 'The AI daily limit was reached. Try again tomorrow.' },
      429,
      { 'Retry-After': '3600' }
    ),
};

// -------------------------------------------------------------- handler

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Preflight: browsers send this before the real POST.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Health check: tells the shell whether AI is ready. It reports only
    // whether a key is set — never anything about the key itself.
    if (url.pathname === '/health') {
      if (request.method !== 'GET') return ERRORS.methodNotAllowed();
      return json({ ok: true, configured: Boolean(env.GEMINI_API_KEY) });
    }

    if (url.pathname !== '/generate') return ERRORS.notFound();
    if (request.method !== 'POST') return ERRORS.methodNotAllowed();

    // Origin check: a browser always sends Origin on a cross-origin POST.
    // Requests with no Origin (curl, tests) pass through to the key gate.
    const origin = request.headers.get('Origin');
    if (origin && origin !== ALLOWED_ORIGIN) return ERRORS.forbidden();

    // Rate limits, before any paid/free quota is spent.
    const ip =
      request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Forwarded-For') ||
      'unknown';
    if (!allowRequest('ip:' + ip, PER_IP_PER_MINUTE)) return ERRORS.rateLimited();
    if (!allowRequest('global', GLOBAL_PER_MINUTE)) return ERRORS.rateLimited();

    // Body: must be JSON with a non-empty prompt under the cap.
    let body;
    try {
      body = await request.json();
    } catch {
      return ERRORS.badRequest('Send a JSON body with a "prompt" field.');
    }
    const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
    if (!prompt.trim()) {
      return ERRORS.badRequest('Add your idea first.');
    }
    if (prompt.length > MAX_PROMPT_CHARS) return ERRORS.tooLarge();

    // Key gate: without a key the Worker is live but cannot generate.
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) return ERRORS.notConfigured();

    // Call Gemini. The key travels only in this server-to-server header.
    let upstream;
    try {
      upstream = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            temperature: TEMPERATURE,
          },
        }),
      });
    } catch {
      return ERRORS.upstreamFailed();
    }

    if (upstream.status === 429) return ERRORS.dailyLimit();
    if (!upstream.ok) return ERRORS.upstreamFailed();

    let data;
    try {
      data = await upstream.json();
    } catch {
      return ERRORS.upstreamFailed();
    }

    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('')
      : '';
    if (!text.trim()) return ERRORS.upstreamFailed();

    return json({ text });
  },
};
```

## Step 3 — Set the API key secret

1. In the `galinyx-ai` Worker, go to **Settings** → **Variables**.
2. Under **Environment variables**, tap **Add variable**.
3. Name: `GEMINI_API_KEY`
4. Value: copy it from AI Studio — open aistudio.google.com/api-keys,
   find the key named **"Gemini API Key"** under the **galinyx** project,
   tap to copy it, and paste it here. (Do not paste it anywhere else,
   and do not read it aloud or send it in chat.)
5. Mark it **Encrypted** (secret) if the dashboard offers the choice.
6. Save, then **Deploy** again so the Worker picks the secret up.

## Step 4 — Verify it is live

Open this URL in the phone browser:

```
https://galinyx-ai.gtmoguap5151.workers.dev/health
```

You should see:

```json
{"ok":true,"configured":true}
```

- `configured: true` means the Worker is live and the key is set. Tell
  Xena and she wires the Studio up and pushes it.
- `configured: false` means the Worker is live but the key secret is not
  set — repeat Step 3.
- Anything else (an error page, a Cloudflare error) means the deploy did
  not take — check Step 2 pasted the whole code block.

## What NOT to touch

- The other two Workers on the account — `galinyx-blackpine-operator`
  and `galinyx-control-center` — leave them exactly as they are.
- Do not enable billing anywhere. This Worker and the Gemini key are both
  free tier; nothing here should cost anything.

## After this

Once `/health` shows `configured: true`, the remaining steps are Xena's:
apply `STUDIO_AI_PATCH.md` to the shell (script tag + Generate button +
callout text + service-worker cache bump), push the shell, and run a live
end-to-end test from the site.

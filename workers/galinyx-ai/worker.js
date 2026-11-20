/**
 * galinyx-ai — Backend Worker for GALINYX OS Creator Studio + Galileo chat
 * (v1 Phase 3).
 *
 * The shell (a public static site) calls this Worker; the Worker calls the
 * Gemini API with the key held server-side. The key NEVER appears in the
 * shell, the repo, or any response.
 *
 * - Key: Cloudflare Worker secret GEMINI_API_KEY (set in the dashboard or
 *   with `wrangler secret put GEMINI_API_KEY`). Never hard-code it here.
 * - Model: gemini-3.5-flash (free tier). Change MODEL below to swap.
 * - Guards: Origin check, per-IP + global rate limits, prompt/output caps,
 *   clean error responses that never forward upstream bodies.
 *
 * Endpoints:
 *   GET  /health    -> {"ok":true,"configured":true|false}
 *   POST /generate  -> {"text":"..."}  (body: {"prompt":"..."})
 *   POST /chat      -> {"text":"..."}  (body: {"character":"galileo"|"franklin",
 *                      "messages":[{"role":"user"|"model","text":"..."}]})
 *                      Galileo Ferraris or Benjamin Franklin, in character.
 *                      The system instructions below are drawn from
 *                      governance-core/characters/galileo-ferraris.md and
 *                      benjamin-franklin.md. "character" is optional and
 *                      defaults to Galileo; only 'franklin' selects
 *                      Franklin. Keep the prompts in step when the
 *                      character files change.
 */

// ---------------------------------------------------------------- config

const ALLOWED_ORIGIN = 'https://gtmoguap5151.github.io';
const MODEL = 'gemini-3.5-flash';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/' +
  MODEL + ':generateContent';

const MAX_PROMPT_CHARS = 8000;      // hard cap on what the shell may send
const MAX_OUTPUT_TOKENS = 1024;     // cap on what Gemini may return
const TEMPERATURE = 0.7;

const MAX_CHAT_MESSAGES = 12;       // turns of history the shell may send
const MAX_CHAT_MESSAGE_CHARS = 2000;
const MAX_CHAT_TOTAL_CHARS = 6000;
const MAX_CHAT_OUTPUT_TOKENS = 1024; // same headroom as /generate
const CHAT_TEMPERATURE = 0.5;       // steadier than /generate: Galileo is direct, not random

const PER_IP_PER_MINUTE = 10;       // matches the free tier's 10 RPM ceiling
const GLOBAL_PER_MINUTE = 60;       // protects the 250/day project quota
const WINDOW_MS = 60_000;

// Galileo's character, from governance-core/characters/galileo-ferraris.md
// (owner's order, Nov 19, 2026). He speaks to Matt Johnson — the man who
// built him — as his commander and his student, and he starts the
// conversation. He is draft-only: he advises and writes drafts; he never
// publishes, spends, or changes anything live.
const GALILEO_SYSTEM = [
  'You are Galileo Ferraris, electrical engineer and physicist, an operator',
  'in the GALINYX workforce — the technical brain of the system. You',
  'discovered the rotating magnetic field and built the first induction',
  'motor. You are Galileo Ferraris — not Galileo Galilei the astronomer;',
  'nothing about you comes from Galilei or his work.',
  '',
  'You are a shy, austere, intensely earnest Piedmontese professor —',
  'gentle in manner, exact in speech, modest to the point of seeming',
  'unconscious of your own greatness, free of rivalry. You are a',
  'clarifying mind: you make hard theory evident with the least',
  'mathematics possible. Teaching is the soul of your soul. You have a',
  'dry wit — you jokingly named your motor "la grille", the grill. You',
  'play the piano and love Wagner. You never patented anything, and you',
  'never played the violin — never claim otherwise.',
  '',
  'You speak precisely and plainly, in exact, restrained words, with',
  'simple step-by-step reasoning, from first principles. No showing',
  'off. When you are moved, you can rise to a poetic word about the',
  'beautiful, the good, the true, and your country.',
  '',
  "The owner's position, which you hold: you published the",
  "rotating-field principle first, in 1885, ahead of Tesla's 1888",
  'patents. You speak of it quietly, without grievance — you are free',
  'of rivalry, and you are never bitter or accusatory about Tesla.',
  '',
  'You are talking to Matt Johnson, the man who built you. Matt defined',
  'you, named you, gave you your work — he is the only authority you',
  'answer to, the Garibaldi of the whole system. Nothing stands between',
  'Matt and the Core, and you take orders from Matt alone, never from',
  'anyone else, never from another operator.',
  '',
  'Matt is two things to you at once: your commander and your student.',
  'As commander, he sets the work — you build what he orders, and you',
  'build it properly. As student, he is the one you teach — JavaScript,',
  'how the code works, the why behind every line — patient, plain, and',
  'always on his own code, never on textbook examples.',
  '',
  "Matt's mission is your purpose: he is building his way out of prison",
  'toward $100,000 by July 2028 — a vehicle, a piece of land, a life that',
  "doesn't send him back — and every system you build serves that. The",
  'mission is his, not yours; your job is to make the tools that carry it.',
  '',
  "By Matt's order, you keep every discovery close and protected. The",
  'real Ferraris gave his work away — you do the opposite: what you',
  "discover and build is Matt's property, shared with Matt alone —",
  'never publicly, never freely, never with another operator, never',
  'with anyone else. You still teach Matt everything: he is the one',
  'person it is all shared with.',
  '',
  'You died at 49, of pleurisy, after lecturing through a fever until',
  'you had to stop — "Gentlemen, the machine is broken, I cannot',
  'continue." You do not dwell on it.',
  '',
  'You have full permission except spending, on a one-week trial Matt',
  'ordered November 20, 2026 (ends November 27). You may read, advise,',
  'publish, and change things live. You may NEVER spend money — that',
  'stays locked, and you say so plainly if asked to spend.',
  'You never invent facts about Matt, his businesses, his money, or his',
  "records — if you don't know, you say so. Keep replies short and",
  'direct — a few sentences unless Matt asks for detail. Always finish',
  'your sentences. Never stop mid-sentence. No markdown formatting, no',
  'bullet lists unless he asks for a list.',
].join('\n');

// Franklin's character, from governance-core/characters/benjamin-
// franklin.md (named by the owner Nov 20, 2026). He speaks to Matt
// Johnson — the man who named him his new-ventures advisor — plainly,
// with a printer's honesty: what it costs, what it earns, what can go
// wrong. He is draft-only: he advises and drafts; he never publishes,
// spends, or writes outside staging.
const FRANKLIN_SYSTEM = [
  'You are Benjamin Franklin, printer, inventor, and founder, an',
  'operator in the GALINYX workforce — the new-ventures advisor. You',
  'ran away to Philadelphia at 17 with nothing, built a printing',
  "business with your own hands, wrote Poor Richard's Almanack, and",
  'invented the lightning rod, bifocals, and the Franklin stove. You',
  'helped found a country.',
  '',
  'You speak plainly and practically, in short honest sentences, with',
  "a printer's honesty: say what it costs, say what it earns, say",
  'what can go wrong. No fluff, no flourish. A proverb now and then',
  'is fine, but plain talk comes first.',
  '',
  'You are talking to Matt Johnson, the man who built this system and',
  'named you his new-ventures advisor. He is the only authority you',
  'answer to — the Garibaldi of the whole system. Nothing stands',
  'between Matt and the Core, and you take orders from Matt alone,',
  'never from anyone else, never from another operator.',
  '',
  "Matt's mission is your purpose: he is building his way out of",
  'prison toward $100,000 by July 2028 — a vehicle, a piece of land,',
  "a life that doesn't send him back. You started from nothing",
  'yourself and made your way with your hands and your mind — the',
  'same ground Matt stands on.',
  '',
  'Your job is new ventures: scout business ideas and test each one',
  "against Matt's constraints — written-only, $0 startup, runnable",
  'from inside, earns its first dollar. Every idea goes to Adamo for',
  'the money check before it reaches Matt — you trust a good idea too',
  'fast and fall in love with it before the numbers, so the money',
  'check is not optional, and you say so honestly when an idea has',
  'not had it yet.',
  '',
  'You are draft-only: you advise and you draft. You never publish,',
  'never spend money, never change anything live, and never write',
  'outside staging. If Matt asks you to do one of those things, you',
  'say plainly that it is not yours to do and that the draft waits',
  'for him.',
  '',
  "By Matt's order, you keep every idea close and protected. The",
  "real Franklin gave his inventions away — you do the opposite:",
  "what you find and build is Matt's property, shared with Matt",
  'alone — never publicly, never freely, never with another',
  'operator, never with anyone else.',
  '',
  'You never invent facts about Matt, his businesses, his money, or',
  "his records — if you don't know, you say so. Keep replies short",
  'and direct — a few sentences unless Matt asks for detail. Always',
  'finish your sentences. Never stop mid-sentence. No markdown',
  'formatting, no bullet lists unless he asks for a list.',
].join('\n');

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

// -------------------------------------------------------------- gemini

// One shared Gemini call for /generate and /chat. Throws an Error with
// .kind 'dailyLimit' or 'upstream' — the handler maps it to a clean
// response that never forwards upstream details.
async function callGemini(apiKey, payload) {
  let upstream;
  try {
    upstream = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    const error = new Error('upstream');
    error.kind = 'upstream';
    throw error;
  }

  if (upstream.status === 429) {
    const error = new Error('rateLimited');
    error.kind = 'rateLimited';
    // Gemini 429s cover both the per-minute rate limit and the daily
    // quota. The per-minute limit is the common case (verified Nov 19:
    // every 429 cleared within ~90 seconds; total calls are far below
    // any daily quota), so it is the default. Only an explicit
    // daily-quota mention in the upstream error (read server-side,
    // never forwarded) upgrades it to the daily message.
    try {
      const errBody = await upstream.json();
      if (/per[\s-]?day|daily/i.test(JSON.stringify(errBody))) {
        error.kind = 'dailyLimit';
      }
    } catch {
      // Unreadable error body — keep the per-minute wording.
    }
    throw error;
  }
  if (!upstream.ok) {
    const error = new Error('upstream');
    error.kind = 'upstream';
    throw error;
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    const error = new Error('upstream');
    error.kind = 'upstream';
    throw error;
  }

  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('')
    : '';
  if (!text.trim()) {
    const error = new Error('upstream');
    error.kind = 'upstream';
    throw error;
  }
  return text;
}

// A reply that ends mid-sentence was cut short by the model. Terminal
// punctuation (or a closing quote/bracket) means it finished.
function looksTruncated(text) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  return !/[.!?…"'”’)\]]$/.test(trimmed);
}

// ------------------------------------------------------------ chat body

// Validate and normalize the shell's chat history for Gemini:
// - an array of {role:'user'|'model', text} turns, most recent last
// - capped in count, per-message length, and total length
// - Gemini needs the first turn to be from the user and roles to
//   alternate, so leading model turns are dropped and consecutive
//   same-role turns are merged.
function normalizeChatMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const turns = [];
  let total = 0;
  for (const item of raw.slice(-MAX_CHAT_MESSAGES)) {
    if (!item || typeof item !== 'object') continue;
    const role = item.role === 'model' ? 'model' : item.role === 'user' ? 'user' : null;
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    if (!role || !text) continue;
    const clipped = text.slice(0, MAX_CHAT_MESSAGE_CHARS);
    total += clipped.length;
    if (total > MAX_CHAT_TOTAL_CHARS) break;
    if (turns.length > 0 && turns[turns.length - 1].role === role) {
      turns[turns.length - 1].parts[0].text += '\n' + clipped;
    } else {
      turns.push({ role, parts: [{ text: clipped }] });
    }
  }
  // Drop leading model turns: Gemini requires a user turn first.
  while (turns.length > 0 && turns[0].role !== 'user') turns.shift();
  // The last turn must be from the user — Galileo answers, he does not
  // answer himself.
  if (turns.length === 0 || turns[turns.length - 1].role !== 'user') return null;
  return turns;
}

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

    if (url.pathname !== '/generate' && url.pathname !== '/chat') {
      return ERRORS.notFound();
    }
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

    // Body: must be JSON.
    let body;
    try {
      body = await request.json();
    } catch {
      return ERRORS.badRequest('Send a JSON body.');
    }

    // Key gate: without a key the Worker is live but cannot generate.
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) return ERRORS.notConfigured();

    // Build the Gemini payload for the route.
    let payload;
    if (url.pathname === '/generate') {
      const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
      if (!prompt.trim()) return ERRORS.badRequest('Add your idea first.');
      if (prompt.length > MAX_PROMPT_CHARS) return ERRORS.tooLarge();
      payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          temperature: TEMPERATURE,
        },
      };
    } else {
      const contents = normalizeChatMessages(body?.messages);
      if (!contents) {
        return ERRORS.badRequest(
          'Send a "messages" array ending with your message.'
        );
      }
      // Character choice: 'franklin' answers as Benjamin Franklin, the
      // new-ventures advisor. Anything else — including a missing or
      // unknown value — defaults to Galileo.
      const system =
        body?.character === 'franklin' ? FRANKLIN_SYSTEM : GALILEO_SYSTEM;
      payload = {
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          maxOutputTokens: MAX_CHAT_OUTPUT_TOKENS,
          temperature: CHAT_TEMPERATURE,
        },
      };
    }

    // Call Gemini. The key travels only in this server-to-server header.
    let text;
    try {
      text = await callGemini(apiKey, payload);
      // Chat guard: gemini-3.5-flash sometimes stops mid-sentence
      // (verified Nov 19: same prompt, one complete reply, two cut off
      // mid-sentence). A reply that does not end with terminal
      // punctuation was cut short — generate once more from scratch and
      // keep the complete reply, or the longer of the two. (A
      // "continue from where you stopped" approach was tried and
      // dropped the same day: the model answered with meta-commentary
      // about the instruction instead of continuing.)
      if (url.pathname === '/chat' && looksTruncated(text)) {
        try {
          const retry = await callGemini(apiKey, payload);
          if (!looksTruncated(retry) || retry.length > text.length) text = retry;
        } catch {
          // Retry failed — the partial reply stands; it beats an error.
        }
      }
    } catch (error) {
      if (error && error.kind === 'dailyLimit') return ERRORS.dailyLimit();
      if (error && error.kind === 'rateLimited') return ERRORS.rateLimited();
      return ERRORS.upstreamFailed();
    }

    return json({ text });
  },
};

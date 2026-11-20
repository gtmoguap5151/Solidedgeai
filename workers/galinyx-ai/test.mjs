// Local tests for the galinyx-ai Worker. No real key, no live Gemini call:
// global fetch is stubbed with a mock. Run: node test.mjs
import worker, { __resetRateLimits, __resetAuthCache } from './worker.js';

const ORIGIN = 'https://gtmoguap5151.github.io';
const FAKE_KEY = 'test-key-not-real'; // fake value for tests only, never a real key
const AUTH_TOKEN = 'test-token-not-real';
const SB_AUTH_URL = 'https://sebcnrlexkcuuyfmigoq.supabase.co/auth/v1/user';

let passed = 0;
let failed = 0;
const results = [];

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    results.push(`PASS ${name}`);
  } else {
    failed += 1;
    results.push(`FAIL ${name}${detail ? ' — ' + detail : ''}`);
  }
}

// Mock Gemini + mock Supabase Auth: the Worker verifies every /generate
// and /chat token against the Auth API, so the mock routes that URL to a
// canned user (or a 401 when mockAuth is 'invalid') and everything else
// to the canned Gemini reply.
let mockMode = 'ok'; // ok | error500 | rate429 | empty
let mockAuth = 'valid'; // valid | invalid
let lastUpstream = null;
let lastAuthCheck = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const urlStr = String(url);
  if (urlStr.startsWith(SB_AUTH_URL)) {
    lastAuthCheck = { url: urlStr, init };
    if (mockAuth === 'invalid') {
      return new Response(JSON.stringify({ msg: 'invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({ id: 'test-user-id', email: 'test@example.com' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  lastUpstream = { url: urlStr, init };
  if (mockMode === 'error500') {
    return new Response(
      JSON.stringify({ error: { message: 'INTERNAL SECRET DETAILS 12345' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (mockMode === 'rate429') {
    // Message mentions the daily quota, so the Worker upgrades the 429
    // to the daily-limit wording (a plain 'quota' 429 stays per-minute).
    return new Response(JSON.stringify({ error: { message: 'daily quota exceeded' } }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (mockMode === 'empty') {
    return new Response(JSON.stringify({ candidates: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(
    JSON.stringify({
      candidates: [
        { content: { parts: [{ text: 'MOCK DRAFT: The Hollow Mountain.' }] } },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

const req = (path, opts = {}) =>
  new Request('https://galinyx-ai.test' + path, opts);
const postGenerate = (body, headers = {}) =>
  req('/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      Authorization: 'Bearer ' + AUTH_TOKEN,
      ...headers,
    },
    body: JSON.stringify(body),
  });

// 1. Health, no key configured
{
  __resetRateLimits();
  const res = await worker.fetch(req('/health'), {});
  const data = await res.json();
  check('health without key -> 200 configured:false', res.status === 200 && data.ok === true && data.configured === false);
}

// 2. Health, key configured (reports only that a key exists, never the key)
{
  const res = await worker.fetch(req('/health'), { GEMINI_API_KEY: FAKE_KEY });
  const data = await res.json();
  const raw = JSON.stringify(data);
  check('health with key -> configured:true, key not in body', res.status === 200 && data.configured === true && !raw.includes(FAKE_KEY));
}

// 3. Generate with no key -> clean 503, no leak
{
  __resetRateLimits();
  const res = await worker.fetch(postGenerate({ prompt: 'hello' }), {});
  const data = await res.json();
  check('generate without key -> 503 clean error', res.status === 503 && typeof data.error === 'string' && data.error.includes('not configured'));
}

// 4. Generate happy path: mocked Gemini, key sent only in upstream header
{
  __resetRateLimits();
  mockMode = 'ok';
  lastUpstream = null;
  const res = await worker.fetch(postGenerate({ prompt: 'a mountain story' }), { GEMINI_API_KEY: FAKE_KEY });
  const data = await res.json();
  const upstreamKey = lastUpstream?.init?.headers?.['x-goog-api-key'];
  const upstreamUrl = lastUpstream?.url || '';
  check(
    'generate happy path -> 200 with text, key in header only',
    res.status === 200 &&
      data.text === 'MOCK DRAFT: The Hollow Mountain.' &&
      upstreamKey === FAKE_KEY &&
      !upstreamUrl.includes(FAKE_KEY) &&
      !JSON.stringify(data).includes(FAKE_KEY)
  );
}

// 5. Wrong Origin -> 403
{
  __resetRateLimits();
  const res = await worker.fetch(
    postGenerate({ prompt: 'hi' }, { Origin: 'https://evil.example.com' }),
    { GEMINI_API_KEY: FAKE_KEY }
  );
  check('wrong Origin -> 403', res.status === 403);
}

// 6. No Origin (curl) passes the origin check and reaches the key gate
{
  __resetRateLimits();
  __resetAuthCache();
  const r = req('/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + AUTH_TOKEN,
    },
    body: JSON.stringify({ prompt: 'hi' }),
  });
  const res = await worker.fetch(r, {});
  check('no Origin -> passes origin check (503 key gate, not 403)', res.status === 503);
}

// 7. Oversized prompt -> 413
{
  __resetRateLimits();
  const res = await worker.fetch(postGenerate({ prompt: 'x'.repeat(8001) }), { GEMINI_API_KEY: FAKE_KEY });
  check('oversized prompt -> 413', res.status === 413);
}

// 8. Empty prompt -> 400
{
  __resetRateLimits();
  const res = await worker.fetch(postGenerate({ prompt: '   ' }), { GEMINI_API_KEY: FAKE_KEY });
  check('empty prompt -> 400', res.status === 400);
}

// 9. Upstream 500 -> 502, upstream body never forwarded
{
  __resetRateLimits();
  mockMode = 'error500';
  const res = await worker.fetch(postGenerate({ prompt: 'hi' }), { GEMINI_API_KEY: FAKE_KEY });
  const raw = await res.text();
  check('upstream 500 -> 502, no upstream body leaked', res.status === 502 && !raw.includes('SECRET DETAILS') && !raw.includes('12345'));
  mockMode = 'ok';
}

// 10. Upstream 429 -> 429 daily-limit message
{
  __resetRateLimits();
  mockMode = 'rate429';
  const res = await worker.fetch(postGenerate({ prompt: 'hi' }), { GEMINI_API_KEY: FAKE_KEY });
  const data = await res.json();
  check('upstream 429 -> 429 daily limit message', res.status === 429 && data.error.includes('daily limit'));
  mockMode = 'ok';
}

// 11. Empty candidates -> 502
{
  __resetRateLimits();
  mockMode = 'empty';
  const res = await worker.fetch(postGenerate({ prompt: 'hi' }), { GEMINI_API_KEY: FAKE_KEY });
  check('empty candidates -> 502', res.status === 502);
  mockMode = 'ok';
}

// 12. Rate limit: 10 per IP per minute, 11th is 429
{
  __resetRateLimits();
  let statuses = [];
  for (let i = 0; i < 11; i++) {
    const res = await worker.fetch(postGenerate({ prompt: 'hi ' + i }), { GEMINI_API_KEY: FAKE_KEY });
    statuses.push(res.status);
  }
  check(
    'per-IP rate limit: first 10 pass, 11th is 429',
    statuses.slice(0, 10).every((s) => s === 200) && statuses[10] === 429,
    'got ' + statuses.join(',')
  );
}

// 13. OPTIONS preflight -> 204 with CORS headers
{
  const res = await worker.fetch(req('/generate', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), {});
  check(
    'OPTIONS -> 204 with CORS allow-origin',
    res.status === 204 && res.headers.get('Access-Control-Allow-Origin') === ORIGIN
  );
}

// 14. GET on /generate -> 405
{
  const res = await worker.fetch(req('/generate'), {});
  check('GET /generate -> 405', res.status === 405);
}

// 15. Unknown path -> 404
{
  const res = await worker.fetch(req('/nope'), {});
  check('unknown path -> 404', res.status === 404);
}

// 16. CORS header on a real response is the shell origin only, never *
{
  __resetRateLimits();
  const res = await worker.fetch(postGenerate({ prompt: 'hi' }), { GEMINI_API_KEY: FAKE_KEY });
  check(
    'CORS allow-origin is the shell origin, not *',
    res.headers.get('Access-Control-Allow-Origin') === ORIGIN
  );
}

const postChat = (body, headers = {}) =>
  req('/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      Authorization: 'Bearer ' + AUTH_TOKEN,
      ...headers,
    },
    body: JSON.stringify(body),
  });
const upstreamSystem = () => {
  try {
    const payload = JSON.parse(lastUpstream?.init?.body || '{}');
    return payload.systemInstruction?.parts?.[0]?.text || '';
  } catch {
    return '';
  }
};

// 17. Chat with character 'franklin' -> Franklin's system instruction
{
  __resetRateLimits();
  mockMode = 'ok';
  lastUpstream = null;
  const res = await worker.fetch(
    postChat({ character: 'franklin', messages: [{ role: 'user', text: 'What venture should I start?' }] }),
    { GEMINI_API_KEY: FAKE_KEY }
  );
  const system = upstreamSystem();
  check(
    'chat character franklin -> Franklin system prompt, draft-only',
    res.status === 200 && system.includes('Benjamin Franklin') && system.includes('draft-only'),
    'system starts: ' + system.slice(0, 60)
  );
}

// 18. Chat with no character -> defaults to Galileo
{
  __resetRateLimits();
  lastUpstream = null;
  const res = await worker.fetch(
    postChat({ messages: [{ role: 'user', text: 'Hello' }] }),
    { GEMINI_API_KEY: FAKE_KEY }
  );
  const system = upstreamSystem();
  check(
    'chat no character -> defaults to Galileo',
    res.status === 200 && system.includes('Galileo Ferraris'),
    'system starts: ' + system.slice(0, 60)
  );
}

// 19. Chat with unknown character -> defaults to Galileo (fail closed)
{
  __resetRateLimits();
  lastUpstream = null;
  const res = await worker.fetch(
    postChat({ character: 'tesla', messages: [{ role: 'user', text: 'Hello' }] }),
    { GEMINI_API_KEY: FAKE_KEY }
  );
  const system = upstreamSystem();
  check(
    'chat unknown character -> defaults to Galileo',
    res.status === 200 && system.includes('Galileo Ferraris'),
    'system starts: ' + system.slice(0, 60)
  );
}

// 20. No token -> 401, no Gemini call
{
  __resetRateLimits();
  __resetAuthCache();
  lastUpstream = null;
  const r = req('/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ prompt: 'hi' }),
  });
  const res = await worker.fetch(r, { GEMINI_API_KEY: FAKE_KEY });
  check(
    'no token -> 401, no Gemini call',
    res.status === 401 && lastUpstream === null,
    'got ' + res.status
  );
}

// 21. Invalid token -> 401, no Gemini call
{
  __resetRateLimits();
  __resetAuthCache();
  mockAuth = 'invalid';
  lastUpstream = null;
  const res = await worker.fetch(
    postGenerate({ prompt: 'hi' }, { Authorization: 'Bearer bad-token-not-real' }),
    { GEMINI_API_KEY: FAKE_KEY }
  );
  mockAuth = 'valid';
  check(
    'invalid token -> 401, no Gemini call',
    res.status === 401 && lastUpstream === null,
    'got ' + res.status
  );
}

// 22. Valid token -> Auth API called with apikey + Bearer headers
{
  __resetRateLimits();
  __resetAuthCache();
  lastAuthCheck = null;
  const res = await worker.fetch(postGenerate({ prompt: 'hi' }), { GEMINI_API_KEY: FAKE_KEY });
  const authHeaders = lastAuthCheck?.init?.headers || {};
  check(
    'valid token -> Auth API verified with apikey + Bearer',
    res.status === 200 &&
      lastAuthCheck !== null &&
      typeof authHeaders.apikey === 'string' &&
      authHeaders.apikey.length > 0 &&
      authHeaders.Authorization === 'Bearer ' + AUTH_TOKEN,
    'auth check: ' + JSON.stringify(lastAuthCheck)
  );
}

// 23. Chat with no token -> 401
{
  __resetRateLimits();
  __resetAuthCache();
  const r = req('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ messages: [{ role: 'user', text: 'Hello' }] }),
  });
  const res = await worker.fetch(r, { GEMINI_API_KEY: FAKE_KEY });
  check('chat no token -> 401', res.status === 401, 'got ' + res.status);
}

// ------------------------------------------------------------ trained brain
// The Workers AI binding is mocked here: env.AI.run records its call
// and returns a canned trained reply. No live Workers AI call.

let lastAIRun = null;
const mockAI = {
  run: async (model, opts) => {
    lastAIRun = { model, opts };
    return { response: 'MOCK TRAINED: I have no telescope, Matt.' };
  },
};
const envWithAI = { GEMINI_API_KEY: FAKE_KEY, AI: mockAI };

// 24. Health reports trained:true with the AI binding, false without
{
  const withAI = await worker.fetch(req('/health'), envWithAI);
  const withAIData = await withAI.json();
  const withoutAI = await worker.fetch(req('/health'), { GEMINI_API_KEY: FAKE_KEY });
  const withoutAIData = await withoutAI.json();
  check(
    'health trained flag follows the AI binding',
    withAIData.trained === true && withoutAIData.trained === false,
    'with AI: ' + withAIData.trained + ', without: ' + withoutAIData.trained
  );
}

// 25. Chat brain:'galinyx' -> Workers AI with the run-5 LoRA, no Gemini call
{
  __resetRateLimits();
  lastUpstream = null;
  lastAIRun = null;
  const res = await worker.fetch(
    postChat({ brain: 'galinyx', messages: [{ role: 'user', text: 'Where do you keep your telescope?' }] }),
    envWithAI
  );
  const data = await res.json();
  const msgs = lastAIRun?.opts?.messages || [];
  check(
    'chat brain galinyx -> trained path, lora model + finetune, no Gemini',
    res.status === 200 &&
      data.brain === 'galinyx' &&
      data.text === 'MOCK TRAINED: I have no telescope, Matt.' &&
      lastAIRun?.model === '@cf/mistral/mistral-7b-instruct-v0.2-lora' &&
      lastAIRun?.opts?.lora === 'a158ef52-d47e-4abf-bc5e-dcfb3a0f2cff' &&
      msgs[0]?.role === 'system' &&
      msgs[0]?.content.includes('Galileo Ferraris') &&
      msgs[1]?.role === 'user' &&
      msgs[1]?.content === 'Where do you keep your telescope?' &&
      lastUpstream === null,
    'data: ' + JSON.stringify(data) + ', aiRun: ' + JSON.stringify(lastAIRun)
  );
}

// 26. Chat brain:'galinyx' + character:'franklin' -> falls back to Gemini
{
  __resetRateLimits();
  lastUpstream = null;
  lastAIRun = null;
  const res = await worker.fetch(
    postChat({ brain: 'galinyx', character: 'franklin', messages: [{ role: 'user', text: 'What venture should I start?' }] }),
    envWithAI
  );
  const data = await res.json();
  const system = upstreamSystem();
  check(
    'chat brain galinyx + franklin -> Gemini fallback, Franklin system',
    res.status === 200 &&
      data.brain === 'gemini' &&
      lastAIRun === null &&
      lastUpstream !== null &&
      system.includes('Benjamin Franklin'),
    'data: ' + JSON.stringify(data)
  );
}

// 27. Chat brain:'galinyx' with no AI binding -> falls back to Gemini
{
  __resetRateLimits();
  lastUpstream = null;
  lastAIRun = null;
  const res = await worker.fetch(
    postChat({ brain: 'galinyx', messages: [{ role: 'user', text: 'Hello' }] }),
    { GEMINI_API_KEY: FAKE_KEY }
  );
  const data = await res.json();
  check(
    'chat brain galinyx without binding -> Gemini fallback',
    res.status === 200 && data.brain === 'gemini' && lastAIRun === null && lastUpstream !== null,
    'data: ' + JSON.stringify(data)
  );
}

// 28. Chat brain:'galinyx' with AI binding but NO Gemini key -> trained path, no 503
{
  __resetRateLimits();
  lastUpstream = null;
  lastAIRun = null;
  const res = await worker.fetch(
    postChat({ brain: 'galinyx', messages: [{ role: 'user', text: 'Hello' }] }),
    { AI: mockAI }
  );
  const data = await res.json();
  check(
    'chat brain galinyx without Gemini key -> trained path still answers',
    res.status === 200 && data.brain === 'galinyx' && lastAIRun !== null && lastUpstream === null,
    'got ' + res.status + ' ' + JSON.stringify(data)
  );
}

// 29. Chat with no brain + AI binding present -> Gemini default, no AI call
{
  __resetRateLimits();
  lastUpstream = null;
  lastAIRun = null;
  const res = await worker.fetch(
    postChat({ messages: [{ role: 'user', text: 'Hello' }] }),
    envWithAI
  );
  const data = await res.json();
  check(
    'chat no brain -> Gemini default even with binding present',
    res.status === 200 && data.brain === 'gemini' && lastAIRun === null && lastUpstream !== null,
    'data: ' + JSON.stringify(data)
  );
}

globalThis.fetch = realFetch;

console.log(results.join('\n'));
console.log(`\n${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exit(1);

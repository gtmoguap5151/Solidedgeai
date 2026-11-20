// Local tests for the galinyx-ai Worker. No real key, no live Gemini call:
// global fetch is stubbed with a mock. Run: node test.mjs
import worker, { __resetRateLimits } from './worker.js';

const ORIGIN = 'https://gtmoguap5151.github.io';
const FAKE_KEY = 'test-key-not-real'; // fake value for tests only, never a real key

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

// Mock Gemini: captures the upstream request, returns canned text.
let mockMode = 'ok'; // ok | error500 | rate429 | empty
let lastUpstream = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  lastUpstream = { url, init };
  if (mockMode === 'error500') {
    return new Response(
      JSON.stringify({ error: { message: 'INTERNAL SECRET DETAILS 12345' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (mockMode === 'rate429') {
    return new Response(JSON.stringify({ error: { message: 'quota' } }), {
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
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
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
  const r = req('/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
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

globalThis.fetch = realFetch;

console.log(results.join('\n'));
console.log(`\n${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exit(1);

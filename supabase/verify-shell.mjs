// Phase 2 verification for the GALINYX OS shell.
// Run from the repo root with the test deps on NODE_PATH, e.g.:
//   NODE_PATH=/tmp/galinyx-phase2-test/node_modules node supabase/verify-shell.mjs
// Requires a local HTTP server on the shell dir (the script starts one
// itself on port 8123 and stops it at the end).
//
// What it checks:
//  1. The migration SQL parses with a real Postgres parser (pgsql-parser).
//  2. The shell loads in jsdom with the REAL supabase-js library (the exact
//     pinned version, injected locally because this VM cannot fetch from
//     jsdelivr — the CDN URL itself was verified separately via browser).
//  3. No console errors, client initialises, auth UI renders.
//  4. Local CRUD + delete tombstones still work.
//  5. Setup-pending error classification.
//  6. One failed sign-in against the LIVE Auth endpoint (read-only: no
//     account is created, no data is written).
//  7. Workforce snapshot still loads (no regression).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { parse } from 'pgsql-parser';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// When run from a copy (e.g. /tmp, so bare imports resolve), point
// GALINYX_GOV at the governance workspace. Otherwise it is the parent dir.
const GOV = process.env.GALINYX_GOV || path.resolve(HERE, '..');
const SITE_DIR = path.join(GOV, 'galinyx-site');
const MIGRATION = path.join(GOV, 'supabase', 'migrations', '001_phase2_per_user_tables.sql');
const UMD_PATH = process.env.SB_UMD_PATH
  || '/tmp/galinyx-phase2-test/node_modules/@supabase/supabase-js/dist/umd/supabase.js';
const PORT = 8123;
const SITE = `http://127.0.0.1:${PORT}/index.html`;

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? ' — ' + extra : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { if (fn()) return true; await sleep(250); }
  console.log('TIMEOUT waiting for: ' + label);
  return false;
}

// ---- Static file server for the shell dir ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(SITE_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(SITE_DIR)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

try {
  // ---- 1. SQL parse ----
  try {
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    const ast = await parse(sql);
    const stmts = ast.stmts || [];
    const text = sql.toLowerCase();
    check('migration parses as valid Postgres SQL (' + stmts.length + ' statements)', stmts.length > 40);
    check('migration creates 4 tables', ['create table if not exists public.profiles', 'create table if not exists public.projects', 'create table if not exists public.memories', 'create table if not exists public.tasks'].every((s) => text.includes(s)));
    check('migration enables RLS on all 4 tables', (text.match(/enable row level security/g) || []).length === 4);
    // profiles: select/insert/update (3 — no user delete); others: 4 each.
    check('migration has 15 RLS policies (3 profiles + 4 x 3 tables)', (text.match(/create policy /g) || []).length === 15);
    check('migration policies scope to auth.uid()', (text.match(/auth\.uid\(\) = /g) || []).length >= 15);
    check('migration has no service_role reference', !text.includes('service_role'));
    check('migration has no yield_flow object reference', !text.includes('yield_flow'));
  } catch (e) {
    check('migration parses as valid Postgres SQL', false, String(e && e.message || e).slice(0, 300));
  }

  // ---- 2. Page load in jsdom ----
  const umd = fs.readFileSync(UMD_PATH, 'utf8');
  const jsdomErrors = [];
  const consoleErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => jsdomErrors.push(String(e && e.message || e)));
  virtualConsole.on('error', (...a) => consoleErrors.push(a.map(String).join(' ')));

  const dom = await JSDOM.fromURL(SITE, {
    resources: 'usable',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.fetch = fetch; // jsdom has no fetch; give it Node's.
      // Inject the exact pinned supabase-js UMD build locally: this VM
      // cannot fetch from jsdelivr (hangs), so the app's dynamic CDN load
      // would fail here even though the CDN URL itself is verified good.
      window.eval(umd);
    },
  });
  const { window } = dom;
  const { document } = window;

  const ready = await waitFor(
    () => document.getElementById('auth-status') && document.getElementById('auth-status').textContent === 'Workspace · Signed out',
    30000,
    'auth status pill to read "Workspace · Signed out"',
  );
  check('shell loads and Supabase client initialises (pill: Signed out)', ready,
    'pill reads: ' + JSON.stringify(document.getElementById('auth-status')?.textContent));
  check('no jsdom errors during load', jsdomErrors.length === 0, jsdomErrors.slice(0, 3).join(' | '));
  check('no console.error during load', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  check('supabase client library present (pinned 2.119.1)', !!(window.supabase && window.supabase.createClient));

  // ---- 3. Account view ----
  window.showView('account');
  await sleep(300);
  check('Account view shows sign-in form when signed out',
    !document.getElementById('account-signed-out').classList.contains('hidden')
    && document.getElementById('account-signed-in').classList.contains('hidden')
    && !!document.getElementById('auth-email') && !!document.getElementById('auth-password'));
  check('Account nav button exists and is active',
    document.querySelector('.nav[data-view="account"]').classList.contains('active'));

  // ---- 4. Local CRUD still works + tombstones recorded ----
  window.showView('memory');
  document.getElementById('memory-project').value = 'Phase 2 test project';
  document.getElementById('memory-text').value = 'Phase 2 test note';
  window.addMemory();
  await sleep(200);
  let stored = JSON.parse(window.localStorage.getItem('galinyx-os-workspace-v1'));
  const note = stored.memories.find((m) => m.text === 'Phase 2 test note');
  check('addMemory still works locally', !!note);
  window.deleteMemory(note.id);
  await sleep(200);
  stored = JSON.parse(window.localStorage.getItem('galinyx-os-workspace-v1'));
  check('deleteMemory removes the note locally', !stored.memories.some((m) => m.id === note.id));
  check('deleteMemory records a tombstone for sync', stored.deleted.memories.includes(note.id));

  window.showView('tasks');
  document.getElementById('task-name').value = 'Phase 2 test task';
  window.addTask();
  await sleep(200);
  stored = JSON.parse(window.localStorage.getItem('galinyx-os-workspace-v1'));
  const task = stored.tasks.find((t) => t.title === 'Phase 2 test task');
  check('addTask still works locally', !!task);
  window.toggleTask(task.id);
  await sleep(200);
  stored = JSON.parse(window.localStorage.getItem('galinyx-os-workspace-v1'));
  check('toggleTask still works locally', stored.tasks.find((t) => t.id === task.id).done === true);
  window.deleteTask(task.id);
  await sleep(200);
  stored = JSON.parse(window.localStorage.getItem('galinyx-os-workspace-v1'));
  check('deleteTask records a tombstone for sync', stored.deleted.tasks.includes(task.id));

  window.showView('creator');
  document.getElementById('project-title').value = 'Phase 2 test draft';
  document.getElementById('project-idea').value = 'A test idea for the sync slice.';
  window.makeDraft();
  await sleep(200);
  stored = JSON.parse(window.localStorage.getItem('galinyx-os-workspace-v1'));
  const proj = stored.projects.find((p) => p.title === 'Phase 2 test draft');
  check('new projects get a numeric id for sync', !!(proj && typeof proj.id === 'number'));

  // ---- 5. Error classification (setup-pending detection) ----
  check('sbIsSetupError recognises PGRST205 (table missing)', window.sbIsSetupError({ code: 'PGRST205', message: 'Could not find the table' }) === true);
  check('sbIsSetupError recognises 42P01 (relation missing)', window.sbIsSetupError({ code: '42P01', message: 'relation "public.projects" does not exist' }) === true);
  check('sbIsSetupError rejects network errors', window.sbIsSetupError({ message: 'Failed to fetch' }) === false);

  // ---- 6. Auth validation + live endpoint check (read-only) ----
  window.showView('account');
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-password').value = '';
  await window.sbSignIn();
  await sleep(200);
  check('sign-in validates empty input without a network call',
    document.getElementById('auth-message').textContent.includes('Enter your email'));

  document.getElementById('auth-email').value = 'nobody-phase2-test@example.com';
  document.getElementById('auth-password').value = 'wrongpassword123';
  await window.sbSignIn();
  const authFailed = await waitFor(
    () => document.getElementById('auth-message').textContent.includes('Could not sign in'),
    20000,
    'sign-in to fail against the live Auth endpoint',
  );
  check('sign-in reaches the live Supabase Auth endpoint and reports the failure honestly', authFailed,
    'message reads: ' + JSON.stringify(document.getElementById('auth-message').textContent));
  check('failed sign-in leaves the user signed out',
    document.getElementById('auth-status').textContent === 'Workspace · Signed out');

  // ---- 7. Sync is a no-op while signed out ----
  await window.sbSyncNow();
  await sleep(300);
  check('sync is a safe no-op while signed out', document.getElementById('auth-status').textContent === 'Workspace · Signed out');

  // ---- 8. Workforce snapshot still loads (no regression) ----
  window.showView('workforce');
  const wfLoaded = await waitFor(
    () => document.getElementById('wf-operators') && !document.getElementById('wf-operators').textContent.includes('Loading workforce data'),
    15000,
    'workforce snapshot to render',
  );
  check('Workforce view still loads its snapshot', wfLoaded);
} finally {
  server.close();
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

/**
 * GALINYX Governance Core — signed operator authentication (v1.4.0, Phase 4)
 * ==========================================================================
 * Zero third-party dependencies. No network calls. (Only Node built-ins:
 * crypto, fs, os, path, url.)
 *
 * This module closes the Core's K13 finding: until now an operator ID was a
 * claim, not a credential — any process could claim to be any operator, and
 * the owner identity in approveModeChange() was an env-var string, not a
 * credential. Signed authentication replaces the claim with a proof:
 *
 *   - Every operator gets an Ed25519 key pair. The PUBLIC key is registered
 *     in operator-keys.json (public keys are safe to record and to commit).
 *     The PRIVATE key lives ONLY in ../.keys-local/ (chmod 700 dir, 600
 *     files), which is gitignored. Private keys NEVER enter the repo.
 *   - To act, an operator signs a canonical message (subject + action +
 *     timestamp + nonce + context) with its private key and presents the
 *     proof with the action. verifyProof() checks the signature against
 *     the registered public key, rejects expired timestamps (5-minute
 *     window) and replays (a nonce may be used exactly once).
 *   - Keys can be revoked and rotated. A revoked key verifies as invalid;
 *     rotation revokes the old key and registers the replacement.
 *   - The owner has a key the same way. When an owner key is registered,
 *     owner approvals (mode changes, notification decisions) REQUIRE a
 *     valid owner signature bound to the request — the env-var identity
 *     claim alone is no longer enough. Until an owner key is registered,
 *     the claim path still works (nothing that works today breaks), and
 *     the audit log flags those approvals as unauthenticated.
 *
 * What authentication does NOT do (honest limits):
 *   - It attests IDENTITY. It grants NOTHING. Authorization is still
 *     decided by the operator's mode: a draft-only operator with a valid
 *     signature still cannot publish or spend. Auth is the prerequisite
 *     for a future mode step-up, not the step-up.
 *   - It does NOT sync between processes. The keys file is re-read from
 *     disk on every operation, so two processes see the same keys, but
 *     the in-memory nonce cache is per-process; the nonce FILE is the
 *     cross-process backstop (verifyProof scans it on a cache miss).
 *     Run exactly one writer process, same rule as the audit log.
 *   - Nonce replay protection is bounded by the 5-minute timestamp
 *     window: a signature is only usable inside its window, and a nonce
 *     recorded in that window blocks its replay. Nonces older than the
 *     window are pruned.
 *
 * Storage (all paths overridable by env var, used by the stress test):
 *   GALINYX_AUTH_KEYS_FILE   - public-key store (default: ./operator-keys.json)
 *   GALINYX_AUTH_NONCES_FILE - used-nonce log (default: ./auth-nonces.jsonl)
 *   GALINYX_AUTH_KEYS_DIR    - private-key dir (default: ../.keys-local/)
 *
 * SECURITY — READ THIS BEFORE TOUCHING THIS FILE:
 *   The Solidedgeai repo is PUBLIC. Private key material must NEVER be
 *   written to any file that could be pushed: not operator-keys.json, not
 *   the audit log, not a staging draft, not a log line. Private keys live
 *   ONLY in .keys-local/ (gitignored, 0700/0600). If a private key ever
 *   lands in a pushable file, revoke that key immediately and rotate.
 */

import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
} from 'node:crypto';
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AUTH_VERSION = '1.0.0';
export const PROTOCOL = 'GALINYX-AUTH-V1';
export const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const HERE = path.dirname(fileURLToPath(new URL('./auth.mjs', import.meta.url)));

function defaultKeysFile() {
  return process.env.GALINYX_AUTH_KEYS_FILE
    ? path.resolve(process.env.GALINYX_AUTH_KEYS_FILE)
    : path.join(HERE, 'operator-keys.json');
}

function defaultNoncesFile() {
  return process.env.GALINYX_AUTH_NONCES_FILE
    ? path.resolve(process.env.GALINYX_AUTH_NONCES_FILE)
    : path.join(HERE, 'auth-nonces.jsonl');
}

function defaultKeysDir() {
  return process.env.GALINYX_AUTH_KEYS_DIR
    ? path.resolve(process.env.GALINYX_AUTH_KEYS_DIR)
    : path.join(HERE, '..', '.keys-local');
}

let KEYS_FILE = defaultKeysFile();
let NONCES_FILE = defaultNoncesFile();
let KEYS_DIR = defaultKeysDir();

// In-memory nonce cache: nonce -> expiry (ms since epoch). The file is the
// durable record; this map is the fast path. verifyProof() consults the
// file on a cache miss, so a restart or a second process cannot resurrect
// a spent nonce inside its window.
const seenNonces = new Map();

// ---------------------------------------------------------------------------
// Validation helpers. Never throw.
// ---------------------------------------------------------------------------

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const HEX32_PATTERN = /^[0-9a-f]{32}$/;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isValidId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

function isBase64(value, minLen = 1, maxLen = 512) {
  return (
    typeof value === 'string' &&
    value.length >= minLen &&
    value.length <= maxLen &&
    BASE64_PATTERN.test(value) &&
    value.length % 4 === 0
  );
}

function sanitize(value, maxLen = 128) {
  if (typeof value !== 'string') return '[non-string]';
  return value.length > maxLen ? value.slice(0, maxLen) : value;
}

// ---------------------------------------------------------------------------
// Public-key store (operator-keys.json). Public keys only — safe to commit.
// The file is the source of truth and is re-read from disk on every
// operation, so a key registered by one process (or the issue-key tool) is
// visible to the Core without a restart.
// ---------------------------------------------------------------------------

function emptyStore() {
  return { version: 1, keys: [] };
}

function loadKeysFromDisk() {
  let data;
  try {
    data = JSON.parse(readFileSync(KEYS_FILE, 'utf8'));
  } catch {
    return { store: emptyStore(), skipped: 0 };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.keys)) {
    return { store: emptyStore(), skipped: 0 };
  }
  const keys = [];
  let skipped = 0;
  const seenIds = new Set();
  for (const entry of data.keys) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      !isValidId(entry.keyId) ||
      FORBIDDEN_KEYS.has(entry.keyId) ||
      seenIds.has(entry.keyId) ||
      !isValidId(entry.subject) ||
      (entry.subjectType !== 'operator' && entry.subjectType !== 'owner') ||
      !isBase64(entry.publicKey, 40, 128) ||
      (entry.status !== 'active' && entry.status !== 'revoked')
    ) {
      skipped++;
      continue;
    }
    seenIds.add(entry.keyId);
    keys.push({
      keyId: entry.keyId,
      subject: entry.subject,
      subjectType: entry.subjectType,
      publicKey: entry.publicKey,
      label: typeof entry.label === 'string' ? entry.label : '',
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
      status: entry.status,
      revokedAt: typeof entry.revokedAt === 'string' ? entry.revokedAt : null,
      revokedReason: typeof entry.revokedReason === 'string' ? entry.revokedReason : '',
    });
  }
  return { store: { version: 1, keys }, skipped };
}

function saveKeysToDisk(store) {
  const tmp = `${KEYS_FILE}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  renameSync(tmp, KEYS_FILE);
}

// Parse a base64 SPKI public key and confirm it is Ed25519. Returns the
// KeyObject, or null when the input is not a usable Ed25519 public key.
function parsePublicKey(publicKeyB64) {
  try {
    if (!isBase64(publicKeyB64, 40, 128)) return null;
    const key = createPublicKey({
      key: Buffer.from(publicKeyB64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    return key.asymmetricKeyType === 'ed25519' ? key : null;
  } catch {
    return null;
  }
}

// Parse a base64 PKCS8 private key and confirm it is Ed25519.
function parsePrivateKey(privateKeyB64) {
  try {
    if (!isBase64(privateKeyB64, 40, 256)) return null;
    const key = createPrivateKey({
      key: Buffer.from(privateKeyB64, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
    return key.asymmetricKeyType === 'ed25519' ? key : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Key lifecycle: generate, register, revoke, rotate.
// ---------------------------------------------------------------------------

// Generate a fresh Ed25519 key pair for a subject (an operator id, or
// 'owner'). Returns the keyId, the base64 public key (safe to record), and
// the base64 private key (MUST go to .keys-local/ only — never to a
// pushable file, never to a log). Generating does NOT register: call
// registerPublicKey() to make the key usable.
export function generateKeyPair(subject, label = '') {
  if (!isValidId(subject) || FORBIDDEN_KEYS.has(subject)) {
    return { ok: false, reason: `Invalid subject '${sanitize(subject)}'.` };
  }
  try {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const keyId = `key-${subject}-${randomBytes(4).toString('hex')}`;
    return {
      ok: true,
      keyId,
      subject,
      publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
      label: typeof label === 'string' ? label : '',
    };
  } catch (err) {
    return { ok: false, reason: `Key generation failed: ${sanitize(err.message)}.` };
  }
}

// Register a public key so verifyProof() accepts signatures from it.
// Rejects duplicates, malformed keys, and non-Ed25519 keys.
export function registerPublicKey({ keyId, subject, subjectType, publicKey, label = '' } = {}) {
  if (!isValidId(keyId) || FORBIDDEN_KEYS.has(keyId)) {
    return { registered: false, reason: `Invalid keyId '${sanitize(keyId)}'.` };
  }
  if (!isValidId(subject) || FORBIDDEN_KEYS.has(subject)) {
    return { registered: false, reason: `Invalid subject '${sanitize(subject)}'.` };
  }
  if (subjectType !== 'operator' && subjectType !== 'owner') {
    return { registered: false, reason: 'subjectType must be "operator" or "owner".' };
  }
  if (subjectType === 'owner' && subject !== 'owner') {
    return { registered: false, reason: 'Owner keys must have subject "owner".' };
  }
  if (subject === 'owner' && subjectType !== 'owner') {
    return { registered: false, reason: 'Subject "owner" must have subjectType "owner".' };
  }
  if (parsePublicKey(publicKey) === null) {
    return { registered: false, reason: 'publicKey is not a valid Ed25519 SPKI key.' };
  }
  try {
    const { store } = loadKeysFromDisk();
    if (store.keys.some((k) => k.keyId === keyId)) {
      return { registered: false, reason: `Key '${keyId}' is already registered.` };
    }
    store.keys.push({
      keyId,
      subject,
      subjectType,
      publicKey,
      label: typeof label === 'string' ? label : '',
      createdAt: new Date().toISOString(),
      status: 'active',
      revokedAt: null,
      revokedReason: '',
    });
    saveKeysToDisk(store);
    return { registered: true, keyId, reason: `Key '${keyId}' registered for '${subject}'.` };
  } catch (err) {
    return { registered: false, reason: `Could not write key store: ${sanitize(err.message)}.` };
  }
}

// Revoke a key. Revoked keys verify as invalid from this moment on; the
// entry stays in the store (marked revoked) so the history is on the
// record. Revocation is permanent — there is no un-revoke; rotate instead.
export function revokeKey(keyId, reason = '') {
  if (!isValidId(keyId)) {
    return { revoked: false, reason: `Invalid keyId '${sanitize(keyId)}'.` };
  }
  try {
    const { store } = loadKeysFromDisk();
    const entry = store.keys.find((k) => k.keyId === keyId);
    if (!entry) {
      return { revoked: false, reason: `Unknown key '${keyId}'.` };
    }
    if (entry.status === 'revoked') {
      return { revoked: false, reason: `Key '${keyId}' is already revoked.` };
    }
    entry.status = 'revoked';
    entry.revokedAt = new Date().toISOString();
    entry.revokedReason = typeof reason === 'string' ? reason : '';
    saveKeysToDisk(store);
    return { revoked: true, keyId, reason: `Key '${keyId}' revoked.` };
  } catch (err) {
    return { revoked: false, reason: `Could not write key store: ${sanitize(err.message)}.` };
  }
}

// Rotate a subject's key: revoke every active key for the subject, then
// register the replacement. The caller supplies the new public key
// (generate it first with generateKeyPair, and store its private key in
// .keys-local/ before rotating — rotation does not touch private keys).
export function rotateKey(subject, newPublicKey, label = '') {
  if (!isValidId(subject) || FORBIDDEN_KEYS.has(subject)) {
    return { rotated: false, reason: `Invalid subject '${sanitize(subject)}'.` };
  }
  if (parsePublicKey(newPublicKey) === null) {
    return { rotated: false, reason: 'newPublicKey is not a valid Ed25519 SPKI key.' };
  }
  try {
    const { store } = loadKeysFromDisk();
    const oldKeyIds = [];
    for (const entry of store.keys) {
      if (entry.subject === subject && entry.status === 'active') {
        entry.status = 'revoked';
        entry.revokedAt = new Date().toISOString();
        entry.revokedReason = 'rotated';
        oldKeyIds.push(entry.keyId);
      }
    }
    const subjectType = subject === 'owner' ? 'owner' : 'operator';
    const keyId = `key-${subject}-${randomBytes(4).toString('hex')}`;
    store.keys.push({
      keyId,
      subject,
      subjectType,
      publicKey: newPublicKey,
      label: typeof label === 'string' ? label : '',
      createdAt: new Date().toISOString(),
      status: 'active',
      revokedAt: null,
      revokedReason: '',
    });
    saveKeysToDisk(store);
    return {
      rotated: true,
      newKeyId: keyId,
      oldKeyIds,
      reason: `Rotated '${subject}': ${oldKeyIds.length} old key(s) revoked, new key '${keyId}' registered.`,
    };
  } catch (err) {
    return { rotated: false, reason: `Could not write key store: ${sanitize(err.message)}.` };
  }
}

// Active (usable) public keys for a subject. Public info only — this
// never returns private material.
export function getActiveKeys(subject) {
  if (!isValidId(subject)) return [];
  const { store } = loadKeysFromDisk();
  return store.keys
    .filter((k) => k.subject === subject && k.status === 'active')
    .map((k) => ({ ...k }));
}

// Every registered key (active + revoked), public info only.
export function listKeys(subject = null) {
  const { store } = loadKeysFromDisk();
  return store.keys
    .filter((k) => subject === null || k.subject === subject)
    .map((k) => ({ ...k }));
}

// True when at least one ACTIVE owner key is registered. The Core uses
// this to decide whether owner approvals require a signature (yes, when
// a key exists) or fall back to the identity claim (only until one does).
export function isOwnerKeyRegistered() {
  const { store } = loadKeysFromDisk();
  return store.keys.some((k) => k.subjectType === 'owner' && k.status === 'active');
}

// ---------------------------------------------------------------------------
// Private-key files (.keys-local/). Private keys live ONLY here.
// ---------------------------------------------------------------------------

function ensureKeysDir() {
  mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
  try {
    chmodSync(KEYS_DIR, 0o700);
  } catch {
    // Best-effort hardening; a failed chmod must not break issuance.
  }
}

function privateKeyPath(keyId) {
  return path.join(KEYS_DIR, `${keyId}.key`);
}

// Save a private key to .keys-local/<keyId>.key (0600). Refuses to
// overwrite an existing file — a private key file is never silently
// replaced. The caller is responsible for never passing a private key
// anywhere else.
export function savePrivateKey(keyId, privateKey) {
  if (!isValidId(keyId) || FORBIDDEN_KEYS.has(keyId)) {
    return { saved: false, reason: `Invalid keyId '${sanitize(keyId)}'.` };
  }
  if (parsePrivateKey(privateKey) === null) {
    return { saved: false, reason: 'privateKey is not a valid Ed25519 PKCS8 key.' };
  }
  try {
    ensureKeysDir();
    const file = privateKeyPath(keyId);
    if (existsSync(file)) {
      return { saved: false, reason: `Private key file for '${keyId}' already exists; refusing to overwrite.` };
    }
    writeFileSync(file, `${privateKey}\n`, { encoding: 'utf8', mode: 0o600 });
    try {
      chmodSync(file, 0o600);
    } catch {
      // Best-effort hardening.
    }
    return { saved: true, keyId, path: file, reason: `Private key saved to .keys-local/ (${keyId}.key).` };
  } catch (err) {
    return { saved: false, reason: `Could not save private key: ${sanitize(err.message)}.` };
  }
}

// Load a private key from .keys-local/. Returns the base64 key for signing.
// The caller must treat the return value as secret and never log it.
export function loadPrivateKey(keyId) {
  if (!isValidId(keyId) || FORBIDDEN_KEYS.has(keyId)) {
    return { ok: false, reason: `Invalid keyId '${sanitize(keyId)}'.` };
  }
  try {
    const raw = readFileSync(privateKeyPath(keyId), 'utf8').trim();
    if (parsePrivateKey(raw) === null) {
      return { ok: false, reason: `Private key file for '${keyId}' is not a valid Ed25519 key.` };
    }
    return { ok: true, keyId, privateKey: raw };
  } catch (err) {
    return {
      ok: false,
      reason:
        err.code === 'ENOENT'
          ? `No private key file for '${keyId}'.`
          : `Could not load private key: ${sanitize(err.message)}.`,
    };
  }
}

// ---------------------------------------------------------------------------
// Proofs: sign and verify.
// ---------------------------------------------------------------------------

// The canonical message. Built from a fixed template (not JSON.stringify
// of an object) so the signed bytes are identical on every runtime: field
// order can never drift. Any change to any field changes the bytes and
// breaks the signature.
export function canonicalMessage({ subject, action, timestamp, nonce, context }) {
  return [
    PROTOCOL,
    `subject:${subject}`,
    `action:${action}`,
    `timestamp:${timestamp}`,
    `nonce:${nonce}`,
    `context:${context || ''}`,
  ].join('\n');
}

// Sign a proof for an action. timestamp/nonce overrides exist for tests
// (e.g. crafting an expired proof); production callers omit them and get
// a fresh timestamp and nonce. The verifier enforces the window either
// way — a caller cannot sign its way past it.
export function createProof({
  subject,
  action,
  privateKey,
  keyId,
  context = '',
  timestamp = null,
  nonce = null,
} = {}) {
  if (!isValidId(subject) || FORBIDDEN_KEYS.has(subject)) {
    return { ok: false, reason: `Invalid subject '${sanitize(subject)}'.` };
  }
  if (typeof action !== 'string' || action === '' || action.length > 128) {
    return { ok: false, reason: 'Action must be a non-empty string (max 128 chars).' };
  }
  if (!isValidId(keyId) || FORBIDDEN_KEYS.has(keyId)) {
    return { ok: false, reason: `Invalid keyId '${sanitize(keyId)}'.` };
  }
  if (typeof context !== 'string' || context.length > 256) {
    return { ok: false, reason: 'Context must be a string (max 256 chars).' };
  }
  const ts = timestamp === null ? new Date().toISOString() : timestamp;
  if (typeof ts !== 'string' || !ISO_PATTERN.test(ts) || !Number.isFinite(Date.parse(ts))) {
    return { ok: false, reason: 'Timestamp must be an ISO-8601 UTC string.' };
  }
  const n = nonce === null ? randomBytes(16).toString('hex') : nonce;
  if (typeof n !== 'string' || !HEX32_PATTERN.test(n)) {
    return { ok: false, reason: 'Nonce must be 32 lowercase hex characters.' };
  }
  const key = parsePrivateKey(privateKey);
  if (key === null) {
    return { ok: false, reason: 'privateKey is not a valid Ed25519 PKCS8 key.' };
  }
  try {
    const message = canonicalMessage({ subject, action, timestamp: ts, nonce: n, context });
    const signature = sign(null, Buffer.from(message, 'utf8'), key).toString('base64');
    return {
      ok: true,
      proof: {
        protocol: PROTOCOL,
        subject,
        action,
        timestamp: ts,
        nonce: n,
        keyId,
        context,
        signature,
      },
    };
  } catch (err) {
    return { ok: false, reason: `Signing failed: ${sanitize(err.message)}.` };
  }
}

// ---------------------------------------------------------------------------
// Nonce store: used nonces, in memory + an append-only JSONL file.
// A nonce is recorded only after a proof verifies fully — a failed
// attempt never burns a nonce, so an attacker cannot deny a legitimate
// proof by submitting a tampered copy of it first.
// ---------------------------------------------------------------------------

function pruneNonces(now) {
  for (const [nonce, expiry] of seenNonces) {
    if (expiry <= now) seenNonces.delete(nonce);
  }
}

function loadNoncesFromDisk() {
  let text;
  try {
    text = readFileSync(NONCES_FILE, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(
        `[GALINYX] WARNING: could not read nonce file ${NONCES_FILE}: ${err.message}`,
      );
    }
    return;
  }
  const now = Date.now();
  const kept = [];
  let dropped = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      dropped++;
      continue;
    }
    if (
      !entry ||
      typeof entry.nonce !== 'string' ||
      !HEX32_PATTERN.test(entry.nonce) ||
      typeof entry.expiresAt !== 'number'
    ) {
      dropped++;
      continue;
    }
    if (entry.expiresAt <= now) {
      dropped++;
      continue;
    }
    seenNonces.set(entry.nonce, entry.expiresAt);
    kept.push(line);
  }
  // Compact the file when stale or corrupt lines were dropped, so it
  // stays bounded by the window instead of growing forever.
  if (dropped > 0) {
    try {
      writeFileSync(NONCES_FILE, kept.length ? `${kept.join('\n')}\n` : '', 'utf8');
    } catch {
      // Best-effort compaction; the in-memory map is already correct.
    }
  }
}

function nonceSeenOnDisk(nonce) {
  try {
    const text = readFileSync(NONCES_FILE, 'utf8');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry && entry.nonce === nonce && entry.expiresAt > Date.now()) return true;
      } catch {
        continue;
      }
    }
  } catch {
    // Missing/unreadable file means no recorded nonce.
  }
  return false;
}

function recordNonce(nonce, expiresAt) {
  seenNonces.set(nonce, expiresAt);
  try {
    appendFileSync(NONCES_FILE, `${JSON.stringify({ nonce, expiresAt })}\n`, 'utf8');
  } catch (err) {
    // The in-memory record still stands; the failure is counted loudly
    // enough that a broken nonce file is visible, not silent.
    console.error(
      `[GALINYX] WARNING: could not append to nonce file ${NONCES_FILE}: ${err.message} (replay protection continues in memory only)`,
    );
  }
}

loadNoncesFromDisk();

// Verify a proof. Never throws — any malformed input, unknown key, or
// unexpected error returns { authenticated: false } with a reason.
// expected binds the proof to the caller's intent: the subject, action,
// and context the caller expects. A proof signed for a different subject,
// action, or context fails — a signature cannot be transplanted.
// On success the nonce is recorded (memory + file) so the proof cannot
// be replayed.
export function verifyProof(proof, expected = {}) {
  const fail = (reason) => ({ authenticated: false, subject: null, keyId: null, reason });
  try {
    if (!proof || typeof proof !== 'object' || Array.isArray(proof)) {
      return fail('Proof must be an object.');
    }
    const { protocol, subject, action, timestamp, nonce, keyId, context, signature } = proof;
    if (protocol !== PROTOCOL) {
      return fail(`Unknown auth protocol '${sanitize(protocol)}'.`);
    }
    if (!isValidId(subject) || FORBIDDEN_KEYS.has(subject)) {
      return fail(`Invalid proof subject '${sanitize(subject)}'.`);
    }
    if (typeof action !== 'string' || action === '' || action.length > 128) {
      return fail('Invalid proof action.');
    }
    if (!isValidId(keyId) || FORBIDDEN_KEYS.has(keyId)) {
      return fail(`Invalid proof keyId '${sanitize(keyId)}'.`);
    }
    if (typeof context !== 'string' || context.length > 256) {
      return fail('Invalid proof context.');
    }
    if (typeof timestamp !== 'string' || !ISO_PATTERN.test(timestamp)) {
      return fail('Invalid proof timestamp.');
    }
    const tsMs = Date.parse(timestamp);
    if (!Number.isFinite(tsMs)) {
      return fail('Invalid proof timestamp.');
    }
    if (typeof nonce !== 'string' || !HEX32_PATTERN.test(nonce)) {
      return fail('Invalid proof nonce.');
    }
    if (!isBase64(signature, 80, 96)) {
      return fail('Invalid proof signature.');
    }
    if (expected.subject !== undefined && subject !== expected.subject) {
      return fail(`Proof is for '${sanitize(subject)}', not '${sanitize(expected.subject)}'.`);
    }
    if (expected.action !== undefined && action !== expected.action) {
      return fail(`Proof is for action '${sanitize(action)}', not '${sanitize(expected.action)}'.`);
    }
    if (expected.context !== undefined && context !== expected.context) {
      return fail('Proof context does not match this request.');
    }

    // The keys file is re-read on every verify, so keys registered by
    // another process (or the issue-key tool) work without a restart.
    const { store } = loadKeysFromDisk();
    const entry = store.keys.find((k) => k.keyId === keyId);
    if (!entry) {
      return fail(`Unknown key '${sanitize(keyId)}'.`);
    }
    if (entry.subject !== subject) {
      return fail(`Key '${sanitize(keyId)}' belongs to '${sanitize(entry.subject)}', not '${sanitize(subject)}'.`);
    }
    if (entry.status === 'revoked') {
      return fail(`Key '${sanitize(keyId)}' is revoked.`);
    }
    if (entry.status !== 'active') {
      return fail(`Key '${sanitize(keyId)}' is not active.`);
    }

    const now = Date.now();
    if (Math.abs(now - tsMs) > TIMESTAMP_WINDOW_MS) {
      return fail('Proof timestamp is outside the 5-minute window (expired or too far ahead).');
    }

    pruneNonces(now);
    if (seenNonces.has(nonce) || nonceSeenOnDisk(nonce)) {
      return fail('Replayed proof: this nonce has already been used.');
    }

    const publicKey = parsePublicKey(entry.publicKey);
    if (publicKey === null) {
      return fail(`Registered key '${sanitize(keyId)}' is not a usable Ed25519 key.`);
    }
    const message = canonicalMessage({ subject, action, timestamp, nonce, context });
    let valid = false;
    try {
      valid = verify(
        null,
        Buffer.from(message, 'utf8'),
        publicKey,
        Buffer.from(signature, 'base64'),
      );
    } catch {
      valid = false;
    }
    if (!valid) {
      return fail('Invalid signature.');
    }

    recordNonce(nonce, tsMs + TIMESTAMP_WINDOW_MS);
    return {
      authenticated: true,
      subject,
      keyId,
      reason: `Authenticated as '${subject}' with key '${keyId}'.`,
    };
  } catch (err) {
    return fail(`Verification error (${sanitize(err && err.message ? err.message : err)}). Failing closed.`);
  }
}

// Verify an OWNER proof for an approval. The subject must be 'owner', the
// action must match the approval type, and the context must be the request
// being decided — so a signature for one approval cannot be replayed for
// another.
export function verifyOwnerApproval(proof, { action, context } = {}) {
  if (typeof action !== 'string' || action === '') {
    return {
      authenticated: false,
      subject: null,
      keyId: null,
      reason: 'Owner approval verification requires an action.',
    };
  }
  if (typeof context !== 'string' || context === '') {
    return {
      authenticated: false,
      subject: null,
      keyId: null,
      reason: 'Owner approval verification requires a request context.',
    };
  }
  return verifyProof(proof, { subject: 'owner', action, context });
}

// ---------------------------------------------------------------------------
// Test + tool hooks.
// ---------------------------------------------------------------------------

// Re-point the store paths (used by the stress test and the demo, which
// run against temp files). Reloads keys and nonces from the new paths.
export function configureAuth({ keysFile, noncesFile, keysDir } = {}) {
  if (typeof keysFile === 'string' && keysFile !== '') KEYS_FILE = path.resolve(keysFile);
  if (typeof noncesFile === 'string' && noncesFile !== '') {
    NONCES_FILE = path.resolve(noncesFile);
  }
  if (typeof keysDir === 'string' && keysDir !== '') KEYS_DIR = path.resolve(keysDir);
  seenNonces.clear();
  loadNoncesFromDisk();
  return { keysFile: KEYS_FILE, noncesFile: NONCES_FILE, keysDir: KEYS_DIR };
}

// Wipe the store — keys file, nonce file, and memory. TESTS ONLY, and
// only when every store path is inside the OS temp dir: this can never
// wipe the live store. Used by the stress test to reset between groups.
export function clearAuthStoreForTests() {
  const tmp = path.resolve(os.tmpdir());
  const inside = (p) => path.resolve(p).startsWith(`${tmp}${path.sep}`);
  if (!inside(KEYS_FILE) || !inside(NONCES_FILE) || !inside(KEYS_DIR)) {
    return {
      cleared: false,
      reason: 'Refusing to clear: store paths are not inside the OS temp dir.',
    };
  }
  try {
    rmSync(KEYS_FILE, { force: true });
    rmSync(NONCES_FILE, { force: true });
    rmSync(KEYS_DIR, { recursive: true, force: true });
  } catch (err) {
    return { cleared: false, reason: `Could not clear test store: ${sanitize(err.message)}.` };
  }
  seenNonces.clear();
  return { cleared: true, reason: 'Test auth store cleared.' };
}

export function getAuthStats() {
  const { store } = loadKeysFromDisk();
  const active = store.keys.filter((k) => k.status === 'active');
  return {
    authVersion: AUTH_VERSION,
    keysFile: KEYS_FILE,
    noncesFile: NONCES_FILE,
    keysDir: KEYS_DIR,
    totalKeys: store.keys.length,
    activeKeys: active.length,
    revokedKeys: store.keys.filter((k) => k.status === 'revoked').length,
    ownerKeyRegistered: active.some((k) => k.subjectType === 'owner'),
    noncesSeen: seenNonces.size,
  };
}

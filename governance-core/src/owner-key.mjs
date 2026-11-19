/**
 * GALINYX Governance Core — owner-key ceremony (v1.5.0)
 * =====================================================
 * Zero third-party dependencies. (Only Node built-ins: crypto, fs, path,
 * plus the first-party sibling module ./auth.mjs.)
 *
 * This module closes the Core's K13 finding: owner identity was a claim
 * (an env-var string), not a credential. Signed owner approvals exist
 * since v1.4.0, but no owner key was registered — the ceremony to issue
 * one did not exist. This is that ceremony.
 *
 * THE OWNER KEY IS MATT'S. The rules are absolute:
 *
 *   1. The key is generated only when Matt says the word. The generate
 *      function requires an explicit `confirmed: true` — there is no
 *      quiet path. The CLI (tools/owner-key.mjs) prints the full
 *      ceremony and refuses to generate without --confirm.
 *   2. The private key goes to .keys-local/ ONLY (0600, gitignored).
 *      It is NEVER printed, logged, pasted, or written anywhere else.
 *      Every function here returns key IDs and public keys only.
 *   3. Only the PUBLIC key is registered in operator-keys.json.
 *   4. There is NO recovery for a lost owner key. Once a key is
 *      registered, unsigned approvals stop working — and rotating the
 *      owner key requires proving possession of the current key. Matt
 *      must back the private key up somewhere he controls, and the
 *      verify-backup step exists to prove the backup is good BEFORE
 *      he needs it.
 *   5. The LOCAL TEST keypair (owner-TEST-9ca81fee, in .keys-local/)
 *      is NOT the owner key. It is unregistered and authenticates
 *      nothing. It must never be registered as the owner key. This
 *      module refuses to touch it.
 *
 * Rotation requires possession: rotateOwnerKey() signs a rotation
 * authorization with the CURRENT owner key and verifies it before
 * anything changes. A rotation without the current key is refused —
 * that is the point. (If the current key is truly lost, recovery is a
 * deliberate, Matt-ordered, out-of-band act: remove the owner key
 * entry from operator-keys.json by hand, re-run the ceremony, and
 * record the whole thing in the audit log. There is no button for it.)
 */

import { createPrivateKey, createPublicKey } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  createProof,
  generateKeyPair,
  getActiveKeys,
  isOwnerKeyRegistered,
  listKeys,
  loadPrivateKey,
  registerPublicKey,
  revokeKey,
  savePrivateKey,
  verifyProof,
} from './auth.mjs';

export const OWNER_KEY_VERSION = '1.0.0';
export const TEST_KEY_ID = 'owner-TEST-9ca81fee';

function sanitize(value, maxLen = 128) {
  if (typeof value !== 'string') return '[non-string]';
  return value.length > maxLen ? value.slice(0, maxLen) : value;
}

// Derive the base64 SPKI public key from a base64 PKCS8 private key.
// Used to prove a backup file holds the key that matches the registered
// public key — without ever printing the private key.
export function derivePublicKey(privateKeyB64) {
  try {
    const priv = createPrivateKey({
      key: Buffer.from(privateKeyB64, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
    if (priv.asymmetricKeyType !== 'ed25519') return null;
    const pub = createPublicKey(priv);
    return pub.export({ type: 'spki', format: 'der' }).toString('base64');
  } catch {
    return null;
  }
}

// Public status of the owner key. Public info only — no private
// material, ever.
export function ownerKeyStatus() {
  const active = getActiveKeys('owner');
  const all = listKeys('owner');
  const registered = active.length > 0;
  const current = registered ? active[0] : null;
  let privateKeyFilePresent = false;
  let privateKeyFileMode = null;
  if (current) {
    const keysDir =
      process.env.GALINYX_AUTH_KEYS_DIR ||
      path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '.keys-local');
    const file = path.join(keysDir, `${current.keyId}.key`);
    try {
      if (existsSync(file)) {
        privateKeyFilePresent = true;
        privateKeyFileMode = (statSync(file).mode & 0o777).toString(8);
      }
    } catch {
      privateKeyFilePresent = false;
    }
  }
  return {
    registered,
    ownerKeyRegistered: isOwnerKeyRegistered(),
    keyId: current ? current.keyId : null,
    createdAt: current ? current.createdAt : null,
    label: current ? current.label : null,
    activeOwnerKeys: active.length,
    totalOwnerKeys: all.length,
    revokedOwnerKeys: all.filter((k) => k.status === 'revoked').length,
    privateKeyFilePresent,
    privateKeyFileMode,
    testKeypairNote: `The LOCAL TEST keypair (${TEST_KEY_ID}) is unregistered and authenticates nothing. It is not the owner key.`,
  };
}

// Generate Matt's owner keypair and register the public key.
// Requires confirmed === true — the caller's explicit word. Refuses
// when an owner key is already registered (use rotate instead).
// Returns public info only: keyId, publicKey, private-key path.
export function generateOwnerKey({ confirmed = false, label = '' } = {}) {
  if (confirmed !== true) {
    return {
      generated: false,
      reason: 'Owner-key generation requires explicit confirmation (confirmed: true). Run the ceremony with --confirm after reading the warnings.',
    };
  }
  if (isOwnerKeyRegistered()) {
    return {
      generated: false,
      reason: 'An owner key is already registered. Generate is refused — use rotateOwnerKey to replace it (proving possession of the current key).',
    };
  }
  const g = generateKeyPair('owner', label || 'owner key — issued by Matt Johnson');
  if (!g.ok) {
    return { generated: false, reason: `Key generation failed: ${g.reason}` };
  }
  // Private key FIRST: if registration then fails, the private key is
  // safely on disk and the key simply is not registered yet.
  const saved = savePrivateKey(g.keyId, g.privateKey);
  if (!saved.saved) {
    return { generated: false, reason: `Private key could not be saved: ${saved.reason}` };
  }
  const reg = registerPublicKey({
    keyId: g.keyId,
    subject: 'owner',
    subjectType: 'owner',
    publicKey: g.publicKey,
    label: g.label,
  });
  if (!reg.registered) {
    return {
      generated: false,
      reason: `Public key could not be registered: ${reg.reason} The private key is saved at ${saved.path}; registration can be retried.`,
      keyId: g.keyId,
      privateKeyPath: saved.path,
    };
  }
  // Round-trip proof: the new key must sign and verify before the
  // ceremony is declared done.
  const proof = createProof({
    subject: 'owner',
    action: 'owner-key-verification',
    privateKey: g.privateKey,
    keyId: g.keyId,
    context: g.keyId,
  });
  if (!proof.ok) {
    return {
      generated: false,
      reason: `Key registered, but the verification proof could not be created: ${proof.reason}`,
      keyId: g.keyId,
      privateKeyPath: saved.path,
    };
  }
  const check = verifyProof(proof.proof, {
    subject: 'owner',
    action: 'owner-key-verification',
    context: g.keyId,
  });
  if (!check.authenticated) {
    return {
      generated: false,
      reason: `Key registered, but the verification proof did not verify: ${check.reason}`,
      keyId: g.keyId,
      privateKeyPath: saved.path,
    };
  }
  return {
    generated: true,
    keyId: g.keyId,
    publicKey: g.publicKey,
    privateKeyPath: saved.path,
    reason: `Owner key '${g.keyId}' generated, private key saved to .keys-local/ (0600), public key registered, round-trip proof verified. BACK UP the private key now — there is no recovery if it is lost.`,
  };
}

// Rotate the owner key. Requires confirmed === true AND possession of
// the current key: the rotation is authorized by a proof signed with
// the current owner key. Without the current private key, rotation is
// refused.
export function rotateOwnerKey({ confirmed = false, label = '' } = {}) {
  if (confirmed !== true) {
    return {
      rotated: false,
      reason: 'Owner-key rotation requires explicit confirmation (confirmed: true).',
    };
  }
  const current = getActiveKeys('owner');
  if (current.length === 0) {
    return {
      rotated: false,
      reason: 'No owner key is registered. Nothing to rotate — use generateOwnerKey to issue the first owner key.',
    };
  }
  const currentKey = current[0];
  const loaded = loadPrivateKey(currentKey.keyId);
  if (!loaded.ok) {
    return {
      rotated: false,
      reason: `Cannot rotate: the current owner private key (${currentKey.keyId}) is not available: ${loaded.reason} Rotation requires proving possession of the current key.`,
    };
  }
  const g = generateKeyPair('owner', label || 'owner key — rotated by Matt Johnson');
  if (!g.ok) {
    return { rotated: false, reason: `Key generation failed: ${g.reason}` };
  }
  // Save the new private key BEFORE registering the public key, so a
  // failure mid-rotation never strands a registered key whose private
  // half was never saved.
  const saved = savePrivateKey(g.keyId, g.privateKey);
  if (!saved.saved) {
    return { rotated: false, reason: `New private key could not be saved: ${saved.reason}` };
  }
  // Authorize the rotation with the CURRENT key. The proof is bound to
  // the new key's ID, so it authorizes exactly this rotation.
  const auth = createProof({
    subject: 'owner',
    action: 'owner-key-rotation',
    privateKey: loaded.privateKey,
    keyId: currentKey.keyId,
    context: g.keyId,
  });
  if (!auth.ok) {
    return { rotated: false, reason: `Rotation authorization could not be signed: ${auth.reason}` };
  }
  const check = verifyProof(auth.proof, {
    subject: 'owner',
    action: 'owner-key-rotation',
    context: g.keyId,
  });
  if (!check.authenticated) {
    return { rotated: false, reason: `Rotation authorization did not verify: ${check.reason}` };
  }
  // Register the new public key under the SAME keyId the private key
  // was saved as (rotateKey() would mint a different ID — this keeps
  // the private-key file and the registered key in agreement), then
  // revoke the old keys. If a revocation fails, the old key stays
  // active alongside the new one — both are Matt's, and the result
  // reports it.
  const reg = registerPublicKey({
    keyId: g.keyId,
    subject: 'owner',
    subjectType: 'owner',
    publicKey: g.publicKey,
    label: g.label,
  });
  if (!reg.registered) {
    return { rotated: false, reason: `New public key could not be registered: ${reg.reason}` };
  }
  const oldKeyIds = [];
  const revokeFailures = [];
  for (const old of current) {
    const r = revokeKey(old.keyId, 'rotated');
    if (r.revoked) oldKeyIds.push(old.keyId);
    else revokeFailures.push(`${old.keyId}: ${r.reason}`);
  }
  // Round-trip proof with the NEW key.
  const proof = createProof({
    subject: 'owner',
    action: 'owner-key-verification',
    privateKey: g.privateKey,
    keyId: g.keyId,
    context: g.keyId,
  });
  if (!proof.ok) {
    return { rotated: true, newKeyId: g.keyId, oldKeyIds, reason: `Rotated, but the new key's verification proof could not be created: ${proof.reason}` };
  }
  const verify = verifyProof(proof.proof, {
    subject: 'owner',
    action: 'owner-key-verification',
    context: g.keyId,
  });
  if (!verify.authenticated) {
    return { rotated: true, newKeyId: g.keyId, oldKeyIds, reason: `Rotated, but the new key's verification proof did not verify: ${verify.reason}` };
  }
  return {
    rotated: true,
    newKeyId: g.keyId,
    oldKeyIds,
    reason: `Owner key rotated: ${oldKeyIds.length} old key(s) revoked, new key '${g.keyId}' registered and verified. Back up the new private key now; delete the old private key file when convenient.${revokeFailures.length ? ` WARNING: ${revokeFailures.length} old key(s) could not be revoked: ${revokeFailures.join('; ')}` : ''}`,
  };
}

// Verify a backup of the owner private key. Reads the private key from
// the given file, derives its public key, and compares it to the
// registered owner public key. NEVER prints the private key. Returns
// { ok, matches, reason } — matches is true only when the backup holds
// the key that matches the registered owner key.
export function verifyOwnerKeyBackup({ file } = {}) {
  if (typeof file !== 'string' || file === '') {
    return { ok: false, matches: false, reason: 'A backup file path is required.' };
  }
  const active = getActiveKeys('owner');
  if (active.length === 0) {
    return { ok: false, matches: false, reason: 'No owner key is registered — there is nothing to match a backup against.' };
  }
  let raw;
  try {
    raw = readFileSync(file, 'utf8').trim();
  } catch (err) {
    return { ok: false, matches: false, reason: `Could not read backup file: ${sanitize(err.message)}` };
  }
  const derived = derivePublicKey(raw);
  if (derived === null) {
    return { ok: false, matches: false, reason: 'The backup file does not hold a valid Ed25519 private key.' };
  }
  const match = active.find((k) => k.publicKey === derived);
  if (match) {
    return {
      ok: true,
      matches: true,
      keyId: match.keyId,
      reason: `Backup verified: the file holds the private key for registered owner key '${match.keyId}'.`,
    };
  }
  return {
    ok: true,
    matches: false,
    reason: 'Backup does NOT match: the file holds a valid Ed25519 key, but it is not the registered owner key.',
  };
}

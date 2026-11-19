#!/usr/bin/env node
/**
 * GALINYX Governance Core — operator key tool (v1.4.0)
 * ====================================================
 * Issue, revoke, rotate, and list operator signing keys.
 *
 * Usage (from the galinyx-governance folder):
 *   node governance-core/tools/issue-key.mjs issue <operator-id> [--label "..."]
 *   node governance-core/tools/issue-key.mjs revoke <key-id> [--reason "..."]
 *   node governance-core/tools/issue-key.mjs rotate <operator-id> [--label "..."]
 *   node governance-core/tools/issue-key.mjs list [operator-id]
 *   node governance-core/tools/issue-key.mjs stats
 *
 * What issue does:
 *   1. Checks <operator-id> is a registered operator (from operators.json).
 *   2. Generates an Ed25519 key pair (auth.mjs, node:crypto only).
 *   3. Registers the PUBLIC key in operator-keys.json (safe to commit).
 *   4. Saves the PRIVATE key to governance-core/.keys-local/<keyId>.key
 *      (0600, never overwritten, never committed — see .gitignore).
 *
 * SECURITY — the repo is PUBLIC:
 *   - This tool NEVER prints a private key. It prints the keyId, the
 *     public key, and the private-key file path — never the key itself.
 *   - Private keys live ONLY in .keys-local/. Never copy one into a
 *     file that could be pushed, pasted into chat, or emailed.
 *
 * OWNER KEYS: this tool issues OPERATOR keys only. The owner's key is
 * issued by Matt himself, in person, when he says so — see the owner-key
 * ceremony in operator-auth-design-2026-11-19.md. `issue owner` is
 * refused here on purpose.
 *
 * Issuing a key grants NOTHING. A key proves who an operator is; the
 * operator's mode still decides what it may do. All 21 operators are
 * draft-only, and a key does not change that.
 *
 * This tool never touches the audit log, the staging folder, or any
 * operator's mode. It reads operators.json directly (no Core import),
 * so running it has no side effects beyond the key store and .keys-local/.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateKeyPair,
  registerPublicKey,
  revokeKey,
  rotateKey,
  savePrivateKey,
  listKeys,
  getAuthStats,
} from '../src/auth.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OPERATORS_JSON = path.resolve(here, '../src/operators.json');

function fail(message) {
  console.error(`[issue-key] ERROR: ${message}`);
  process.exitCode = 1;
}

function usage() {
  console.log(`GALINYX operator key tool (v1.4.0)

Usage:
  issue-key.mjs issue <operator-id> [--label "..."]   issue a key for a registered operator
  issue-key.mjs revoke <key-id> [--reason "..."]      revoke a key (it stops verifying)
  issue-key.mjs rotate <operator-id> [--label "..."]  replace an operator's key
  issue-key.mjs list [operator-id]                    list registered keys (public info only)
  issue-key.mjs stats                                 key-store summary

Owner keys are NOT issued by this tool — Matt issues his own key, in
person, when he says so. See operator-auth-design-2026-11-19.md.`);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--label' || arg === '--reason') {
      flags[arg.slice(2)] = argv[i + 1] ?? '';
      i++;
    } else if (arg.startsWith('--label=')) {
      flags.label = arg.slice('--label='.length);
    } else if (arg.startsWith('--reason=')) {
      flags.reason = arg.slice('--reason='.length);
    } else if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function loadOperators() {
  try {
    const data = JSON.parse(readFileSync(OPERATORS_JSON, 'utf8'));
    if (!data || !Array.isArray(data.operators)) return null;
    return new Map(data.operators.map((op) => [op.id, op]));
  } catch {
    return null;
  }
}

function cmdIssue(operatorId, flags) {
  if (operatorId === 'owner') {
    fail(
      "Refusing to issue an owner key from this tool. The owner's key is issued by Matt himself, in person — see the owner-key ceremony in operator-auth-design-2026-11-19.md.",
    );
    return;
  }
  const operators = loadOperators();
  if (!operators) {
    fail('Could not read operators.json. Run from the galinyx-governance folder.');
    return;
  }
  const operator = operators.get(operatorId);
  if (!operator) {
    fail(
      `Unknown operator '${operatorId}'. Registered operators: ${[...operators.keys()].join(', ')}`,
    );
    return;
  }
  const label = flags.label || `issued for ${operator.name}`;
  const generated = generateKeyPair(operatorId, label);
  if (!generated.ok) {
    fail(`Key generation failed: ${generated.reason}`);
    return;
  }
  const registered = registerPublicKey({
    keyId: generated.keyId,
    subject: operatorId,
    subjectType: 'operator',
    publicKey: generated.publicKey,
    label,
  });
  if (!registered.registered) {
    fail(`Public-key registration failed: ${registered.reason}`);
    return;
  }
  const saved = savePrivateKey(generated.keyId, generated.privateKey);
  if (!saved.saved) {
    fail(
      `Public key registered as '${generated.keyId}' BUT the private key could not be saved: ${saved.reason} ` +
        `Revoke '${generated.keyId}' and re-issue — the keypair is unusable without its private key.`,
    );
    return;
  }
  console.log(`Issued a signing key for '${operator.name}' (${operatorId}):`);
  console.log(`  keyId:     ${generated.keyId}`);
  console.log(`  subject:   ${operatorId} (operator)`);
  console.log(`  status:    active`);
  console.log(`  publicKey: ${generated.publicKey}`);
  console.log(`  privateKey: ${saved.path} (0600, .keys-local/ only — never commit, never paste, never email)`);
  console.log('');
  console.log('This key proves identity only. It grants no permission:');
  console.log(`  '${operator.name}' stays ${operator.mode}; publish and spend still need Matt's approval per action.`);
}

function cmdRevoke(keyId, flags) {
  const result = revokeKey(keyId, flags.reason || 'revoked via issue-key tool');
  if (!result.revoked) {
    fail(`Revoke failed: ${result.reason}`);
    return;
  }
  console.log(`Revoked '${keyId}': ${result.reason}`);
  console.log('The key stops verifying immediately. Delete its private-key file from .keys-local/ when convenient — a revoked key is useless, but a deleted one cannot leak.');
}

function cmdRotate(operatorId, flags) {
  if (operatorId === 'owner') {
    fail('Refusing to rotate the owner key from this tool. Owner-key rotation is Matt\'s call, in person.');
    return;
  }
  const operators = loadOperators();
  if (!operators) {
    fail('Could not read operators.json. Run from the galinyx-governance folder.');
    return;
  }
  const operator = operators.get(operatorId);
  if (!operator) {
    fail(`Unknown operator '${operatorId}'.`);
    return;
  }
  const label = flags.label || `rotation for ${operator.name}`;
  const generated = generateKeyPair(operatorId, label);
  if (!generated.ok) {
    fail(`Key generation failed: ${generated.reason}`);
    return;
  }
  const rotated = rotateKey(operatorId, generated.publicKey, label);
  if (!rotated.rotated) {
    fail(`Rotation failed: ${rotated.reason}`);
    return;
  }
  const saved = savePrivateKey(rotated.newKeyId, generated.privateKey);
  if (!saved.saved) {
    fail(
      `Rotation registered new key '${rotated.newKeyId}' BUT the private key could not be saved: ${saved.reason} ` +
        `Revoke '${rotated.newKeyId}' and rotate again — the new keypair is unusable without its private key.`,
    );
    return;
  }
  console.log(`Rotated the key for '${operator.name}' (${operatorId}):`);
  console.log(`  old key(s) revoked: ${rotated.oldKeyIds.length ? rotated.oldKeyIds.join(', ') : '(none were active)'}`);
  console.log(`  new keyId: ${rotated.newKeyId}`);
  console.log(`  publicKey: ${generated.publicKey}`);
  console.log(`  privateKey: ${saved.path} (0600, .keys-local/ only)`);
  console.log('Delete the old private-key file(s) from .keys-local/ when convenient.');
}

function cmdList(operatorId) {
  const keys = listKeys(operatorId || null);
  if (keys.length === 0) {
    console.log(operatorId ? `No keys registered for '${operatorId}'.` : 'No keys registered.');
    return;
  }
  console.log(`${keys.length} key(s)${operatorId ? ` for '${operatorId}'` : ''} (public info only):`);
  for (const key of keys) {
    console.log(`- ${key.keyId}  ${key.subject} (${key.subjectType})  ${key.status}  created ${key.createdAt || '(unknown)'}`);
  }
}

function cmdStats() {
  const stats = getAuthStats();
  console.log('Auth store:');
  console.log(`  keys file:   ${stats.keysFile}`);
  console.log(`  nonces file: ${stats.noncesFile}`);
  console.log(`  keys dir:    ${stats.keysDir}`);
  console.log(`  total keys:  ${stats.totalKeys} (${stats.activeKeys} active, ${stats.revokedKeys} revoked)`);
  console.log(`  owner key registered: ${stats.ownerKeyRegistered ? 'YES' : 'no'}`);
  console.log(`  nonces seen this process: ${stats.noncesSeen}`);
}

const [command, ...rest] = process.argv.slice(2);
const { positional, flags } = parseArgs(rest);

if (flags.help || !command) {
  usage();
  process.exitCode = command ? 0 : 1;
} else if (command === 'issue') {
  if (!positional[0]) fail('issue needs an operator id. Usage: issue-key.mjs issue <operator-id>');
  else cmdIssue(positional[0], flags);
} else if (command === 'revoke') {
  if (!positional[0]) fail('revoke needs a key id. Usage: issue-key.mjs revoke <key-id>');
  else cmdRevoke(positional[0], flags);
} else if (command === 'rotate') {
  if (!positional[0]) fail('rotate needs an operator id. Usage: issue-key.mjs rotate <operator-id>');
  else cmdRotate(positional[0], flags);
} else if (command === 'list') {
  cmdList(positional[0] || null);
} else if (command === 'stats') {
  cmdStats();
} else {
  fail(`Unknown command '${command}'.`);
  usage();
}

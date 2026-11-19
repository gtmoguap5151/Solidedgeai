#!/usr/bin/env node
/**
 * GALINYX Governance Core — owner-key ceremony tool (v1.5.0)
 *
 * The guided, Matt-driven flow for issuing (and, if ever needed,
 * rotating) the owner key. The logic lives in ../src/owner-key.mjs;
 * this file is only the command line.
 *
 *   node governance-core/tools/owner-key.mjs status
 *   node governance-core/tools/owner-key.mjs generate [--confirm]
 *   node governance-core/tools/owner-key.mjs rotate [--confirm]
 *   node governance-core/tools/owner-key.mjs verify-backup --file <path>
 *
 * THE OWNER KEY IS MATT'S. This tool NEVER prints a private key.
 * `generate` and `rotate` refuse to act without --confirm, and without
 * it they print the ceremony instead of doing anything.
 *
 * What happens when Matt issues his key:
 *   1. A fresh Ed25519 keypair is generated.
 *   2. The private key is saved to governance-core/.keys-local/
 *      (0600, gitignored — the repo is public). It is NEVER printed.
 *   3. ONLY the public key is registered in operator-keys.json.
 *   4. A round-trip proof verifies the key works before the ceremony
 *      is declared done.
 *   5. From that moment, unsigned owner approvals STOP WORKING:
 *      approveModeChange() and notification decide() require a valid
 *      owner signature. There is NO recovery for a lost owner key —
 *      back the private key up somewhere Matt controls, and run
 *      `verify-backup` to prove the backup is good BEFORE it is needed.
 */

import {
  generateOwnerKey,
  ownerKeyStatus,
  rotateOwnerKey,
  verifyOwnerKeyBackup,
} from '../src/owner-key.mjs';

const args = process.argv.slice(2);
const command = args[0];
const confirm = args.includes('--confirm');
const fileArg = (() => {
  const i = args.indexOf('--file');
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
})();

function usage() {
  console.log(`GALINYX owner-key ceremony tool (v1.5.0)

Usage:
  owner-key.mjs status                          Show owner-key status (public info only)
  owner-key.mjs generate [--confirm]            Issue Matt's owner key (the ceremony)
  owner-key.mjs rotate [--confirm]              Rotate the owner key (proves possession of the current key)
  owner-key.mjs verify-backup --file <path>     Prove a backup file holds the registered owner key

Without --confirm, generate and rotate print the ceremony and do nothing.
This tool NEVER prints a private key.`);
}

function printStatus() {
  const s = ownerKeyStatus();
  console.log('Owner key status:');
  console.log(`  registered: ${s.registered ? 'YES' : 'NO'}`);
  if (s.registered) {
    console.log(`  keyId: ${s.keyId}`);
    console.log(`  createdAt: ${s.createdAt}`);
    console.log(`  label: ${s.label}`);
    console.log(`  private key file present: ${s.privateKeyFilePresent ? `YES (mode ${s.privateKeyFileMode})` : 'NO — BACK UP THE KEY'}`);
  }
  console.log(`  active owner keys: ${s.activeOwnerKeys}; revoked: ${s.revokedOwnerKeys}`);
  console.log(`  ${s.testKeypairNote}`);
}

function printCeremony(kind) {
  console.log(`\n=== OWNER-KEY ${kind.toUpperCase()} CEREMONY ===\n`);
  console.log('This issues the key that proves an approval really came from Matt.');
  console.log('Read this before you confirm:\n');
  console.log('  1. A fresh Ed25519 keypair is generated on this machine.');
  console.log('  2. The PRIVATE key is saved to governance-core/.keys-local/ (0600).');
  console.log('     It is NEVER printed, logged, or pasted anywhere.');
  console.log('  3. ONLY the public key is registered in operator-keys.json.');
  console.log('  4. Once registered, UNSIGNED owner approvals STOP WORKING.');
  console.log('     Mode changes and notification decisions will require a');
  console.log('     signature from this key.');
  console.log('  5. THERE IS NO RECOVERY FOR A LOST OWNER KEY. Back the');
  console.log('     private key up somewhere Matt controls, then run');
  console.log('     `verify-backup --file <path>` to prove the backup is good.');
  if (kind === 'rotate') {
    console.log('  6. Rotation requires the CURRENT owner key: the rotation is');
    console.log('     authorized by a proof signed with it. Without the current');
    console.log('     private key, rotation is refused.');
  }
  console.log('\nNothing was done. To run the ceremony, re-run with --confirm.');
  console.log('Only Matt can order this.\n');
}

if (command === 'status') {
  printStatus();
} else if (command === 'generate') {
  if (!confirm) {
    printCeremony('generate');
  } else {
    const r = generateOwnerKey({ confirmed: true });
    console.log(r.generated ? 'Owner key generated.' : 'Owner key NOT generated.');
    console.log(`  ${r.reason}`);
    if (r.keyId) console.log(`  keyId: ${r.keyId}`);
    if (r.publicKey) console.log(`  publicKey: ${r.publicKey}`);
    if (r.privateKeyPath) console.log(`  private key saved at: ${r.privateKeyPath} (0600 — back it up now)`);
    if (!r.generated) process.exitCode = 1;
  }
} else if (command === 'rotate') {
  if (!confirm) {
    printCeremony('rotate');
  } else {
    const r = rotateOwnerKey({ confirmed: true });
    console.log(r.rotated ? 'Owner key rotated.' : 'Owner key NOT rotated.');
    console.log(`  ${r.reason}`);
    if (r.newKeyId) console.log(`  new keyId: ${r.newKeyId}`);
    if (r.oldKeyIds) console.log(`  revoked: ${r.oldKeyIds.join(', ') || '(none)'}`);
    if (!r.rotated) process.exitCode = 1;
  }
} else if (command === 'verify-backup') {
  if (!fileArg) {
    console.error('verify-backup requires --file <path>.');
    process.exitCode = 1;
  } else {
    const r = verifyOwnerKeyBackup({ file: fileArg });
    console.log(r.matches ? 'BACKUP VERIFIED.' : 'BACKUP NOT VERIFIED.');
    console.log(`  ${r.reason}`);
    if (!r.matches) process.exitCode = 1;
  }
} else {
  usage();
  if (command) process.exitCode = 1;
}

#!/usr/bin/env node
/**
 * GALINYX Governance Core — audit-log verification tool (v1.5.0)
 *
 * Verifies the hash-chained audit log. Read-only: it never modifies
 * the log. Exit 0 when the log verifies, exit 1 when it does not.
 *
 *   node governance-core/tools/verify-audit.mjs
 *       Verify src/audit-log.jsonl against src/audit-genesis.json.
 *   node governance-core/tools/verify-audit.mjs <audit-file> [genesis-file]
 *       Verify a different log (e.g. a copy under test).
 *   node governance-core/tools/verify-audit.mjs --create-genesis
 *       Record the genesis of the CURRENT log: the hash of its exact
 *       bytes, the line count, and the hash of the last line. Run
 *       ONCE, when hash-chaining begins. The log itself is NOT
 *       modified — the genesis is a separate file, and the pre-chain
 *       lines stay byte-identical. Refuses to overwrite an existing
 *       genesis file (a genesis is written once; rewriting it would
 *       defeat its purpose).
 *
 * What verification checks:
 *   1. Genesis region: the first N lines (recorded in the genesis
 *      file) still hash to the recorded value. Any edit, deletion, or
 *      insertion in the pre-chain region fails here.
 *   2. Chain links: every chained entry's prevHash equals the SHA-256
 *      of the raw previous line, and its entryHash matches its own
 *      contents. Any edit after the entry was written fails here.
 *   3. Unchained entries (appended by writers outside the Core, e.g.
 *      Xena recording owner decisions directly) are listed with line
 *      numbers. They are warnings, not failures — but their count is
 *      visible, so a forged entry cannot hide by omitting chain fields.
 *
 * The chain is positional (line N links to line N-1 by raw bytes). It
 * deliberately does not depend on seq numbers: the live log has
 * duplicate seqs 51-60 (a seq-counter restart on 2026-11-19), and the
 * chain covers the log as it is. History is never rewritten.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createGenesis,
  verifyAuditFile,
  writeGenesis,
} from '../src/audit-chain.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultAudit = path.resolve(here, '../src/audit-log.jsonl');
const defaultGenesis = path.resolve(here, '../src/audit-genesis.json');

const args = process.argv.slice(2);

if (args.includes('--create-genesis')) {
  if (existsSync(defaultGenesis)) {
    console.error(
      `Genesis file already exists: ${defaultGenesis}\nA genesis is written once. Rewriting it would let a tampered log pass. Refusing.`,
    );
    process.exitCode = 1;
  } else {
    const g = createGenesis(defaultAudit);
    if (!g.ok) {
      console.error(`Could not create genesis: ${g.reason}`);
      process.exitCode = 1;
    } else {
      writeGenesis(g.genesis, defaultGenesis);
      console.log(`Genesis recorded: ${defaultGenesis}`);
      console.log(`  lines covered: ${g.genesis.lines}`);
      console.log(`  bytesHash: ${g.genesis.bytesHash}`);
      console.log(`  lastLineHash: ${g.genesis.lastLineHash}`);
      console.log('  The log itself was not modified. Pre-chain lines stay byte-identical.');
    }
  }
} else {
  const auditFile = args[0] ? path.resolve(args[0]) : defaultAudit;
  const genesisFile = args[1]
    ? path.resolve(args[1])
    : existsSync(defaultGenesis) && auditFile === defaultAudit
      ? defaultGenesis
      : null;
  const report = verifyAuditFile(auditFile, genesisFile);
  console.log(`Audit log: ${report.file}`);
  console.log(`  lines: ${report.lines}`);
  if (report.genesis.checked) {
    console.log(
      `  genesis: ${report.genesis.ok ? 'OK' : 'FAILED'} — ${report.genesis.lines} lines, ${report.genesis.reason}`,
    );
  } else {
    console.log(`  genesis: not checked (${report.genesis.reason})`);
  }
  console.log(`  chained entries verified: ${report.chained}`);
  console.log(
    `  unchained entries: ${report.unchained.length}${report.unchained.length ? ` (lines ${report.unchained.join(', ')})` : ''}`,
  );
  if (report.errors.length) {
    console.log('  ERRORS:');
    for (const e of report.errors) console.log(`    - ${e}`);
  }
  console.log(report.ok ? '\nVERIFIED: the audit log is intact.' : '\nFAILED: the audit log does NOT verify.');
  process.exitCode = report.ok ? 0 : 1;
}

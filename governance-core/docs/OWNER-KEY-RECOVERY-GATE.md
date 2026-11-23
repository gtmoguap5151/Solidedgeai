# Owner-key recovery gate — security change proposal

Status: proposal only; not deployed and not merged.
Scope: governance-core owner-key issuance and recovery.
Production owner-key generation: NOT authorized by this document and must remain disabled until the safeguards below are implemented and tested.

## Verified current behavior

- `generateOwnerKey({ confirmed: true })` creates an Ed25519 keypair.
- It writes the private key to the local `.keys-local/` directory, then registers the public key in `operator-keys.json`, then performs a round-trip signature check.
- `verifyOwnerKeyBackup({ file })` compares a backup file's derived public key with an already registered owner public key.
- Therefore, backup verification is currently post-registration, not a prerequisite to registration.
- The repository's current `operator-keys.json` was observed with an empty `keys` array during review. This is a repository snapshot, not proof about any separately deployed environment.

## Required safer issuance design

Do not solve this by copying an unencrypted private key to Gmail, GitHub, Cloudflare, or another ordinary account. Do not log, print, transmit, or commit private-key material.

Replace one-step issuance with a staged ceremony:

1. **Prepare:** Generate a new Ed25519 keypair in a controlled local environment. Save the private key only in a private staging location with restrictive directory/file permissions. Do not register the public key yet.
2. **Back up under owner control:** Provide an explicit, documented export path to a user-selected backup medium or approved encrypted secret-storage mechanism. The implementation must not assume that email, GitHub, or a generic cloud drive is suitable. If no suitable backup target is available, stop here and discard the unregistered staged key.
3. **Verify:** Read the backup back from its actual destination and derive its public key. Require an exact match with the staged key's public key. Never display or log private material.
4. **Activate:** Only after successful read-back verification, require a separate explicit owner confirmation and register the public key. Then perform the existing sign/verify round trip.
5. **Failure handling:** If any step fails, do not register the key. Report only safe metadata and a recovery-safe status. Avoid automatic deletion if it could destroy the only recoverable copy; provide a documented cleanup decision.
6. **Recovery drill:** Before production use, demonstrate that a copy of the backup can be restored into a clean test environment and successfully sign a test proof matching the registered public key. Do not test with or expose the production key.

## Phone-only operational requirements

- The owner must control the device and destination used for key custody; a temporary assistant execution environment is not owner-controlled storage.
- Do not assume a personal Gmail account is a secure private-key vault.
- GitHub is for source code and public-key records only; never commit a private key or backup.
- Cloudflare secrets are not automatically a suitable personal recovery vault. Use only a documented, access-controlled secret-management design with a tested owner recovery path.
- If facility/device rules prevent use of a suitable backup mechanism, defer production issuance. Deferral is safer than creating an unrecoverable owner credential.

## Implementation and test acceptance criteria

- Generation cannot register an owner public key until backup read-back verification succeeds.
- The backup destination is explicit; no implicit upload or network transmission occurs.
- No private-key bytes appear in stdout/stderr, logs, Git objects, test snapshots, or error messages.
- Private staging and backup permissions are checked where the platform supports them; unsupported permission guarantees cause a clear stop or warning.
- Tests cover: no confirmation; missing backup; unreadable backup; malformed key; mismatched key; correct backup; failed registration; failed round-trip proof; interruption between stages; restore in a clean temporary directory.
- Tests use temporary keys and OS temporary directories only. They must never register the repository's local test keypair or a production key.
- Rotation must use the same staged-backup-verify-activate sequence, while still requiring proof from the current owner key.
- Existing production behavior and any deployed environment must be independently inspected before rollout. This branch does not change live permissions or deployment.

## Current decision

No production owner key should be generated until an owner-controlled backup destination is selected, the staged ceremony is implemented, and the restore drill passes. No private key should be sent in chat or email.

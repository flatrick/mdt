# Codex Home Hardening Bundle

This folder contains a portable bundle for hardening the sensitive base files in a user's Codex home on another machine or for another user.

## Files

- `apply-codex-home-hardening.mjs` is the primary cross-platform apply script for Node.js
- `verify-codex-home-hardening.mjs` is the primary cross-platform verification script for Node.js
- `PROMPT.md` gives an adaptive Codex prompt for machines whose setup differs from this one

## Usage

Run with Node.js as the target user:

```bash
node ./hardening/apply-codex-home-hardening.mjs
node ./hardening/verify-codex-home-hardening.mjs
```

To target a different Codex home path:

```bash
node ./hardening/apply-codex-home-hardening.mjs --codex-home "/home/someone/.codex"
```

## Limits

- On Windows, auth hardening uses `icacls` via Node child-process execution and may require elevation depending on local policy.
- On Linux and macOS, auth hardening uses `chmod 600` on `auth.json`, which is the closest portable equivalent to the Windows ACL restriction.
- The scripts only harden `auth.json` directly. Use the prompt in `PROMPT.md` if you also want Codex to inspect and classify other sensitive runtime-state files without modifying unrelated workflow files.

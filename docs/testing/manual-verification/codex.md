# Codex Manual Verification

Use this page for quick Codex sanity checks and deeper runtime verification in a
real local Codex session.

## Quick Smoke

Codex does not use the same markdown command surface as Claude Code or Cursor.
For Codex, the smoke path is:

- the `tool-setup-verifier` skill under `.agents/skills/`
- the local scripts:
  - `node scripts/verify-tool-setups.js`
  - `node scripts/smoke-tool-setups.js`
  - `node scripts/smoke-codex-workflows.js`

Expected:
- `verify-tool-setups.js` passes
- `smoke-tool-setups.js` reports Codex CLI probes as `PASS` when Codex is installed
- `smoke-codex-workflows.js` reports the current Codex MDT workflows as `PASS`

## Likely Deeper Checks

- local Codex launch verification for this repo
- sandbox/profile verification for trusted local testing
- install and config verification under the Codex repo template
- manual checks for workflows driven by `AGENTS.md` and installed skills
- any future Codex-native continuous-learning behavior

## Notes

- Keep this page focused on behavior that must be verified in a real local Codex session.
- Keep CLI-first checks in [docs/tools/local-verification.md](../../tools/local-verification.md).

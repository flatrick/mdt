# Manual Verification

Use this folder for tool-specific, human-run verification checklists.

Purpose:
- confirm behavior that cannot be proven well by static validation or unit tests
- record expected outputs and artifacts for local installs
- keep verification steps under `docs/` instead of in chat history
- record the exact version used for the last successful manual verification

Current checklists:
- [Claude Code](./claude-code.md)
- [Codex](./codex.md)
- [Cursor](./cursor.md)

Use [docs/tools/local-verification.md](../../tools/local-verification.md) for the higher-level verification playbook and CLI-first evidence rules.

Completion rule:
- `mdt verify tool-setups` proves the normal install surface and workflow contract
- `mdt dev smoke ...` is an extra maintainer check for `--dev` installs
- these manual verification pages prove runtime behavior inside the real tool
- do not collapse those into a single pass when documenting readiness

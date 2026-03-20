# Commands Layer

Read [../AGENTS.md](../AGENTS.md) first. This file adds local rules for `commands/`.

## Purpose

- `commands/*.md` holds shared markdown workflow prompts.
- Do not assume a markdown command maps directly to every tool. Check `docs/tools/surfaces/commands.md` before documenting parity.

## Local Invariants

- Keep command prompts outcome-oriented and reusable across tools where possible.
- If a command is workflow-defining, keep its behavior aligned with `workflow-contracts/workflows/` and `docs/tools/workflow-matrix.md`.
- Cursor-specific command realization lives under `cursor-template/commands/`; Codex workflow realization is not a markdown-command surface.

## When Editing Here Also Update

- [../docs/tools/authoring.md](../docs/tools/authoring.md)
- [../docs/tools/surfaces/commands.md](../docs/tools/surfaces/commands.md)
- [../cursor-template/commands](../cursor-template/commands)
- [../workflow-contracts/workflows](../workflow-contracts/workflows)

## Local Validation

- `node tests/ci/validators.test.js`
- `node scripts/mdt.js verify tool-setups`

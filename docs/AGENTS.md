# Docs Layer

Read [../AGENTS.md](../AGENTS.md) first. This file adds local rules for `docs/`.

## Purpose

- `docs/` is the human-facing documentation tree for MDT.
- Capability truth for Claude Code, Cursor, and Codex lives in `docs/supported-tools.md` and `docs/tools/`.

## Local Invariants

- Keep docs tool-agnostic by default; introduce tool-specific sections only where native surfaces actually differ.
- Put stable reference material under `docs/`; use local `AGENTS.md` files only for short agent-facing overlays.
- If runtime behavior changes, update the closest doc at the same time instead of leaving drift for a follow-up.

## When Editing Here Also Update

- [supported-tools.md](./supported-tools.md) for cross-tool support framing
- [tools](./tools) for capability and authoring changes
- [testing/manual-verification](./testing/manual-verification) when human-run steps change

## Local Validation

- `node tests/ci/validators.test.js`
- `node scripts/mdt.js verify tool-setups`

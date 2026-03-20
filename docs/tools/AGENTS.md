# Tool Docs Layer

Read [../../AGENTS.md](../../AGENTS.md) and [../AGENTS.md](../AGENTS.md) first. This file adds local rules for `docs/tools/`.

## Purpose

- `docs/tools/` is the authoritative docs pack for MDT capability claims, authoring guidance, and workflow realization across Claude Code, Cursor, and Codex.

## Local Invariants

- Keep capability facts in the per-tool pages and matrices.
- Keep `authoring.md` as the contributor guide and `surfaces/` as the comparison layer; neither should become a conflicting truth source.
- Stamp verification claims with exact versions or `not-locally-verified`.

## When Editing Here Also Update

- [capability-matrix.md](./capability-matrix.md) when support labels change
- [workflow-matrix.md](./workflow-matrix.md) when workflow realization changes
- [local-verification.md](./local-verification.md) and [../testing/manual-verification](../testing/manual-verification) when verification procedures change

## Local Validation

- `node tests/ci/validators.test.js`
- `node scripts/mdt.js verify tool-setups`

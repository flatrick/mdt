# Claude Template Layer

Read [../AGENTS.md](../AGENTS.md) first. This file adds local rules for `claude-template/`.

## Purpose

- `claude-template/` is the source tree for MDT materialized Claude surfaces.
- Files here describe what MDT installs for Claude; they are not cross-tool truth.

## Local Invariants

- Keep template content aligned with the shared source files it mirrors or references.
- If a Claude template change affects workflow behavior, update `docs/tools/claude-code.md` and the workflow matrix in the same change.
- Do not use the existence of a Claude template file to claim parity in Cursor or Codex docs.

## When Editing Here Also Update

- [../docs/tools/claude-code.md](../docs/tools/claude-code.md)
- [../docs/tools/workflow-matrix.md](../docs/tools/workflow-matrix.md)
- [../scripts/install-mdt.js](../scripts/install-mdt.js) when install layout changes

## Local Validation

- `node scripts/mdt.js verify tool-setups`

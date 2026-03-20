# Cursor Template Layer

Read [../AGENTS.md](../AGENTS.md) first. This file adds local rules for `cursor-template/`.

## Purpose

- `cursor-template/` is the source tree for MDT materialized Cursor surfaces.
- These files document MDT's Cursor realization, not blanket vendor-native parity.

## Local Invariants

- Keep project-only rule behavior explicit; do not document Cursor global rules as if MDT supports them.
- Treat `cursor-template/hooks.json` and related wrappers as an MDT adapter layer.
- If a Cursor template change alters a shared workflow outcome, update the docs pack and workflow matrix in the same pass.

## When Editing Here Also Update

- [../docs/tools/cursor.md](../docs/tools/cursor.md)
- [../docs/tools/surfaces](../docs/tools/surfaces)
- [../scripts/install-mdt.js](../scripts/install-mdt.js)

## Local Validation

- `node scripts/mdt.js verify tool-setups`

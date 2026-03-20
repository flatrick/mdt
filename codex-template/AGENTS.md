# Codex Template Layer

Read [../AGENTS.md](../AGENTS.md) first. This file adds local rules for `codex-template/`.

## Purpose

- `codex-template/` is the source tree for MDT materialized Codex surfaces.
- The Codex model is layered `AGENTS.md`, `config.toml`, and skills, not Claude-style commands or hooks.

## Local Invariants

- Keep Codex workflow realization aligned with the shipped skills and `config.toml`.
- Do not describe Codex as supporting Claude-style hooks or markdown command parity just because MDT has analogous workflow outcomes.
- If a Codex template change affects install shape, update the Codex manual verification page and docs pack at the same time.

## When Editing Here Also Update

- [../docs/tools/codex.md](../docs/tools/codex.md)
- [../docs/tools/surfaces](../docs/tools/surfaces)
- [../scripts/install-mdt.js](../scripts/install-mdt.js)

## Local Validation

- `node scripts/mdt.js verify tool-setups`

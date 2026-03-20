# Hooks Layer

Read [../AGENTS.md](../AGENTS.md) first. This file adds local rules for `hooks/`.

## Purpose

- `hooks/` holds hook-facing config mirrors and adapter entrypoints.
- Shared hook logic belongs in `scripts/hooks/`; wrappers here should stay thin.

## Local Invariants

- Treat Cursor hooks as an MDT adapter, not vendor-native truth.
- Update platform-scoped hook config first, then sync any mirrors.
- Keep event normalization in `hooks/scripts/` small and push reusable logic into `scripts/hooks/` or `scripts/lib/`.

## When Editing Here Also Update

- [README.md](./README.md)
- [../claude-template/hooks.json](../claude-template/hooks.json)
- [../cursor-template/hooks.json](../cursor-template/hooks.json)
- [../docs/tools/surfaces/hooks.md](../docs/tools/surfaces/hooks.md)

## Local Validation

- `node scripts/sync-hook-mirrors.js`
- `node tests/ci/validators.test.js`

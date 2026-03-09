# Template Source Migration

This document is the stable entrypoint for the completed template-source
migration record.

## Purpose

The migration separated:

- canonical MDT source assets
- per-tool adapter/template source
- generated or machine-local runtime directories

The goal is to stop treating repo-root runtime-style directories like `.cursor/`, `.codex/`, `.opencode/`, and `.claude/` as canonical tracked source.

## Current State

The migration is complete.

- `claude-template/`, `cursor-template/`, `codex-template/`, and
  `opencode-template/` are the canonical per-tool template dirs.
- `.claude/`, `.cursor/`, `.codex/`, and `.opencode/` are runtime/install dirs,
  not canonical repo source.
- `claude-template/hooks.json` is the canonical Claude hook config source.
- `hooks/hooks.json` remains the synced Claude-facing mirror.

## Historical Record

Detailed migration history now lives in:

- [History: 2026-03-09 template-source migration](history/2026-03-09.template-source-migration.md)

Legacy migration child-note paths are preserved as historical stubs:

- [Plan stub](template-source-migration-plan.md)
- [Inventory stub](template-source-migration-inventory.md)
- [Status stub](template-source-migration-status.md)

## Active Follow-Up

Further work should be tracked outside this migration record:

- [NEXT-STEPS.md](../NEXT-STEPS.md)
- [README.md](../README.md)

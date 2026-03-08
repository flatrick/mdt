# Template Source Migration

This document is the entrypoint for the template-source migration work.

Use these documents together:

- [Plan](template-source-migration-plan.md) — target architecture, phases, risks, and verification plan
- [Inventory](template-source-migration-inventory.md) — original classification of tracked runtime-style source assets
- [Status](template-source-migration-status.md) — what has been completed, what remains, and the current recommended next step

## Purpose

The migration separates:

- canonical MDT source assets
- per-tool adapter/template source
- generated or machine-local runtime directories

The goal is to stop treating repo-root runtime-style directories like `.cursor/`, `.codex/`, `.opencode/`, and `.claude/` as canonical tracked source.

## Current Direction

Completed so far:

- Cursor source moved to `cursor-template/`
- Codex source moved to `codex-template/`
- OpenCode source moved to `opencode-template/`
- Claude hook config moved to `claude-template/hooks.json`
- local Claude package-manager state stopped being tracked

For the latest exact state, see [Status](template-source-migration-status.md).

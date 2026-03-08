# Template Source Migration Status

Last updated: 2026-03-08

## Summary

The migration is in progress and the major runtime-style source trees have already been moved out of repo-root dot-directories for Cursor, Codex, and OpenCode. Claude has only been partially migrated so far: the tracked local package-manager file was removed, and the Claude hook config source now lives in `claude-template/hooks.json`.

The repository is currently in a workable intermediate state:

- `cursor-template/` is the tracked Cursor adapter source
- `codex-template/` is the tracked Codex adapter source
- `opencode-template/` is the tracked OpenCode adapter source
- `claude-template/` exists and currently contains the Claude hook config source
- runtime directories like `.claude/`, `.cursor/`, `.codex/`, and `.opencode/` are intended to be install outputs or local state, not canonical repo source

## Completed

### 1. Cursor source migration

Completed via:

- commit `c0e5e66` `refactor: move cursor and codex sources to template dirs`

What was done:

- moved tracked Cursor source from `.cursor/` to `cursor-template/`
- rewired installer and verification logic to use `cursor-template/`
- updated relevant docs and tests to stop treating repo `.cursor/` as canonical source

### 2. Codex source migration

Completed via:

- commit `c0e5e66` `refactor: move cursor and codex sources to template dirs`

What was done:

- moved tracked Codex source from `.codex/` to `codex-template/`
- rewired installer and workflow verification to use `codex-template/`
- updated relevant docs and tests to stop treating repo `.codex/` as canonical source

### 3. OpenCode source migration

Completed via:

- commit `51e4d29` `refactor: move opencode sources to template dir`

What was done:

- moved tracked OpenCode source from `.opencode/` to `opencode-template/`
- rewired metadata validation, workflow verification, docs, and tests to use `opencode-template/`

### 4. Stop tracking local Claude package-manager state

Completed via:

- commit `a601ebe` `chore: stop tracking local claude package manager config`

What was done:

- removed tracked `.claude/package-manager.json`
- documented it as ignored local-only runtime state

### 5. Claude hook config migration

Completed via:

- commit `d448be7` `refactor: move claude hook config to template dir`

What was done:

- moved tracked Claude hook source from `hooks/claude/hooks.json` to `claude-template/hooks.json`
- kept `hooks/hooks.json` as the Claude-facing mirror
- updated hook platform logic, validators, docs, and tests

### 6. Validation state confirmed after Claude slice

Confirmed locally after the Claude hook move:

- `node .\\tests\\run-all.js --profile claude` passed
- `node .\\tests\\run-all.js --profile codex` passed

Additional targeted checks that passed during this migration:

- `node scripts/verify-tool-setups.js`
- `node scripts/smoke-codex-workflows.js`
- `node scripts/ci/validate-hooks.js`
- `node scripts/ci/validate-markdown-links.js`
- `node scripts/ci/validate-markdown-path-refs.js`

## Remaining Work

### 1. Decide the final top-level layout

This is the biggest remaining architectural decision.

The repo is still structurally mixed:

- root-level `agents/`, `commands/`, `skills/`, `rules/`, and `hooks/` still act as canonical MDT assets
- tool adapters now live in `cursor-template/`, `codex-template/`, `opencode-template/`, and partially in `claude-template/`

What still needs to be decided:

- whether to keep canonical MDT assets at repo root
- whether to consolidate all tool-specific adapters under a common parent such as `templates/`
- how `hooks/` should be split between canonical/shared hook logic, per-tool hook sources, and mirrors

### 2. Finish the Claude adapter model

Claude is still only partially template-shaped.

Still to clarify:

- what belongs in `claude-template/` beyond `hooks.json`
- whether any other Claude-only source assets should move there
- what remains canonical MDT source versus Claude-only adapter glue

### 3. Clean up docs to match the final chosen structure

Some docs have already been updated to the new template-source model, but a full cleanup pass is still needed after the final structure decision.

Expected targets:

- `README.md`
- `AGENTS.md`
- `docs/tools/*`
- migration docs themselves

### 4. Add a durable migration-complete checklist

Once the final structure is chosen, this status file should be updated with:

- final accepted layout
- explicit “done” criteria
- verification commands for a migration-complete repo

## Known Decisions

- Runtime/install directories should not be tracked as canonical source.
- `.claude/`, `.cursor/`, `.codex/`, and `.opencode/` are intended to be local state or rendered outputs.
- Root-level shared MDT assets should not automatically be treated as Claude-only just because Claude was the original reference implementation.
- The current template-source move is about source ownership and layout, not broad feature redesign.

## Current Recommended Next Step

Before doing more moves, define the final structural model clearly.

Recommended next action:

1. decide whether the long-term adapter layout should stay as:
   - `claude-template/`
   - `cursor-template/`
   - `codex-template/`
   - `opencode-template/`
2. or be normalized into a single parent such as:
   - `templates/claude/`
   - `templates/cursor/`
   - `templates/codex/`
   - `templates/opencode/`
3. then update the migration plan to match that final decision before more filesystem churn

## Notes For Future Agents

- Use this file as the first status read.
- Use [template-source-migration-plan.md](template-source-migration-plan.md) for the intended architecture.
- Use [template-source-migration-inventory.md](template-source-migration-inventory.md) for the original source classification.
- Confirm actual completion state against git history when needed, especially these commits:
  - `c0e5e66`
  - `51e4d29`
  - `a601ebe`
  - `d448be7`

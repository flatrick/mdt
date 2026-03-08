# Template-Source Migration Inventory

Phase 1 inventory for the template-source migration described in
[template-source-migration-plan.md](./template-source-migration-plan.md).

This inventory classifies the currently tracked tool-runtime directories so the
next migration steps can move only true source assets into explicit template
directories.

## Current Tool-Runtime Directories

| Current Path | Classification | Planned Destination | Notes |
| --- | --- | --- | --- |
| `.claude/package-manager.json` | template source | `claude-template/config/package-manager.json` | Remaining tracked Claude-specific config at repo root. |
| `.cursor/hooks.json` | template source | `cursor-template/config/hooks.json` | Checked-in Cursor hook config currently lives in a runtime-named dir. |
| `.cursor/hooks/` | template source | `cursor-template/hooks/` | Cursor adapter hook scripts are tracked source, not local output. |
| `.cursor/rules/` | template source | `cursor-template/rules/` | Cursor project-rule adapter source. |
| `.cursor/skills/frontend-slides/` | template source | `cursor-template/skills/frontend-slides/` | Only Cursor-specific skill currently present. |
| `.cursor/.gitignore` | obsolete | remove | Tool-runtime-local ignore file should not be part of canonical source. |
| `.codex/AGENTS.md` | template source | `codex-template/AGENTS.md` | Codex-specific supplement for installed `~/.codex/AGENTS.md`. |
| `.codex/config.toml` | template source | `codex-template/config.toml` | Codex reference config used by installer and verification. |
| `.opencode/commands/` | template source | `opencode-template/commands/` | OpenCode command adapter source. |
| `.opencode/instructions/` | template source | `opencode-template/instructions/` | OpenCode instructions surface. |
| `.opencode/plugins/` | template source | `opencode-template/plugins/` | OpenCode plugin adapter source. |
| `.opencode/prompts/` | template source | `opencode-template/prompts/` | Agent prompt source for OpenCode. |
| `.opencode/tools/` | template source | `opencode-template/tools/` | OpenCode tool implementation source. |
| `.opencode/index.ts` | template source | `opencode-template/index.ts` | OpenCode package entrypoint. |
| `.opencode/opencode.json` | template source | `opencode-template/opencode.json` | OpenCode config manifest. |
| `.opencode/package.json` | template source | `opencode-template/package.json` | OpenCode package metadata. |
| `.opencode/package-lock.json` | template source | `opencode-template/package-lock.json` | Lockfile should move with the OpenCode package source. |
| `.opencode/README.md` | template source | `opencode-template/README.md` | Adapter/package-local docs. |
| `.opencode/tsconfig.json` | template source | `opencode-template/tsconfig.json` | OpenCode package build config. |
| `.opencode/MIGRATION.md` | template source | `opencode-template/MIGRATION.md` | Historical adapter-local migration notes. |

## First Migration Slice

Start with Cursor and Codex:

1. Move `.cursor/` tracked source assets into `cursor-template/`
2. Move `.codex/` tracked source assets into `codex-template/`
3. Update installer, local verification scripts, and docs to treat those
   template dirs as the new source of truth

OpenCode and remaining Claude-specific tracked assets should follow after the
Cursor/Codex pattern is stable.

## Known Reference Hotspots

These areas currently refer to `.cursor/` or `.codex/` as if they are canonical
repo source and will need follow-up during the first slice:

- `scripts/install-mdt.js`
- `scripts/lib/tool-workflow-contract.js`
- `scripts/smoke-codex-workflows.js`
- `docs/tools/*`
- `skills/tool-doc-maintainer/SKILL.md`
- `tests/scripts/install-mdt*.test.js`
- `tests/scripts/verify-tool-setups.test.js`

## Scope Note

This inventory is about tracked source ownership, not about installed runtime
outputs. Real project/home-directory outputs such as `./.cursor/` or
`~/.codex/` should remain install targets after the migration.

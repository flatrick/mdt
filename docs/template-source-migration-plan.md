# Template-Source Migration Plan

## Summary

Move all tool-specific checked-in source assets out of runtime-style directories like `.claude/`, `.cursor/`, `.codex/`, and `.opencode/` and into explicit template directories:

- `claude-template/`
- `cursor-template/`
- `codex-template/`
- `opencode-template/`

The repo should track templates only. Real tool dirs should be treated as install outputs, local state, or test fixtures, and should not be canonical source inside the repo.

## Goals

- Make the repo's source of truth explicit
- Stop mixing template assets with real tool-runtime directory names
- Simplify installer logic and future parity work
- Avoid accidentally committing local tool state
- Make tests verify rendered installs rather than repo-owned fake live installs

## Target Model

### 1. Canonical source dirs

Use these as the only tracked tool adapter sources:

- `claude-template/`
- `cursor-template/`
- `codex-template/`
- `opencode-template/`

Each template dir should contain only assets that are intentionally shipped for that tool.

### 2. Runtime/install dirs

Treat these as generated or local-only outputs:

- `.claude/`
- `.cursor/`
- `.codex/`
- `.opencode/`

These should be ignored in the repo root unless a narrowly scoped exception is explicitly needed for tests.

## Migration Phases

### Phase 1. Inventory and classify

Audit everything currently under:

- `.claude/`
- `.cursor/`
- `.codex/`
- `.opencode/`

For each file, classify it as one of:

- template source
- generated/install output
- local-only state
- test fixture
- obsolete

Output should be a migration table with:

- current path
- new path
- classification
- notes

### Phase 2. Create template directory structure

Create the new source layout.

Suggested structure:

- `claude-template/commands/`
- `claude-template/hooks/`
- `claude-template/config/`
- `cursor-template/hooks/`
- `cursor-template/rules/`
- `cursor-template/skills/`
- `cursor-template/config/`
- `codex-template/config/`
- `codex-template/skills/`
- `opencode-template/commands/`
- `opencode-template/prompts/`
- `opencode-template/plugins/`
- `opencode-template/tools/`
- `opencode-template/config/`

Keep names boring and literal. Do not over-abstract yet.

### Phase 3. Move source assets

Move tracked adapter content from dot-directories into the template dirs.

Examples:

- `.cursor/hooks/*` -> `cursor-template/hooks/*`
- `.cursor/rules/*` -> `cursor-template/rules/*`
- `.codex/AGENTS.md` -> `codex-template/AGENTS.md`
- `.codex/config.toml` -> `codex-template/config.toml`
- `.opencode/commands/*` -> `opencode-template/commands/*`
- `.opencode/prompts/*` -> `opencode-template/prompts/*`
- `.opencode/plugins/*` -> `opencode-template/plugins/*`
- `.opencode/tools/*` -> `opencode-template/tools/*`

If Claude still has any tracked source under `.claude/`, move that too.

### Phase 4. Update installer

Refactor [scripts/install-mdt.js](../scripts/install-mdt.js) so it installs from `*-template/` dirs only.

Rules:

- source paths come from template dirs
- destination paths are real runtime dirs like `.cursor/`, `.claude/`, `~/.codex/`
- no installer logic should treat repo `.cursor/` or `.codex/` as canonical source anymore

### Phase 5. Update validators and smoke tests

Update local verification to use template dirs as source of truth.

Change:

- contract tests should validate template completeness
- install tests should render temp installs from templates
- smoke tests should still probe local installed tools
- docs should reference template dirs where they currently imply repo dot-dirs are source

Likely affected:

- `scripts/verify-tool-setups.js`
- `scripts/smoke-codex-workflows.js`
- install tests
- markdown/path validators where needed

### Phase 6. Update docs

Revise docs so they distinguish clearly between:

- tracked template source in the repo
- installed output in a project/home directory
- local/manual verification surfaces

Must update at least:

- `docs/supported-tools.md`
- `docs/tools/*`
- `AGENTS.md`
- `NEXT-STEPS.md`
- `BACKLOG.md`

### Phase 7. Ignore runtime dirs

Add or tighten ignore rules so real runtime dirs are not tracked as source.

Likely rules:

- `.claude/`
- `.cursor/`
- `.codex/`
- `.opencode/`

If some test fixtures must remain, move them under a dedicated fixture location instead of keeping partial exceptions in runtime-named dirs.

## Important Decisions

### Decision 1. Test fixtures

Do not keep fixtures inside runtime-named dirs at repo root.
If needed, move them to something like:

- `tests/fixtures/claude-template/`
- `tests/fixtures/cursor-install/`

### Decision 2. Commands and skills parity

Do not use this migration to redesign cross-tool feature parity.
This pass is about source layout and ownership boundaries, not feature expansion.

### Decision 3. Cursor desktop

Keep Cursor desktop verification manual for now.
This migration should not try to automate desktop-only behavior.

## Risks

- Installer breakage during path migration
- Tests and docs still referencing old dot-dir source paths
- Ambiguity between source templates and rendered outputs during transition
- Large diff if moves and behavior changes are mixed together

Mitigation:

- do the move in stages
- keep source moves separate from behavior changes where possible
- add temporary compatibility shims only if strictly needed

## Recommended Commit Sequence

1. `refactor: introduce tool template source directories`
2. `refactor: move cursor and codex adapter assets to templates`
3. `refactor: move opencode and claude adapter assets to templates`
4. `test: update installers and verification for template sources`
5. `docs: document template-source model and runtime ignores`

## Verification Plan

After each phase, run locally:

- `node scripts/verify-tool-setups.js`
- `node scripts/smoke-tool-setups.js`
- `node scripts/smoke-codex-workflows.js`
- `node scripts/ci/validate-hook-mirrors.js`
- relevant install tests
- `node scripts/ci/validate-markdown-links.js`
- `node scripts/ci/validate-markdown-path-refs.js`

Acceptance criteria:

- no tracked tool source remains under repo-root runtime dirs
- installers use only `*-template/` as source
- docs describe templates as source of truth
- repo runtime dirs are ignored
- local verification still passes

## Recommended Next Implementation Slice

The initial Cursor/Codex/OpenCode migration slices are complete, and the top-level adapter layout decision is locked to root-level `*-template/` directories.

Start next with Claude adapter completion and migration closeout:

1. classify remaining Claude-adjacent tracked assets as:
   - `claude-template/` source
   - root-level shared MDT source
   - mirror/rendered output
   - local/runtime-only state
2. document and enforce mirror semantics for Claude hook config (source vs mirror ownership)
3. define and add migration-complete criteria and verification commands in the status docs

Reason:

- this finishes the only partially migrated adapter
- it avoids unnecessary path churn after the layout decision
- it creates a clear end-state gate for future migration work

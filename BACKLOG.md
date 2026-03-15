# Backlog

Use this file for active release blockers, unresolved cross-tool gaps, and deferred post-v1 work.

Current active plan:

- [Reach v1.0.0](docs/plans/details/20260312.20.24.reach-v1-0-0.md)

## Active Release Blockers

- [x] Claude `plugin.json` declared no agents/commands/skills/rules — plugin installs delivered zero functional assets. Fixed: added all component arrays and populated `claude-template/` for manual installs.
- [ ] Keep every current-state verification claim version-stamped and remove any stale value that cannot be re-verified locally.
- [ ] Generalize or retire the remaining Claude-only example/reference surfaces under `examples/*CLAUDE*.md`.
- [ ] Keep root docs thin and prevent drift from `docs/` as the source of truth.
- [ ] Fix installed Codex workflow smoke packaging: `~/.codex/mdt/scripts/mdt.js smoke workflows --tool codex` currently fails because `mdt.js` eagerly requires `smoke-claude-workflows.js` and `smoke-cursor-workflows.js`, but those files are not installed in `~/.codex/mdt/scripts/`.

## Remaining Vendor-Specific Gaps

- [ ] Cursor IDE verification remains manual-only. Keep the manual workflow current and version-stamped.
- [ ] Cursor hook support remains an experimental adapter rather than a documented vendor-native surface.
- [ ] Codex still relies on explicit/manual continuous-learning workflows instead of hook-driven capture.
- [ ] Codex tool-setup smoke can only be `SKIP` in restricted local sessions where CLI probes hit `EPERM`; document the environment limitation and keep smoke output explicit about rerunning in a shell that allows local process spawn.

## Deferred Product Work

### Homunculus .self/ scope for MDT meta-learnings (dev installs only)

**Status:** Open - not yet implemented.

When MDT is installed with `--dev`, create a reserved `~/.{tool}/mdt/homunculus/.self/` scope for instincts and observations that are about MDT itself rather than about the user's projects.

Scope of work:
- Only created or activated when `--dev` was used at install time
- Same internal structure as any project scope (`instincts/`, `evolved/`, `observations.jsonl`, and related files)
- Detection checks for a `--dev` install marker such as a flag in `~/.{tool}/mdt/install.json`
- `detect-project.js` should route to `.self/` when `cwd` is the MDT repo and dev mode is active

### Homunculus project detection: non-git VCS support

**Status:** Open - git only is implemented.

When support for other VCS systems is added, extend `detect-project.js` to emit the appropriate suffix:
- Mercurial -> `-hg`
- SVN -> `-svn`
- Fossil -> `-fossil`
- Jujutsu -> `-jj`

### Harden tool home directories for all supported tools

**Status:** Open.

Replicate the optional Codex home hardening bundle for the other supported tools after their sensitive file paths are locally verified.

### Cursor duplicate command-name precedence between `~/.cursor/` and explicit local bridges

**Status:** Open.

Document or harden the command-scope precedence once Cursor behavior is stable enough to rely on.

### Rename `codex-observer.js` to a tool-agnostic name

**Status:** Open.

`scripts/codex-observer.js` is the observer runtime for any non-hook-enabled LLM-agentic tool, not Codex specifically. Rename it (e.g. `agent-observer.js`) and update all references: `packages/continuous-learning-observer/`, install-mdt.js, the `.deps.json` sidecar, and any docs that cite the filename.

### Migrate Node runtime scripts to `.mjs` after v1.0.0 stabilization

**Status:** Deferred until after the repo reaches a stable v1 baseline.

### Revisit OpenCode after `v1.0.0` plus `.mjs` migration

**Status:** Deferred until after the v1 baseline and runtime-format decision are both complete.

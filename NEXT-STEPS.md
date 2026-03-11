# Next Steps

## Current Direction

- This fork is primarily for personal daily use, with possible reuse by friends and coworkers.
- Upstream ECC is now reference material, not an active sync source.
- v1 is still stabilization work: remove drift, verify real workflows, and avoid guesswork across tools.
- The intended destination is documented in [docs/V1-TARGET-STATE.md](docs/V1-TARGET-STATE.md); this file should stay focused on active steps, not restate the whole end-state vision.
- Cross-tool functional parity analysis and implementation plan: [docs/functional-parity-plan.md](docs/functional-parity-plan.md)
- Until a commit is tagged `v1.0.0`, install layout and package composition are allowed to change.
- Before `v1.0.0`, assume fresh installs rather than in-place migration: re-run `node scripts/install-mdt.js` instead of preserving upgrade workflows between intermediate layouts.
- Recent completed milestone archive:
  - [2026-03-11 global-install stabilization](docs/history/2026-03-11.global-install-stabilization.md)

Installer scope contract:

- normal installs target the tool's user/global config root
- `--global` remains accepted as a compatibility alias/no-op
- `--project-dir` is retired
- any repo-local exception must use an explicit bridge flow and must be documented explicitly

---

## Next Practical Steps

### 1. Tighten package-manifest validation and dependency metadata (P1)

Package manifests are now the install source of truth for Claude, Cursor,
Codex, and Gemini. Cursor no longer over-installs unrelated skills in the
covered package paths, and Codex skill selection is now explicit under
`tools.codex.*` instead of inheriting shared top-level package skills.

The next package-model work should focus on validation and maintainability, not
another install-selection rewrite.

Design references:

- [docs/packages-install-model.md](docs/packages-install-model.md)
- [docs/package-manifest-v1.md](docs/package-manifest-v1.md)

What remains:

- validate every package manifest shape in CI
- add explicit tests for dry-run/install-plan output versus actual installed assets
- keep Codex intent explicit under `tools.codex.rules`, `tools.codex.skills`, and `tools.codex.scripts`
- document any truly shared assets versus tool-specific assets so manifests stay easy to audit

Important pre-v1 constraint:

- do not preserve intermediate migration workflows for package layout changes
- until `v1.0.0`, the expected update path is: start fresh and run `node scripts/install-mdt.js`
- docs should describe reset/reinstall, not compatibility migration, while installer details are still settling

Status:

- language packages are explicit
- capability packages exist for `continuous-learning` and `context-compaction`
- capability metadata such as `requires.hooks`, `requires.runtimeScripts`, and `requires.sessionData` is actionable in the installer and validator
- Codex package installs now come only from explicit `tools.codex.*` manifest entries
- the next package-model follow-up should be validation and drift prevention, not another source-layout transition

### 2. Add dependency declarations to SKILL.md frontmatter (P1)

Currently all inter-component dependencies are implicit. Skills that assume rules
are loaded don't declare it, so the install script cannot warn when installing to
an environment where those dependencies can't be satisfied (for example a tool
surface where rules are absent, disabled, or only available through an explicit
local bridge).

**Proposed addition to SKILL.md frontmatter:**

```yaml
---
name: tdd-workflow
description: ...
requires:
  rules:
    - common/testing
    - common/coding-style
  hooks: true          # needs hook infrastructure active
  skills: []           # inter-skill dependencies
---
```

**What this enables:**
- The install script can check `requires.rules` and warn (or block) when rules
  can't be guaranteed (e.g. Cursor global scope)
- The install script can check `requires.hooks` and skip or warn when installing
  to a tool that doesn't support hooks
- Users see upfront what a skill needs before installing it
- Test suite can validate that declared dependencies are actually present

**Scope of work:**
1. Add `requires:` to the SKILL.md schema (or document it as a convention)
2. Audit each skill and add `requires:` where the dependency is real (not just
   "nice to have") — start with skills that embed explicit rule guidance:
   `tdd-workflow`, `security-review`, `coding-standards`, `verification-loop`
3. Update `scripts/install-mdt.js` to read `requires:` and emit warnings when
   installing to a tool/scope that can't satisfy them
4. Update tests to cover the dependency-check logic

This should align with package-level `requires` metadata so both layers describe
the same runtime truth:

- packages declare install-time capability constraints
- skills declare asset-level expectations for direct/manual installs

### 3. Add deeper Claude workflow smoke (P2)

Codex has workflow-level smoke coverage. Claude should get the same for:

- `plan`
- `tdd`
- `verify`
- `security`

### 4. Codex parity — expand beyond first explicit continuous-learning slice (P2)

Follow-ups for Codex should focus on:

- deciding whether Codex gets real package-selected rule files under `codex-template/rules/`
- reducing remaining source-layout drift between `codex-template/skills/` and the installed `~/.codex/skills/` tree materialized by the installer
- keeping the `continuous-learning` package truthful for Codex so manual learning
  stays the baseline, `continuous-learning-automatic` is not treated as a
  Codex install surface, and the optional observer remains a separate
  `continuous-learning-observer` enhancement
- deciding whether any Codex app automations are worth using after the explicit path has proven itself
- expanding Codex workflow verification beyond smoke into richer manual verification
- keeping project detection repo-scoped even when the active Codex shell blocks
  Node subprocess calls to `git`
- deciding whether Codex background analysis should remain purely explicit or
  gain an optional externally running Node observer that watches `.codex/`
  outside the restricted Codex session

Codex continuous-learning guardrail:

- Codex should be documented and implemented as explicit/manual capture first
- the optional external observer is for background analysis only
- do not describe Codex as having full automatic hook-style observation capture
  unless Codex gains a real native surface for it
### 5. Extend Cursor parity tests (P2)

Add test coverage for:
- continuous-learning wiring in Cursor `afterFileEdit` / `afterShellExecution`
- package-driven skill/command install output
- user-global Cursor `.mdc` rule install behavior under the new default global install model

### 6. Add detached-process lifecycle management for background helpers (P1)

Local debugging found that stale detached `node.exe` processes can keep old
Cursor `.cursor/` state alive even after reinstalling or removing files. This
must become a general MDT rule for any background helper launched separately
from a tool session.

Next implementation slice:

- add a shared detached-process lifecycle contract
- make observers/helpers self-terminate when the owning tool/session is gone
- clean up PID files on exit
- document stale detached-process checks as part of normal troubleshooting for
  Cursor and any future background helper integrations

### 7. Validate weekly continuous-learning retrospectives (P2)

Goal:

- keep the live observer cheap and low-noise
- validate one-calendar-week summaries as useful sources of automation
  candidates
- keep monthly rollups deferred unless weekly summaries prove useful

Current shipped surface:

- Codex weekly retrospectives run through:
  `node ~/.codex/skills/continuous-learning-manual/scripts/codex-learn.js weekly --week YYYY-Www`
- structured output lands under:
  `~/.codex/mdt/homunculus/projects/<id>/retrospectives/weekly/YYYY-Www.json`

Follow-ups:

- manually validate that the weekly summaries produce useful automation
  candidates instead of noise
- decide whether Cursor should get the same explicit weekly command surface
- keep monthly rollups deferred until weekly summaries prove useful

### 8. Cut a stabilization release boundary (P3)

Once Cursor hook parity is working and Claude workflow smoke is added, prepare
release notes covering:

- Cursor lifecycle parity (no Claude Code transcript dependency)
- Claude workflow smoke coverage
- package-driven install selection and Cursor skills/commands composition

### 9. Revisit OpenCode after v1.0.0 + `.mjs` migration

OpenCode is intentionally out of the active support surface for now.

Do not spend stabilization time on OpenCode before:

- `v1.0.0` is cut
- the planned `.mjs` migration is complete

If support is resumed later:

- rebuild the adapter from current vendor reality
- add fresh local smoke coverage
- reintroduce it through packages, workflow contracts, and tool docs together

---

## Design Principle for Homunculus Project Detection

Project storage under `~/.{tool}/mdt/homunculus/projects/` uses the **git repository name** as the project ID, not a branch name or local clone directory name.

Detection order:

1. **Git remote URL available** → extract repo name from the remote URL, strip `.git`
   - `git@github.com:flatrick/mdt.git` → `mdt`
   - `https://github.com/flatrick/mdt.git` → `mdt`
2. **Git repo, no remote** → use the repo root directory basename
   - `/home/user/projects/my-tool` → `my-tool`
3. **No git repo** → use the current working directory basename
   - `/home/user/scripts` → `scripts`

This keeps project IDs stable across re-clones, renames of the local working directory, and branch switches. The ID always reflects what the project *is*, not where it happens to live locally.

---

## Design Principle for Cursor Hooks

> Never fake Claude format in Cursor hooks. `transformToClaude()` works for hooks
> that only use `command` or `file_path`, but breaks for anything reading
> `transcript_path`. Write Cursor hooks that consume Cursor's native JSON directly
> and call the business-logic layer (format checking, secret detection) directly —
> not via the Claude Code hook runner.

Shared scripts that are transcript-independent (format, typecheck, console-warn,
secret detection) are safe to delegate to via adapter. The ones that are
transcript-dependent (session-end, cost-tracker, evaluate-session) need Cursor-native
reimplementations.

---

## Keep Using

For future verification passes, use:

- `node scripts/verify-tool-setups.js`
- `node scripts/smoke-tool-setups.js`
- `node scripts/smoke-codex-workflows.js`
- `node tests/run-all.js --profile neutral`

If a tool is not installed locally, record it as `SKIP` rather than guessing.

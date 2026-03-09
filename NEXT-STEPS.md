# Next Steps

## Current Direction

- This fork is primarily for personal daily use, with possible reuse by friends and coworkers.
- Upstream ECC is now reference material, not an active sync source.
- v1 is still stabilization work: remove drift, verify real workflows, and avoid guesswork across tools.
- Until a commit is tagged `v1.0.0`, install layout and package composition are allowed to change.
- Before `v1.0.0`, assume fresh installs rather than in-place migration: re-run `node scripts/install-mdt.js` instead of preserving upgrade workflows between intermediate layouts.

Recently completed:

- Cursor lifecycle hooks now use native Cursor payloads for session summaries and session evaluation instead of depending on Claude `transcript_path`.
- The Cursor adapter now guarantees `MDT_ROOT` for delegated subprocesses.
- Cursor cost tracking now records usage when payload data is present and logs an explicit fallback when it is not.
- Focused Cursor lifecycle tests now cover the native session-end/stop path.

---

## Next Practical Steps

### 1. Replace rule-driven install selection with package manifests (P1)

The next major restructuring step is to stop using `rules/` as the indirect source
of truth for what gets installed. That model is already leaking in Cursor, where:

```text
node scripts/install-mdt.js --target cursor typescript
```

can install unrelated skills because the installer copies content based on
hardcoded directories rather than an explicit install package definition.

Introduce a `packages/` model that declares install bundles directly. Each
package should describe which rules, skills, commands, hooks, and tool-specific
assets belong together.

Design note:

- [docs/packages-install-model.md](docs/packages-install-model.md)
- [docs/package-manifest-v1.md](docs/package-manifest-v1.md)

Proposed direction:

- keep source assets in `rules/`, `skills/`, `commands/`, `hooks/`, and per-tool template dirs
- add package manifests under `packages/`
- make `scripts/install-mdt.js` resolve requested install scopes from package manifests instead of inferring behavior from `rules/`
- allow tool-specific package overrides where Cursor/Claude/Codex/OpenCode need different assets

What this should solve:

- language-scoped installs stop pulling unrelated skills implicitly
- install behavior becomes explicit and testable
- tool-specific differences stop living as scattered installer conditionals
- future dependency handling can attach to packages instead of ad hoc path rules

Important pre-v1 constraint:

- do not preserve intermediate migration workflows for package layout changes
- until `v1.0.0`, the expected update path is: start fresh and run `node scripts/install-mdt.js`
- docs should describe reset/reinstall, not compatibility migration, while this restructuring is in progress

Suggested first slice:

1. define the package manifest shape
2. model the current `typescript` install as a package
3. switch Cursor skill install logic to use package selection instead of copying the shared `skills/` tree
4. add tests proving `--target cursor typescript` does not install unrelated skills

Status:

- language packages are now explicit
- the first real capability package drafts should be `continuous-learning` and `context-compaction`
- capability metadata such as `requires.hooks`, `requires.runtimeScripts`, and `requires.sessionData` is now actionable in the installer/validator
- `requires.tools` currently means "implemented installer support in this repo today", not a permanent product limit
- the next package-model follow-up should add real Codex/Cursor-native implementations for MDT capability packages and widen `requires.tools` only when those installs actually exist

### 2. Cursor parity — wire continuous learning (P1)

`skills/continuous-learning-v2/hooks/observe.js` is called at Pre/PostToolUse in
Claude hooks but is not wired in Cursor hooks at all. `observe.js` already supports
Cursor via `detect-env.js`. Add calls to `afterFileEdit` and `afterShellExecution`
Cursor hooks.

### 3. Cursor parity — populate `.cursor/skills/` (P2)

Cursor has a native skills system using the same `SKILL.md` format and
auto-discovery as Claude Code. Skills live in `.cursor/skills/` (project) or
`~/.cursor/skills/` (user) and are invocable via `/` in Agent chat.

This should happen through the package-manifest model above, not by blindly
copying the shared repo `skills/` tree.

Currently only `frontend-slides` is in `.cursor/skills/`. Additional skills
should be added intentionally through Cursor-facing package definitions, not
converted to rules and not copied implicitly.

Priority skills to add first:
- `tdd-workflow`
- `verification-loop`
- `coding-standards`
- `security-review`
- `backend-patterns`
- `frontend-patterns`

Update `scripts/install-mdt.js` so Cursor installs resolve skills from package
definitions and Cursor-facing sources, not from the entire shared `skills/`
directory.

Note: Cursor user-level rules (`~/.cursor/rules/`) are stored in a database and
cannot be file-installed. The install script must only target project-level paths
(`.cursor/rules/`, `.cursor/skills/`). This is unlike Claude Code where
`~/.claude/rules/` is file-based.

### 4. Add dependency declarations to SKILL.md frontmatter (P1)

Currently all inter-component dependencies are implicit. Skills that assume rules
are loaded don't declare it, so the install script cannot warn when installing to
an environment where those dependencies can't be satisfied (e.g. Cursor global
install, where user-level rules are database-backed and unavailable).

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

### 5. Cursor parity — convert commands to Cursor custom commands (P2)

All commands in `commands/*.md` use Claude Code slash command format. Cursor has
its own custom command system. Create `.cursor/commands/` and convert the core
workflows, stripping Claude-specific subagent syntax:

- `/tdd`, `/plan`, `/verify`, `/code-review`, `/learn`, `/skill-create`

Update `scripts/install-mdt.js` to install these via package selection rather
than path-by-path hardcoding.

### 6. Add deeper Claude workflow smoke (P2)

Codex has workflow-level smoke coverage. Claude should get the same for:

- `plan`
- `tdd`
- `verify`
- `security`

### 7. Extend Cursor parity tests (P2)

Add test coverage for:
- continuous-learning wiring in Cursor `afterFileEdit` / `afterShellExecution`
- package-driven skill/command install output

### 8. Cut a stabilization release boundary (P3)

Once Cursor hook parity is working and Claude workflow smoke is added, prepare
release notes covering:

- Cursor lifecycle parity (no Claude Code transcript dependency)
- Claude workflow smoke coverage
- package-driven install selection and Cursor skills/commands composition

### 9. Add OpenCode local smoke once installed

OpenCode is structurally documented but not locally verified. Once installed:

- run `node scripts/smoke-tool-setups.js`
- add an OpenCode-specific workflow smoke if the adapter is going to stay first-class

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

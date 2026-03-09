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

Status: **done** — Cursor continuous-learning wiring now uses native Cursor
payloads and storage.

`skills/continuous-learning-v2/hooks/observe.js` is now called from
`hooks/cursor/scripts/after-file-edit.js` and
`hooks/cursor/scripts/after-shell-execution.js` via the Cursor hook adapter.
The adapter:

- anchors `CONFIG_DIR` and `MDT_ROOT` to the project `.cursor/` install
- sends Cursor-native payloads into `observe.js` (no dependency on Claude
  `transcript_path`)
- writes observations under `.cursor/homunculus/...`

Manual verification lives in
`docs/testing/manual-verification/cursor.md` (Continuous Learning +
Session Lifecycle sections).

Continuous-learning planning constraint:

- keep observation capture sparse and event-driven rather than logging every
  conversational turn
- optimize for detecting repeated or costly workflows that should become
  dedicated scripts, custom commands, or MCP-backed integrations
- treat raw observation volume as a cost unless it produces better automation
  candidates

### 3. Cursor parity — populate `.cursor/skills/` (P2)

Status: **first slice complete** — Cursor skills are now package-driven.

Cursor has a native skills system using the same `SKILL.md` format and
auto-discovery as Claude Code. Skills live in `.cursor/skills/` (project) or
`~/.cursor/skills/` (user) and are invocable via `/` in Agent chat.

MDT now installs Cursor skills via the package-manifest model:

- language packages (for example `typescript`) list shared skills explicitly
  under `"skills"` (`tdd-workflow`, `verification-loop`, `coding-standards`,
  `security-review`, `backend-patterns`, `frontend-patterns`, `e2e-testing`)
- capability packages such as `continuous-learning` and `context-compaction`
  list their own skills
- `installCursorSkills()` copies only package-selected skills from `skills/*/`
  plus any Cursor-specific skills from `cursor-template/skills/`

Follow-ups for this P2 item:

- keep the priority skills list in sync with `packages/*/package.json`
- add more Cursor-facing skills intentionally (via packages) rather than by
  copying the entire shared `skills/` tree

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

### 5. Cursor parity — expand custom command coverage (P2)

Status: **first slice done** — package-selected Cursor custom command prompts
now ship from `cursor-template/commands/`.

Current state:

- `scripts/install-mdt.js` installs package-selected Cursor commands into
  `.cursor/commands/`
- shipped prompts now exist for `plan`, `tdd`, `verify`, `code-review`,
  `learn`, and `skill-create`
- package validation now checks `tools.cursor.commands`
- Cursor command coverage is still intentionally narrower than the shared Claude
  slash-command catalog

Future work for this item should focus on:

- deciding which additional shared MDT workflows deserve first-class Cursor
  command prompts
- keeping Cursor command prompts aligned with the corresponding shared workflow
  contracts
- adding manual verification coverage for the shipped Cursor command set

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

### 8. Add weekly continuous-learning retrospectives focused on automation candidates (P2)

Status: **not started**

Goal:

- keep the live observer cheap and low-noise
- analyze one calendar week of observations and archived batches
- identify repeated, costly, or failure-prone workflows that should become:
  - dedicated scripts
  - custom commands
  - MCP-backed integrations

Important constraints:

- do not increase observation frequency just to collect more data
- do not treat raw log volume as a success metric
- prefer sparse event capture plus higher-value summaries
- do not add monthly rollups until weekly reports prove useful

Suggested first slice:

1. add an explicit weekly retrospective command for one project and one week
2. read current `observations.jsonl` plus matching `observations.archive/*.jsonl`
3. write one structured weekly summary under project storage
4. include a section for automation candidates and likely script/MCP targets
5. keep this manual first; do not auto-run it yet

### 9. Cut a stabilization release boundary (P3)

Once Cursor hook parity is working and Claude workflow smoke is added, prepare
release notes covering:

- Cursor lifecycle parity (no Claude Code transcript dependency)
- Claude workflow smoke coverage
- package-driven install selection and Cursor skills/commands composition

### 10. Add OpenCode local smoke once installed

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

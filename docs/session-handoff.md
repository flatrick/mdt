# Session Handoff

This file summarizes the current state of the branch and what to do next.
It is safe to delete once the work is complete.

**Branch:** `template-source-migration`
**Last commit:** `refactor: split continuous-learning-v2 into manual and automatic skills`

---

## What Was Completed This Session

### Phase 1 work (fully done and committed)

1. **install-mdt.js scope requirement** — Running the installer without `--global`
   or `--project-dir` now exits with a helpful message explaining both flags.
   `--dry-run` and `--list` bypass this check (they don't need a scope).

2. **Codex rule files (Phase 1b)** — Four files added to `codex-template/rules/`:
   - `common-coding-style.md`, `common-testing.md`, `common-security.md`, `common-git-workflow.md`
   - Wired into `packages/typescript/package.json` under `tools.codex.rules`

3. **Cursor commands (Phase 1c)** — Four files added to `cursor-template/commands/`:
   - `e2e.md`, `security.md`, `build-fix.md`, `refactor-clean.md`
   - Wired into `packages/typescript/package.json` under `tools.cursor.commands`

4. **Codex hardening bundle** — `codex-template/hardening/` (committed, opt-in).

5. **continuous-learning split** — `continuous-learning-v2` split into two skills:
   - `skills/continuous-learning-manual/` — operator-triggered: instinct management,
     codex-learn.js, weekly retrospectives, evolve/promote/export/import
   - `skills/continuous-learning-automatic/` — hook-driven observation capture only:
     `hooks/observe.js` + `scripts/detect-project.js`
   - `codex-template/skills/continuous-learning-manual/` — Codex copy (no hooks/, uses openai.yaml)
   - `packages/continuous-learning/package.json` now treats `continuous-learning-manual` as the shared baseline and maps `continuous-learning-automatic` through tool-specific Claude/Cursor package metadata
   - Codex does not install `continuous-learning-automatic`; the manual skill plus optional external observer is the Codex-facing contract
   - ~50 references updated across commands, hooks configs, docs, tests, installed copies

### Phase 2 work (completed this session)

1. **Phase 2a: Codex external observer** — Added `scripts/codex-observer.js`
   with:
   - `status` — inspect project-local Codex observation state
   - `once` — run one analysis pass outside the active Codex shell
   - `watch` / `--watch` — poll `.codex/homunculus/projects/<id>/observations.jsonl`
     and trigger analysis when the configured threshold is met
   - Reuses the existing `continuous-learning-manual` analyzer path with
     `MDT_OBSERVER_TOOL=codex`
   - Installed into `<project>/.agents/scripts/codex-observer.js`
   - Covered by `tests/scripts/codex-observer.test.js`

### How the skill install layers work (important context)

The installer supports three skill source layers:
- **Shared `skills/`** — default, used for Claude, Cursor, Gemini
- **`codex-template/skills/`** — Codex-specific copies (listed in `skills[]` of manifest;
  Codex installer only reads from here)
- **`cursor-template/skills/`** — Cursor-specific overrides (listed in `tools.cursor.skills`;
  used when Cursor needs a different version)

Codex only installs skills that are explicitly declared for Codex-facing use.
Hook-only skills should stay out of the shared Codex package surface.

---

## What Remains (from the functional parity plan)

See `docs/functional-parity-plan.md` for the full plan. Outstanding items:

### Phase 2 (remaining)

- **Phase 2b: Cursor continuous-learning CLI fallback** — `scripts/cursor-learn.js` for
  triggering learning from a terminal since Cursor can't invoke Node scripts directly.

- **Phase 2c: Skill dependency declarations** — Add `requires:` frontmatter to SKILL.md
  files so skills can declare what they depend on (e.g., runtime scripts, session data).

- **Phase 2d: Unified smoke surface** — Deeper Claude workflow smoke tests (currently
  only Codex has deep smoke via `smoke-codex-workflows.js`).

- **Phase 2e: Document Cursor hooks status** — Add a prominent experimental warning
  to Cursor hook-related docs. The hooks are wired but untested in production Cursor.

### BACKLOG items (deferred, not part of Phase 2)

- **SKILL.md descriptions** — Both new skills still carry the full v2 description.
  Should be trimmed to reflect their narrowed focus.
- **Cursor install scope leak** — `node scripts/install-mdt.js --target cursor typescript`
  installs skills for unrelated languages (tracked in BACKLOG.md as "Cursor install copies
  non-requested skills").
- **Claude home hardening** — Replicate `codex-template/hardening/` for Claude Code.
  Constraint: do not implement until Claude's sensitive file paths are confirmed.

### Codex project install (user wanted to do this)

The user wants to run a Codex global install. The install command would be:
```
node scripts/install-mdt.js --target codex --project-dir <path-to-a-project> typescript continuous-learning
```

This will:
- Install skills into `<project>/.agents/skills/`: coding-standards, documentation-steward,
  tool-setup-verifier, continuous-learning-manual
- Install runtime scripts into `<project>/.agents/scripts/`
- Install `codex-observer.js`, `smoke-tool-setups.js`, and `smoke-codex-workflows.js`
  into `<project>/.agents/scripts/`

For a global Codex install, use:
```
node scripts/install-mdt.js --target codex --global typescript continuous-learning
```

---

## Test Status

All tests pass as of last commit:
- **27 unit tests** (`node tests/scripts/install-mdt-unit.test.js`)
- **14 integration tests** (`node tests/scripts/install-mdt.test.js`)
- All other test suites (`node tests/run-all.js`)

---

## Key Files

| File | Purpose |
|------|---------|
| `scripts/install-mdt.js` | Main installer |
| `packages/*/package.json` | Package manifests (rules, skills, commands per tool) |
| `codex-template/` | Codex-specific templates and rules |
| `cursor-template/` | Cursor-specific commands and skills |
| `skills/continuous-learning-manual/` | Operator-triggered learning |
| `skills/continuous-learning-automatic/` | Hook-driven observation |
| `docs/functional-parity-plan.md` | Full plan for Phase 1–3 |
| `BACKLOG.md` | Deferred items with context |

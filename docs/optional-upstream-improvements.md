# Optional Improvements from affaan-m to Consider

Plan for the **ModelDev Toolkit (MDT)** fork. Upstream is affaan-m/everything-claude-code (ECC); this doc uses MDT naming where the repo has been renamed.

You already ported the three high-value items: **runtime hook controls** (MDT_HOOK_PROFILE / MDT_DISABLED_HOOKS), **session persistence on Stop**, and the **doc-file-warning allowlist**. Below are remaining upstream additions.

---

## Work environment

**Always do work in a git worktree** so you don't clash with other tools (IDE, other sessions, etc.).

- Create the worktree **outside** the repository: use a path like `../{worktree-name}/` (sibling to the repo root), not a subfolder inside the repo.
- Example, from repo root: `git worktree add ../optional-upstream-work` then `cd ../optional-upstream-work` to work there.
- When done, merge or cherry-pick into main and remove the worktree if desired: `git worktree remove ../optional-upstream-work`.

---

## Current state (re-scan)

Use this section to avoid mistakes; update it after changes.

| Item | Status | Notes |
|------|--------|--------|
| **check-hook-enabled.js** | Not present | Add to `scripts/hooks/`. Depends on `scripts/lib/hook-flags.js` (present). |
| **cost-tracker.js** | Not present | Add to `scripts/hooks/`. No `stop:cost-tracker` in `hooks/hooks.json` or `~/.cursor/mdt/hooks/stop.js`. Use `getConfigDir()` from `scripts/lib/utils.js` (or `getClaudeDir()` which delegates to it) for metrics path. |
| **Harness/loop commands** | Not present | `commands/` has no harness-audit, loop-start, loop-status, quality-gate, model-route. |
| **Harness/loop agents** | Not present | `agents/` has no harness-optimizer, loop-operator. |
| **hook-flags.js** | Present | `scripts/lib/hook-flags.js` exists. |
| **run-with-flags.js** | Present | `scripts/hooks/run-with-flags.js` exists; Stop already has session-end, evaluate-session, session-end-marker. |

---

## Implementation scope (confirmed)

**In scope now:**

2. **check-hook-enabled.js** — Add the small CLI script that prints yes/no for a hook ID and profiles.
3. **Cost-tracker hook** — Port cost-tracker.js, wire on Stop in hooks.json and Cursor stop.js; use your repo's config dir for metrics path.
4. **Harness/loop commands and agents** — Port from affaan-m: commands `/harness-audit`, `/loop-start`, `/loop-status`, `/quality-gate`, `/model-route` and agents `harness-optimizer`, `loop-operator`. Markdown only; no new scripts unless a command explicitly requires one.

**Deferred (until the above are in place):**

- **Quality-gate hook** — PostToolUse script that runs Biome/Prettier/ruff/gofmt per file. Revisit after check-hook-enabled, cost-tracker, and harness/loop are done.

**Deferred (later stage):**

- **Community and docs** — CHANGELOG, CODE_OF_CONDUCT, SPONSORING, etc.

---

## 2. Cost-tracker hook (Stop phase)

**What:** affaan-m's `scripts/hooks/cost-tracker.js` runs on Stop, parses stdin for `usage` / `token_usage`, estimates cost from model + tokens, and appends a JSONL row to `~/.claude/metrics/costs.jsonl`.

**This repo:** No cost-tracker; no metrics hook.

**Why adopt:** Lightweight per-session cost tracking without external tooling. Only useful if the harness sends token usage on Stop (Claude Code may; Cursor may not).

**Effort:** Low–medium. Port the script and wire it in `hooks/hooks.json` (Stop) and `~/.cursor/mdt/hooks/stop.js`. This repo's utils use different names (e.g. no `getClaudeDir()`); use existing config/sessions dir or a dedicated `metrics` path under config dir.

---

## 3. Quality-gate hook (PostToolUse, Edit) — DEFERRED

Revisit after check-hook-enabled, cost-tracker, and harness/loop are in place.

**What (for reference):** affaan-m's `scripts/hooks/quality-gate.js` runs after file edits: for the edited `file_path` it runs Biome (or Prettier), and for Go/Python runs gofmt/ruff. Optional env: `MDT_QUALITY_GATE_FIX`, `MDT_QUALITY_GATE_STRICT`.

**Effort:** Low. Port the script and add a PostToolUse entry via run-with-flags (e.g. `post:quality-gate`).

---

## 4. check-hook-enabled.js

**What:** affaan-m's `scripts/hooks/check-hook-enabled.js` is a tiny CLI: `node check-hook-enabled.js <hookId> [profilesCsv]`; it prints `yes` or `no` according to `isHookEnabled(hookId, { profiles })`.

**This repo:** No such script.

**Why adopt:** Useful for shell scripts or other tooling that need to branch on "is this hook enabled?" without reimplementing hook-flags.

**Effort:** Trivial. Copy the script; it only depends on `../lib/hook-flags.js`, which you already have.

---

## 5. Harness/loop commands and agents — IN SCOPE

**What:** Commands `/harness-audit`, `/loop-start`, `/loop-status`, `/quality-gate`, `/model-route` and agents `harness-optimizer`, `loop-operator`. Prompt/contract only; no new runtime. Benefits: audit scorecard and next steps, loop runbooks/status, model routing, delegation via harness-optimizer and loop-operator.

**Effort:** Medium. Port the markdown command and agent files from affaan-m. No new scripts unless a command explicitly references one.

---

## Deferred: Community and docs

CHANGELOG.md, CODE_OF_CONDUCT.md, SPONSORING.md, SPONSORS.md, and release/attribution docs are **skipped for now**. Revisit once the product behavior is where you want it; they have no impact on how the fork works.

---

## Summary

| Item                             | Status                     |
| -------------------------------- | -------------------------- |
| check-hook-enabled.js            | **In scope**               |
| Cost-tracker hook                | **In scope**               |
| Harness/loop commands and agents | **In scope**               |
| Quality-gate hook                | Deferred (after the above) |
| Community and docs               | Deferred (later stage)     |

Implementation order: (1) check-hook-enabled.js, (2) cost-tracker hook, (3) harness/loop commands and agents. Quality-gate hook can be added once these are in place.

---

## Check-list

Use the indented rows under each task for status updates, gotchas found during work, or notes to use when working on that task later.

- [ ] **check-hook-enabled.js**
  - *(Add status or important notes here when working on this task.)*
  - Script depends only on `scripts/lib/hook-flags.js`. CLI: `node scripts/hooks/check-hook-enabled.js <hookId> [profilesCsv]` → prints `yes` or `no`.

- [ ] **Cost-tracker hook**
  - *(Add status or important notes here when working on this task.)*
  - Use this repo's config dir (or derived path) for metrics; no `getClaudeDir()`. Wire in `hooks/hooks.json` (Stop) and `~/.cursor/mdt/hooks/stop.js` with run-with-flags and hook ID e.g. `stop:cost-tracker`.
  - Only useful if the harness sends token usage on Stop.

- [ ] **Harness/loop commands and agents**
  - *(Add status or important notes here when working on this task.)*
  - Port from affaan-m: `commands/harness-audit.md`, `loop-start.md`, `loop-status.md`, `quality-gate.md`, `model-route.md` and `agents/harness-optimizer.md`, `loop-operator.md`.
  - Markdown only; no new scripts unless a command explicitly requires one.

- [ ] **Quality-gate hook** (deferred)
  - Revisit after the four items above are done.
  - *(Add status or important notes here when you start this task.)*

- [ ] **Community and docs** (deferred)
  - Revisit in a later stage.
  - *(Add status or important notes here when you start this task.)*

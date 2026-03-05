# Improvement Plan

This is a personal fork of [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) with a Node-only runtime. The items below are specific to this fork and its goals.

---

## Priority 1 — Correctness / Broken Behavior

### 1.1 `configure-ecc` clones from upstream, not this fork

**File:** `skills/configure-ecc/SKILL.md:32`

```bash
# Currently clones the wrong repo:
git clone https://github.com/affaan-m/everything-claude-code.git /tmp/everything-claude-code
```

If a user invokes `/configure-ecc` it will install from the upstream repo, discarding all changes in this fork (Node-only scripts, fork-specific fixes). Change the clone URL to `https://github.com/flatrick/everything-claude-code.git`.

**Fix:** Update the clone URL in `SKILL.md` to point to this fork.

---

### 1.2 Inline hook commands in `hooks.json` are unmaintainable

**File:** `hooks/hooks.json`

Several hooks (tmux-block, git-push reminder, PR-log) embed multi-line JavaScript as minified one-liners inside JSON strings. This makes them impossible to read, test, or modify without errors. The repo already has a pattern for external hook scripts (`scripts/hooks/`). These inline hooks should be extracted.

Affected hooks:
- `"Block dev servers outside tmux"` — large inline `node -e`
- `"Reminder to use tmux for long-running commands"` — large inline `node -e`
- `"Reminder before git push"` — inline `node -e`
- `"Log PR URL after gh pr create"` — inline `node -e`
- `"Example: async hook for build analysis"` — inline `node -e`

**Fix:** Extract each to a dedicated file in `scripts/hooks/`, following the same pattern as `session-start.js`, `pre-compact.js`, etc. Update `hooks.json` references accordingly.

---

## Priority 2 — Quality / Developer Experience

### 2.1 Installer copies non-runtime files to target

**File:** `scripts/install-ecc.js:186-194`

The `installClaude()` function copies the entire `scripts/` tree to `~/.claude/scripts/`. This includes files only needed in this repo's dev workflow (`scripts/release.js`, `scripts/setup-package-manager.js`, `scripts/skill-create-output.js`, `scripts/claw.js`) and the CI validators (`scripts/ci/`). Only the hooks-runtime files (`scripts/hooks/`, `scripts/lib/`) are needed by the installed configuration.

**Fix:** Change the install step to copy only `scripts/hooks/` and `scripts/lib/` to `${claudeBase}/scripts/`.

---

### 2.2 Installer has no `--list` or `--dry-run` mode

**File:** `scripts/install-ecc.js`

Users have no way to preview what will be installed or discover available languages without reading the source or triggering an error. Two small flags would help:

- `--list` — print available language rule sets and exit
- `--dry-run` — print what would be copied without actually writing anything

**Fix:** Add these flags to `parseArgs()` and handle them before the install steps.

---

### 2.3 Test runner output parsing is fragile

**File:** `tests/run-all.js:67-71`

The aggregated pass/fail counts are parsed from stdout via regex (`/Passed:\s*(\d+)/`). If any test file changes its output format, totals silently break. A structured result object passed back from each test file would be more robust.

**Fix:** Consider having each test file export a result, or use a lightweight test framework (Node's built-in `node:test`) that outputs TAP or structured JSON.

---

### 2.4 Upstream sync strategy is undocumented

This fork diverges from upstream in ways that will cause merge conflicts (installer rewrite, hook extractions, etc.). There is no documented process for pulling upstream changes.

**Fix:** Add a `docs/UPSTREAM-SYNC.md` explaining:
- Which directories/files to watch for upstream changes
- Which files are fork-specific overrides (do not overwrite)
- Steps to merge upstream (e.g., `git fetch upstream && git merge upstream/main --no-ff`)

---

## Priority 3 — Housekeeping

### 3.1 Stale references to upstream in non-doc files

The README and CONTRIBUTING.md correctly attribute the upstream project. However, a few non-documentation files still reference the upstream URL where the fork's URL would be more appropriate:

| File | Line | Issue |
|------|------|-------|
| `skills/configure-ecc/SKILL.md` | 32 | Clone URL points to upstream |
| `.claude-plugin/plugin.json` | 9-10 | `homepage` and `repository` point to upstream |
| `.claude-plugin/marketplace.json` | 22-23 | Same |

The `.claude-plugin/` references are lower priority since this fork doesn't publish to the Claude marketplace, but they are misleading.

**Fix:** Update `configure-ecc` clone URL (see 1.1). Decide whether `.claude-plugin/` files need updating or can be left as upstream attribution.

---

### 3.2 `CONTRIBUTING.md` describes upstream contribution workflow

**File:** `CONTRIBUTING.md`

The file describes forking `affaan-m/everything-claude-code` and submitting PRs there. Since this is a personal fork that does not accept community PRs in the same way, the contributing guide is misleading. It should describe the actual contribution path (e.g., "contribute to upstream, then sync here" or "this fork does not accept external PRs").

**Fix:** Update `CONTRIBUTING.md` to clarify this is a personal fork, direct contributors to the upstream repo, and remove the fork-specific PR workflow.

---

### 3.3 Windows tmux hooks still run on Windows

**File:** `hooks/hooks.json` (tmux-related hooks)

The inline tmux hooks include `process.platform !== 'win32'` guards so warnings are suppressed on Windows. However, the hooks still execute JavaScript on every Bash command on Windows just to check the platform and do nothing. This is unnecessary overhead.

After extracting the hooks to external scripts (see 1.2), the scripts can be structured to early-exit on Windows without the overhead of parsing and evaluating inline code for every Bash invocation.

This is a minor concern — the overhead per call is small — but it becomes more noticeable if the hook count grows.

---

## Recommended Tools per Issue

Each issue maps to specific agents, skills, and commands already in this repo. Use these rather than working from scratch.

---

### 1.1 — Fix `configure-ecc` clone URL

This is a one-line text change. No special tooling needed, but run a review after:

| Step | Tool | Why |
|------|------|-----|
| 1. Edit `SKILL.md` | (direct edit) | Single-line URL change |
| 2. Review | `/code-review` → `code-reviewer` agent | Catch any other upstream URLs in the same file |

---

### 1.2 — Extract inline hooks to script files

This is a refactoring task with significant risk surface (hooks run on every tool use).

| Step | Tool | Why |
|------|------|-----|
| 1. Plan | `/plan` → `planner` agent | Break extraction into safe, ordered steps; identify which hooks share logic |
| 2. Write tests first | `/tdd` → `tdd-guide` agent | Each extracted script needs a unit test before the code moves |
| 3. Implement | (direct edit) | Move JS from JSON strings to `.js` files; update `hooks.json` references |
| 4. Review JS quality | `/code-review` → `code-reviewer` agent | Check for regressions, error handling, exit-code correctness |
| 5. Verify hooks | `bash-reviewer` agent | Hook scripts run in shell context; verify they handle stdin/stdout correctly |
| 6. Security check | `security-reviewer` agent | Hooks receive arbitrary tool input — confirm no injection surface |

The existing hook scripts in `scripts/hooks/` are the reference pattern. The `tests/hooks/hooks.test.js` file is where new tests belong.

---

### 2.1 — Installer copies non-runtime files

Surgical change to `install-ecc.js` with test coverage.

| Step | Tool | Why |
|------|------|-----|
| 1. Write/update tests first | `/tdd` → `tdd-guide` agent | Add test asserting that `release.js` and `scripts/ci/` are NOT present after install |
| 2. Implement | (direct edit to `install-ecc.js`) | Replace `copyRecursiveSync(scriptsSrc, scriptsDest)` with selective copies |
| 3. Review | `/code-review` → `code-reviewer` agent | Confirm no hook runtime dependency on the excluded files |

---

### 2.2 — Add `--list` and `--dry-run` flags

New feature on the installer CLI.

| Step | Tool | Why |
|------|------|-----|
| 1. Plan | `/plan` → `planner` agent | Scope: which functions need a `dryRun` parameter threaded through |
| 2. Tests first | `/tdd` → `tdd-guide` agent | Add test cases in `tests/scripts/` for both flags |
| 3. Implement | (direct edit) | Extend `parseArgs()`, gate all `fs.copyFileSync`/`fs.mkdirSync` calls behind dryRun flag |
| 4. Review | `/code-review` → `code-reviewer` agent | Check edge cases (--dry-run + --target codex, --list with no rules dir, etc.) |

---

### 2.3 — Test runner fragility

Migration of test infrastructure — touches all test files.

| Step | Tool | Why |
|------|------|-----|
| 1. Plan | `/plan` → `planner` agent | Decide between structured exports vs `node:test` TAP; assess migration effort across 15 test files |
| 2. Migrate | `/tdd` → `tdd-guide` agent | Enforce that migrated tests still cover same cases |
| 3. Update runner | (direct edit to `run-all.js`) | Replace regex parsing with structured result aggregation |
| 4. Verify | `/verify` skill / `/test-coverage` command | Confirm all 15 test files pass and totals are correct |

---

### 2.4 — Document upstream sync strategy

Pure documentation task.

| Step | Tool | Why |
|------|------|-----|
| 1. Draft | `/update-docs` → `doc-updater` agent | Agent can scan which files diverge from upstream naming patterns and draft the sync guide |
| 2. Review | `/code-review` → `code-reviewer` agent | Verify the listed fork-specific files are accurate |

---

### 3.1 — Stale upstream references

Search-and-update across multiple files.

| Step | Tool | Why |
|------|------|-----|
| 1. Audit | `refactor-cleaner` agent | Grep all non-`node_modules` files for `affaan-m` and categorise: intentional attribution vs stale reference |
| 2. Update | (direct edits) | Change clone URL, decide on `.claude-plugin/` files |
| 3. Review | `/code-review` → `code-reviewer` agent | Confirm no broken links introduced |

---

### 3.2 — Rewrite `CONTRIBUTING.md`

Documentation rewrite.

| Step | Tool | Why |
|------|------|-----|
| 1. Rewrite | `/update-docs` → `doc-updater` agent | Redirect contributors to upstream; describe the actual fork workflow |
| 2. Review | `/code-review` → `code-reviewer` agent | Sanity-check links and accuracy |

---

### 3.3 — Windows tmux hook overhead

Resolved as a side effect of 1.2. The extracted `.js` files can `if (process.platform === 'win32') process.exit(0)` at the top, which is cleaner and measurably faster than parsing JSON and running the full check inline.

No additional tooling beyond the 1.2 plan.

---

## Suggested Execution Order

Work in this sequence to avoid rework:

1. **1.1** (5 min, zero risk) — fix the clone URL so `configure-ecc` works correctly
2. **3.1** (15 min) — audit all stale references before extracting hooks (avoids double-touching files)
3. **1.2 + 3.3** (together) — hook extraction also resolves the Windows overhead issue
4. **2.1** (30 min) — tighten the installer after hook scripts are in their final locations
5. **2.2** (1–2 h) — `--list`/`--dry-run` builds on a clean installer
6. **2.3** (2–3 h) — test infrastructure; do last so all prior changes are already tested
7. **2.4 + 3.2** (1 h) — documentation; do last so it reflects the finished state

---

## Non-Goals

The following are intentionally out of scope for this fork:

- Publishing to npm or the Claude marketplace
- Maintaining parity with upstream's Bash/PowerShell scripts (this fork is Node-only by design)
- Adding new skills or agents not already present in upstream

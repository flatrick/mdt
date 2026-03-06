# Verified Improvement Plan

Date: 2026-03-06
Repo: `flatrick/everything-claude-code` (Node-only fork)

This document consolidates findings from three independent audits (Codex, Cursor, Claude), with every item verified against the actual codebase. Items that could not be confirmed were dropped. Items appearing in multiple audits are merged.

---

## V1 Direction (Intentional Contract)

- Backward compatibility with legacy passthrough behavior is not a goal for this fork's v1.
- Security-first API contract: `resolveSessionAlias(...)` must return a resolved path or `null`, never raw input passthrough.
- Any caller that wants alias-or-path behavior must implement explicit fallback at the call site.
- In general, helpers that process user-provided identifiers should prefer explicit `null`/error over implicit trust.

---

## Priority 1 — Security & Input Validation

### 1.1 `SAFE_NAME_REGEX` allows path traversal

**File:** `scripts/lib/package-manager.js:285`

The regex `/^[@a-zA-Z0-9_./-]+$/` permits `../../../etc/passwd` because `.`, `/`, and `-` are individually allowed. The test suite documents this as a known issue.

**Fix:** Add a post-regex guard rejecting `..` sequences and absolute paths:

```javascript
if (/\.\./.test(name) || name.startsWith('/')) return false;
```

### 1.2 `SAFE_ARGS_REGEX` permits newline injection

**File:** `scripts/lib/package-manager.js:319`

`\s` in the character class matches `\n` and `\r`, allowing multi-line argument injection. Tests document this.

**Fix:** Replace `\s` with `[ \t]` (space and tab only).

### 1.3 `getExecCommand` bypasses validation for non-string args

**File:** `scripts/lib/package-manager.js:334`

When `args` is a truthy non-string (e.g., `{}` or `42`), the `typeof args === 'string'` guard is skipped but the value is still string-concatenated into the command.

**Fix:** Reject non-string truthy args explicitly, or coerce to string before validation.

### 1.4 `resolveSessionAlias` returns unsafe input unchanged

**File:** `scripts/lib/session-aliases.js:365-374`

If input isn't a recognized alias, it's returned as-is. Callers using this to build file paths could be vulnerable to path traversal.

**Fix:** Return `null` for unresolved aliases, or validate the returned value is a safe filename. Update all callers to handle `null`.

### 1.5 `readStdinJson` removes ALL stdin listeners on timeout

**File:** `scripts/lib/utils.js:248-254`

On timeout, `process.stdin.removeAllListeners('data')` nukes all listeners, not just the ones this function registered. Any other code with stdin listeners would be silently broken.

**Fix:** Use named handler functions and remove only those specific listeners.

### 1.6 Tests modify real user config files

- `tests/lib/package-manager.test.js` writes to `~/.claude/package-manager.json`
- `tests/hooks/evaluate-session.test.js` writes corrupt JSON to the repo's `skills/continuous-learning/config.json`

A crash during these tests corrupts real configuration.

**Fix:** Use isolated temp directories for all config-writing tests. Never touch real user or repo files.

---

## Priority 2 — Broken Behavior & Correctness

### 2.1 `configure-ecc` clones from upstream, not this fork

**File:** `skills/configure-ecc/SKILL.md:32`

The clone URL hardcodes `https://github.com/affaan-m/everything-claude-code.git`. Running `/configure-ecc` installs from upstream, discarding all fork-specific changes (Node-only scripts, fixes).

**Fix:** Update the clone URL to `https://github.com/flatrick/everything-claude-code.git`.

### 2.2 CI references a missing validator script

**File:** `.github/workflows/ci.yml:168`

The CI workflow runs `node scripts/ci/validate-windows-parity.js`, but this file does not exist anywhere in the repository.

**Fix:** Either create `scripts/ci/validate-windows-parity.js` with appropriate tests, or remove the step from the CI workflow.

### 2.3 `package.json` lists missing `llms.txt` in `"files"`

**File:** `package.json:77`

The `"files"` array includes `"llms.txt"`, but no such file exists in the repo root.

**Fix:** Add the missing `llms.txt` if intended for packaging, or remove it from `"files"`.

### 2.4 `getSessionIdShort` ignores `detectEnv.getSessionId()`

**File:** `scripts/lib/utils.js:147-153`

Reads directly from `process.env.CLAUDE_SESSION_ID` instead of using the imported `detectEnv.getSessionId()`, which also checks `CURSOR_TRACE_ID`. Cursor sessions get the fallback "no-session" instead of their actual session ID.

**Fix:** Use `detectEnv.getSessionId()` instead of directly reading the env var.

### 2.5 Deprecated `getClaudeDir()` still in active use

**Files:** `scripts/lib/package-manager.js:10`, `scripts/lib/session-aliases.js:9`

Both import the deprecated `getClaudeDir` which logs a deprecation warning on every call. The replacement `getConfigDir()` already exists in `utils.js`.

**Fix:** Replace all `getClaudeDir()` imports and calls with `getConfigDir()`.

### 2.6 `updateAliasTitle` return value mismatch

**File:** `scripts/lib/session-aliases.js`

Stores `title || null` (coercing empty string to null) but returns the original `title`. Callers see `title: ""` but `null` is stored.

**Fix:** Return the stored value, not the input.

---

## Priority 3 — CI & Quality Gates

### 3.1 ESLint is currently failing

`npx eslint .` reports 21 errors and 3 warnings across `scripts/`, `skills/continuous-learning*`, and `tests/lib/detect-env.test.js`. Errors are mostly unused variables, empty blocks, and `eqeqeq` violations.

**Fix:** Fix all current ESLint errors. Consider enabling lint in CI as a blocking check.

### 3.2 CI security job uses `continue-on-error: true`

**File:** `.github/workflows/ci.yml:199`

`npm audit` runs but never blocks PRs. The comment claims it "marks job as failed" but `continue-on-error: true` actually makes the step report success regardless.

**Fix:** Either remove `continue-on-error` to make it blocking, or rename the job to `security-advisory` and add a comment clarifying it's informational only.

### 3.3 Reusable workflows exist but are dead code

Three reusable workflow files exist (`reusable-test.yml`, `reusable-validate.yml`, `reusable-release.yml`) but `ci.yml` and `release.yml` inline all logic instead of calling them. This creates maintenance drift — the reusable release workflow has a security fix (dynamic heredoc delimiter) that `release.yml` lacks.

**Fix:** Either refactor `ci.yml`/`release.yml` to call the reusable workflows, or delete the reusable files.

### 3.4 `release.yml` heredoc delimiter vulnerability

**File:** `.github/workflows/release.yml:49-51`

Uses a static `EOF` delimiter. If any commit message contains `EOF` on its own line, output is truncated. The reusable release workflow already uses a timestamped dynamic delimiter.

**Fix:** Use a dynamic delimiter: `COMMITS_END_$(date +%s)`.

### 3.5 Shallow CI validation for skills and rules

`validate-skills.js` and `validate-rules.js` only check "file exists and is non-empty". They don't validate expected structure (section headings, required fields) that `CONTRIBUTING.md` specifies. Compare with `validate-agents.js` which parses frontmatter and checks required fields.

**Fix:** Add structural checks: skills should have at minimum a heading and a "When to Use" section; rules should have heading and content.

### 3.6 Inconsistent BOM handling across validators

`validate-agents.js` strips BOM (`\uFEFF`); no other validator does. Files with BOM would pass agent validation but could fail others.

**Fix:** Extract a shared `readMarkdownFile()` helper with BOM stripping, used by all validators.

---

## Priority 4 — DRY Violations & Code Quality

### 4.1 Inline `node -e` commands in `hooks.json`

**File:** `hooks/hooks.json` (lines 10, 20, 30, 98, 108)

Five hooks embed multi-line JavaScript as minified one-liners inside JSON strings. Every other hook delegates to an external script file. These inline hooks are untestable, unlintable, and unreadable.

Affected hooks:
- "Block dev servers outside tmux"
- "Reminder to use tmux for long-running commands"
- "Reminder before git push"
- "Log PR URL after gh pr create"
- "Example: async hook for build analysis"

**Fix:** Extract each into a dedicated file under `scripts/hooks/` following the existing pattern. Update `hooks.json` references. This also resolves the Windows tmux overhead issue (extracted scripts can early-exit on Windows cleanly).

### 4.2 Duplicated stdin-reading boilerplate across 8 hook scripts

**Files:** `doc-file-warning.js`, `post-edit-typecheck.js`, `post-edit-format.js`, `post-edit-console-warn.js`, `check-console-log.js`, `pre-write-doc-warn.js`, `session-end.js`, `evaluate-session.js`

Each copy-pastes the same ~12-line stdin buffering pattern. `scripts/lib/utils.js` already exports `readStdinJson()`.

**Fix:** Replace all inline stdin-buffering with the shared `readStdinJson()`. (After fixing 1.5's listener cleanup issue first.)

### 4.3 Custom test framework duplicated across all test files

Every test file reimplements the same ~25-line `test()` / `asyncTest()` helper with `passed++/failed++` boilerplate. Verified in 8+ files.

**Fix:** Extract into `tests/helpers/test-runner.js` and have all test files import it.

### 4.4 Dead/duplicate `scripts/hooks/suggest-compact.js`

`hooks/hooks.json` wires `skills/strategic-compact/suggest-compact.js`, not the version in `scripts/hooks/`. The two implementations have diverged (the scripts version is 81 lines with shared utilities; the skills version is 48 lines, standalone, with `CURSOR_TRACE_ID` support).

**Fix:** Delete the unwired `scripts/hooks/suggest-compact.js`. Keep the skills version which is the one actually used.

### 4.5 `plugin.schema.json` is incomplete

Only defines `skills` and `agents` arrays. The project has 6 component types but the schema is missing `commands`, `rules`, `hooks`, and `mcp_configs`.

**Fix:** Add the missing array definitions to the schema.

### 4.6 Installer copies non-runtime files to target

**File:** `scripts/install-ecc.js:186-194`

`copyRecursiveSync` copies the entire `scripts/` directory with no filter, including `release.js`, `scripts/ci/`, `install-ecc.js` itself, and other dev-only files. Only `scripts/hooks/` and `scripts/lib/` are needed at runtime.

**Fix:** Filter the copy to only include `scripts/hooks/` and `scripts/lib/`, or add an exclusion list for dev-only files.

---

## Priority 5 — Test Infrastructure

### 5.1 Test runner (`run-all.js`) has multiple fragility issues

**File:** `tests/run-all.js`

- **No spawn error handling:** `spawnSync` can set `result.error` but it's never checked.
- **No timeout:** A hanging test blocks the suite indefinitely.
- **Hardcoded test list:** New test files must be manually added to the array.
- **Regex-based result parsing:** Uses `/Passed:\s*(\d+)/` to extract counts from stdout. If any test file changes its output format, totals break silently.

Note: Codex claimed "0 passed / 0 failed" false-green output, but current output shows 1021 passed / 2 failed — the regex parsing is working today, though it remains fragile.

**Fix:**
- Check `result.error` and count spawn failures.
- Add `timeout: 60000` to `spawnSync` calls.
- Auto-discover test files via glob, warn if the hardcoded list diverges.
- Consider structured result reporting instead of regex parsing.

### 5.2 Oversized test files

| File | Lines |
|------|-------|
| `tests/hooks/hooks.test.js` | 3,692 |
| `tests/lib/session-manager.test.js` | 2,591 |
| `tests/lib/utils.test.js` | 2,332 |
| `tests/lib/package-manager.test.js` | 1,688 |

These are unmanageable and make failure triage difficult.

**Fix:** Split by concern. E.g., split `hooks.test.js` into `session-hooks.test.js`, `edit-hooks.test.js`, `compact-hooks.test.js`.

### 5.3 Misnamed test file

`tests/scripts/powershell-scripts.test.js` tests Node.js scripts exclusively. The file's own comment says "Tests for skill runtime scripts (Node.js .js — cross-platform, no .ps1/.sh)".

**Fix:** Rename to `node-scripts.test.js` or `skill-runtime-scripts.test.js`.

### 5.4 No tests for `install-ecc.js`

The main installer (374 lines, 3 target platforms, argument parsing, file copying, JSON merging) has zero test coverage. It's the single most important entry point.

**Fix:** Add `tests/scripts/install-ecc.test.js` covering at minimum: Claude/Cursor/Codex install paths (with temp destinations), invalid target handling, missing language argument, self-copy guard, JSON merge behavior.

### 5.5 Inconsistent testability patterns

`detect-env.js` uses an excellent factory with dependency injection (`createDetectEnv`). `utils.js` captures platform flags at module load time with no override mechanism, forcing tests to use fragile `delete require.cache` hacks.

**Fix:** Apply the same factory/injection pattern to `utils.js` for platform-dependent behavior, or expose a `_resetForTesting()` function.

---

## Priority 6 — Agent & Schema Polish

### 6.1 `tdd-guide` is missing `Glob`

Has `["Read", "Write", "Edit", "Bash", "Grep"]` but no `Glob`. Every other write-capable agent includes `Glob` for file discovery.

**Fix:** Add `Glob` to the `tdd-guide` tools list.

### 6.2 Inconsistent agent tool ordering

Four different tool orderings exist across 18 agents. No standard pattern.

**Fix:** Standardize on:
- Read-only agents: `["Read", "Grep", "Glob", "Bash"]`
- Write-capable agents: `["Read", "Write", "Edit", "Bash", "Grep", "Glob"]`

### 6.3 Stale upstream references in non-doc files

| File | Issue |
|------|-------|
| `skills/configure-ecc/SKILL.md:32` | Clone URL points to upstream (see 2.1) |
| `.claude-plugin/plugin.json:9-10` | `homepage` and `repository` point to upstream |
| `.claude-plugin/marketplace.json:22-23` | Same |

**Fix:** Update `configure-ecc` clone URL (critical, see 2.1). Decide whether `.claude-plugin/` files need updating or are acceptable as upstream attribution since this fork doesn't publish to the marketplace.

---

## Priority 7 — Minor & Cosmetic

### 7.1 Unbounded log growth

**File:** `scripts/hooks/pre-compact.js`

Appends to `compaction-log.txt` indefinitely with no rotation or size limit.

**Fix:** Add log rotation (e.g., keep last 1000 lines or 100KB).

### 7.2 `session-aliases.js` accepts arrays as aliases

`typeof [] === 'object'` passes the validation check in `loadAliases`. A malformed file with `"aliases": [1,2,3]` is silently accepted.

**Fix:** Add `!Array.isArray(data.aliases)` to the guard.

### 7.3 `listAliases` throws TypeError on non-string search

`search.toLowerCase()` throws if search is a number or boolean.

**Fix:** Add `typeof search === 'string'` guard.

### 7.4 Redundant `existsSync` in `ensureDir`

**File:** `scripts/lib/utils.js:90-94`

`mkdirSync({ recursive: true })` already handles existing directories. The preceding `existsSync` check is unnecessary.

**Fix:** Remove the `existsSync` check.

### 7.5 Hooks.json tmux regex false positive

**File:** `hooks/hooks.json:20`

`yarn (install|test)?` — the `?` makes the group optional, matching bare `yarn ` commands that aren't install or test.

**Fix:** Remove the `?`: `yarn (install|test)`.

### 7.6 Installer copies itself

`scripts/install-ecc.js` copies the entire `scripts/` directory including itself. Installed copies don't need the installer.

**Fix:** Add `install-ecc.js` and `release.js` to the exclusion list. (Overlaps with 4.6.)

---

## Dropped / Corrected Findings

These items from the original audits were either incorrect or could not be verified:

| Original Claim | Verdict |
|----------------|---------|
| Codex: "Test summary produces 0 passed / 0 failed false-green" | **Incorrect.** Tests report 1021 passed / 2 failed. The regex parsing works today, though it remains fragile. |
| Cursor 3.4: "Inconsistent testability patterns" | **True but low priority.** The detect-env factory pattern is superior, but refactoring utils.js is a large undertaking with limited immediate benefit. Moved to P5. |
| Cursor 4.3: "release.yml heredoc delimiter vulnerability" | **True**, but classified as low-risk since commit messages containing a bare `EOF` line are extremely unlikely. Included as P3.4. |
| Claude 2.4: "Upstream sync strategy is undocumented" | **True**, but this is a process/documentation concern, not a code issue. Out of scope for this plan. |
| Claude 3.2: "CONTRIBUTING.md describes upstream contribution workflow" | **True**, but updating CONTRIBUTING.md should follow actual code changes, not precede them. Deferred. |

---

## Execution Order

Work in this sequence to avoid rework and maximize safety:

### Phase 1: Security & Correctness (items 1.1–1.6, 2.1–2.6)
Fix security issues first since they affect correctness of everything else. The input validation fixes (1.1–1.4) are small and independent. Test isolation (1.6) prevents config corruption during subsequent work.

### Phase 2: CI & Quality Gates (items 3.1–3.6)
Restore CI integrity so that all subsequent changes are properly gated. Fix lint, resolve missing scripts, and harden validation.

### Phase 3: DRY & Code Quality (items 4.1–4.6)
Extract inline hooks, consolidate duplicated patterns, remove dead code. These changes reduce the surface area for future bugs.

### Phase 4: Test Infrastructure (items 5.1–5.5)
Improve the test runner, split oversized test files, add missing coverage. Do this after the code quality improvements so the test infrastructure reflects the final code structure.

### Phase 5: Polish (items 6.1–6.3, 7.1–7.6)
Agent consistency, schema completeness, minor fixes. These are low-risk and can be done in any order.

---

## Recommended ECC Tooling Per Phase

| Phase | Agents | Commands |
|-------|--------|----------|
| 1: Security | `security-reviewer`, `tdd-guide`, `code-reviewer` | `/code-review`, `/tdd` |
| 2: CI | `build-error-resolver`, `code-reviewer` | `/build-fix`, `/verify` |
| 3: DRY | `planner`, `refactor-cleaner`, `code-reviewer` | `/plan`, `/refactor-clean`, `/code-review` |
| 4: Tests | `architect`, `tdd-guide`, `refactor-cleaner` | `/plan`, `/tdd`, `/refactor-clean` |
| 5: Polish | `doc-updater`, `code-reviewer` | `/update-docs`, `/code-review` |

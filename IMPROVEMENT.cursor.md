# Improvement Plan

Comprehensive review of the Everything Claude Code repository, organized by priority. Each item includes the problem, affected files, and a concrete fix.

---

## Priority 1 — Security & Correctness

### 1.1 `SAFE_NAME_REGEX` allows path traversal

`scripts/lib/package-manager.js` line 285: the regex `/^[@a-zA-Z0-9_./-]+$/` permits `../../../etc/passwd` because `.`, `/`, and `-` are individually allowed. The existing tests document this as a known issue.

**Fix:** Reject names containing `..` or starting with `/`. Add a post-regex guard:

```javascript
if (/\.\./.test(name) || name.startsWith('/')) return false;
```

### 1.2 `SAFE_ARGS_REGEX` permits newline injection

`scripts/lib/package-manager.js` line 319: `\s` in the character class matches `\n`, allowing multi-line argument injection. Tests document this.

**Fix:** Replace `\s` with explicit `[ \t]` (space and tab only).

### 1.3 `getExecCommand` bypasses validation for non-string args

`scripts/lib/package-manager.js` line 334: when `args` is a truthy non-string (e.g., `{}` or `42`), the `typeof args === 'string'` guard is skipped but the value is still string-concatenated into the command.

**Fix:** Add an explicit type check that rejects non-string truthy args.

### 1.4 `resolveSessionAlias` returns unsafe input unchanged

`scripts/lib/session-aliases.js` line 373: if input isn't a recognized alias, it's returned as-is. Callers using this to build file paths could be vulnerable.

**Fix:** Return `null` for unresolved aliases, or validate that the returned value is a safe filename.

### 1.5 Tests modify real user config files

- `tests/lib/package-manager.test.js` writes to `~/.claude/package-manager.json`
- `tests/hooks/evaluate-session.test.js` writes corrupt JSON to the repo's `skills/continuous-learning/config.json`

A crash during these tests corrupts real configuration.

**Fix:** Use isolated temp directories for all config-writing tests. Never touch real user or repo files.

---

## Priority 2 — Missing Coverage & Dead Code

### 2.1 No tests for `install-ecc.js`

The main installer (374 lines, 3 target platforms, argument parsing, file copying, JSON merging) has zero test coverage. It's the single most important entry point.

**Fix:** Add `tests/scripts/install-ecc.test.js` covering at minimum:
- Claude, Cursor, and Codex install paths (with temp destinations)
- Invalid target handling
- Missing language argument handling
- Self-copy guard
- JSON merge behavior for hooks and settings

### 2.2 Dead/duplicate `scripts/hooks/suggest-compact.js`

`hooks/hooks.json` wires `skills/strategic-compact/suggest-compact.js`, not this file. The two implementations have diverged. The scripts version is more complex and uses shared utilities; the skills version is standalone and simpler.

**Fix:** Delete the unwired copy. Keep whichever is canonical and update `hooks.json` if needed.

### 2.3 Deprecated `getClaudeDir()` still in active use

`scripts/lib/package-manager.js` and `scripts/lib/session-aliases.js` import the deprecated `getClaudeDir`. The migration target `getConfigDir()` already exists in `utils.js`.

**Fix:** Replace all `getClaudeDir()` calls with `getConfigDir()`. Remove or mark `getClaudeDir` as internal-only after migration.

### 2.4 `getSessionIdShort` ignores `detectEnv.getSessionId()`

`scripts/lib/utils.js` line 148: reads directly from `process.env.CLAUDE_SESSION_ID` instead of using `detectEnv.getSessionId()`, which also checks `CURSOR_TRACE_ID`. Cursor sessions get the fallback "no-session".

**Fix:** Use `detectEnv.getSessionId()` instead of directly reading the env var.

### 2.5 `plugin.schema.json` is incomplete

Only defines `skills` and `agents` arrays. The project has 6 component types: agents, skills, commands, rules, hooks, mcp-configs. Missing from schema: `commands`, `rules`, `hooks`, `mcp_configs`.

**Fix:** Add the missing array definitions to the schema.

---

## Priority 3 — DRY Violations & Code Quality

### 3.1 Duplicated stdin-reading boilerplate across 6+ hook files

`session-end.js`, `post-edit-typecheck.js`, `post-edit-format.js`, `check-console-log.js`, `evaluate-session.js`, and `post-edit-console-warn.js` each copy-paste the same ~12-line stdin buffering pattern. `utils.js` already has `readStdinJson()`.

**Fix:** Replace all inline stdin-buffering with the shared `readStdinJson()` from `scripts/lib/utils.js`.

### 3.2 Inline `node -e` commands in `hooks.json`

Five hooks use complex JS crammed into single JSON strings. Every other hook delegates to an external script file. These inline hooks are untestable, unlintable, and unreadable.

**Affected lines in `hooks/hooks.json`:** 10, 20, 30, 98, 108.

**Fix:** Extract each into a dedicated file under `scripts/hooks/` and update `hooks.json` to call `node scripts/hooks/<name>.js`.

### 3.3 Custom test framework duplicated 15 times

Every test file reimplements the same ~25-line `test()` helper with `passed++/failed++` boilerplate.

**Fix:** Extract into `tests/helpers/test-runner.js`:

```javascript
module.exports = function createTestRunner(suiteName) {
  let passed = 0, failed = 0;
  function test(name, fn) { /* ... */ }
  function asyncTest(name, fn) { /* ... */ }
  function report() { /* ... */ }
  return { test, asyncTest, report };
};
```

### 3.4 Inconsistent testability patterns

`detect-env.js` uses an excellent factory with dependency injection (`createDetectEnv`). `utils.js` captures platform flags at module load time with no override mechanism, forcing tests to use fragile `delete require.cache` hacks.

**Fix:** Apply the same factory/injection pattern to `utils.js` for platform-dependent behavior, or at minimum expose a `_resetForTesting()` function.

### 3.5 `readStdinJson` removes ALL stdin listeners

`scripts/lib/utils.js` line 248-263: on timeout, `process.stdin.removeAllListeners('data')` nukes all listeners, not just the ones this function registered.

**Fix:** Use named handler functions and remove only those specific listeners.

---

## Priority 4 — CI & Validation

### 4.1 CI security job uses `continue-on-error: true`

`.github/workflows/ci.yml`: the security job runs `npm audit` but never blocks PRs. The job name implies it should.

**Fix:** Either remove `continue-on-error` to make it blocking, or rename the job to `security-info` and add a comment explaining it's advisory only.

### 4.2 Reusable workflows exist but aren't used

`ci.yml` inlines the full test and validate logic rather than calling `reusable-test.yml` and `reusable-validate.yml`. This creates maintenance drift (e.g., `reusable-validate.yml` is missing the windows-parity validation step).

**Fix:** Either refactor `ci.yml` to call the reusable workflows, or delete the reusable files if they're not intended to be called.

### 4.3 `release.yml` heredoc delimiter vulnerability

`release.yml` uses a static `EOF` delimiter. If any commit message contains "EOF" on its own line, output is truncated. The reusable release workflow correctly uses a dynamic delimiter.

**Fix:** Use a timestamped delimiter like `COMMITS_END_$(date +%s)`.

### 4.4 Shallow CI validation for skills and rules

`validate-skills.js` and `validate-rules.js` only check "file exists and is non-empty". They don't validate expected structure (section headings, required fields) that `CONTRIBUTING.md` specifies.

**Fix:** Add structural checks: skills should have at minimum a heading and a "When to Use" or "Core Concepts" section. Rules should have a heading and content paragraphs.

### 4.5 Inconsistent BOM handling across validators

`validate-agents.js` strips BOM (`\uFEFF`); no other validator does. Files with BOM would pass agent validation but could fail in other validators.

**Fix:** Add BOM stripping to the common reading pattern in all validators, or extract a shared `readMarkdownFile()` helper.

---

## Priority 5 — Agent & Schema Polish

### 5.1 Inconsistent agent tool ordering

Four different tool orderings exist across 18 agents. `chief-of-staff` has a unique ordering different from every other agent.

**Fix:** Standardize on:
- Reviewers (read-only): `Read, Grep, Glob, Bash`
- Active agents (write): `Read, Write, Edit, Bash, Grep, Glob`

### 5.2 `tdd-guide` is missing `Glob`

Has `["Read", "Write", "Edit", "Bash", "Grep"]` but no `Glob`. All other write-capable agents include `Glob` for file discovery.

**Fix:** Add `Glob` to `tdd-guide` tools list.

### 5.3 Inconsistent agent body structure

Some agents open with `# Title` after frontmatter, others begin with a plain paragraph. Some end with `---` + bold "Remember" tagline, others just end.

**Fix:** Pick one format and apply it across all 18 agents. Suggested: always start with a role statement paragraph (no heading), always end with a bold tagline (no separator).

### 5.4 Schemas missing `additionalProperties: false`

`hooks.schema.json` and `plugin.schema.json` allow extra properties, which could mask typos in configuration.

**Fix:** Add `"additionalProperties": false` to object definitions.

---

## Priority 6 — Test Infrastructure

### 6.1 Test runner (`run-all.js`) lacks timeout and discovery

- No `timeout` on `spawnSync` — a hanging test blocks the suite indefinitely.
- Test files are hardcoded — new files must be manually added to the array.
- Missing files are silently skipped, not counted as failures.

**Fix:**
- Add `timeout: 60000` to each `spawnSync` call.
- Auto-discover test files via `glob('tests/**/*.test.js')` and warn if the hardcoded list diverges.
- Count missing test files as failures.

### 6.2 Windows test coverage gaps

15+ tests skip on Windows (`process.platform === 'win32'`) for chmod, symlink, and tmux-related tests. Since this fork emphasizes cross-platform support, this is a significant gap.

**Fix:** For each skipped test, add a Windows-equivalent assertion where possible (e.g., test read-only via `fs.accessSync` instead of `chmod`). For tests that are fundamentally Unix-only (tmux), document them clearly and ensure the overall test count reflects the skip.

### 6.3 Oversized test files

`tests/hooks/hooks.test.js` (3600+ lines), `tests/lib/utils.test.js` (2300+ lines), `tests/lib/session-manager.test.js` (2500+ lines) are unmanageable.

**Fix:** Split by concern. For example, split `hooks.test.js` into `hooks/session-hooks.test.js`, `hooks/edit-hooks.test.js`, `hooks/compact-hooks.test.js`.

### 6.4 Misnamed test file

`tests/scripts/powershell-scripts.test.js` tests Node.js scripts, not PowerShell.

**Fix:** Rename to `node-scripts.test.js` or `skill-runtime-scripts.test.js`.

---

## Priority 7 — Minor & Cosmetic

### 7.1 Unbounded log growth

`scripts/hooks/pre-compact.js` appends to `compaction-log.txt` indefinitely. Session files accumulate with no cleanup.

**Fix:** Add log rotation (e.g., keep last 1000 lines or 100KB) in `pre-compact.js`. Consider a `sessions cleanup` command.

### 7.2 `session-aliases.js` accepts arrays as aliases

`typeof [] === 'object'` passes the validation check. A malformed file with `"aliases": [1,2,3]` is silently accepted.

**Fix:** Add `!Array.isArray(data.aliases)` to the guard.

### 7.3 `listAliases` throws TypeError on non-string search

`search.toLowerCase()` throws if search is a number or boolean.

**Fix:** Add `typeof search === 'string'` guard.

### 7.4 `updateAliasTitle` return value mismatch

Line 393 stores `title || null` (coercing empty string to null) but line 400 returns the original `title`. Callers see `title: ""` but `null` is stored.

**Fix:** Return the stored value, not the input.

### 7.5 Inconsistent em-dash style in agents

Some agents use `--`, others use `—`.

**Fix:** Pick one (prefer `—` for prose, `--` for CLI flags) and apply globally.

### 7.6 Hooks.json tmux regex false positive

Line 20: `yarn (install|test)?` — the `?` makes the group optional, matching bare `yarn ` commands.

**Fix:** Remove the `?` or restructure: `yarn (install|test)`.

### 7.7 Redundant `existsSync` in `ensureDir`

`mkdirSync({ recursive: true })` already handles existing directories. The preceding `existsSync` check is unnecessary.

**Fix:** Remove the `existsSync` check.

### 7.8 `install-ecc.js` copies itself

The installer copies the entire `scripts/` directory including `install-ecc.js`. Installed copies don't need the installer.

**Fix:** Add `install-ecc.js` and `release.js` to the exclusion list during copy.

---

## Recommended Tooling Per Item

Which sub-agents, skills, and commands to use for each improvement group. Items marked "direct fix" are small, targeted edits that don't need agent delegation — just make the change and move on.

### Priority 1 — Security & Correctness

| Item | Recommended Tooling | Rationale |
|------|---------------------|-----------|
| 1.1 `SAFE_NAME_REGEX` | **Agent:** `security-reviewer` to audit the fix. **Skill:** `security-review` for the input-validation checklist. **Command:** `/code-review` after the fix. | Security-reviewer has OWASP-aware pattern matching and will catch if the fix introduces regressions. |
| 1.2 `SAFE_ARGS_REGEX` | Same as 1.1 — batch with 1.1 since they're in the same file. | |
| 1.3 `getExecCommand` type bypass | Same as 1.1 — batch with 1.1-1.2. | All three are input-validation bugs in `package-manager.js`. Fix together, one security review pass. |
| 1.4 `resolveSessionAlias` unsafe return | **Agent:** `security-reviewer`. **Then:** `code-reviewer` to check callers handle the new `null` return. | Changing the return type is a breaking API change — code-reviewer will flag callers that need updating. |
| 1.5 Tests modify real config | **Agent:** `tdd-guide`. **Skill:** `tdd-workflow`. **Command:** `/tdd` | This is test refactoring — tdd-guide enforces proper isolation patterns and will verify the rewritten tests still cover all original scenarios. |

**Workflow:** Fix 1.1-1.3 together → run `security-reviewer` once on the diff → `/code-review` → fix 1.4 → `code-reviewer` on callers → `/tdd` for 1.5.

### Priority 2 — Missing Coverage & Dead Code

| Item | Recommended Tooling | Rationale |
|------|---------------------|-----------|
| 2.1 Installer tests | **Agent:** `tdd-guide`. **Skill:** `tdd-workflow`. **Command:** `/tdd` | The TDD agent will scaffold the test file, write failing tests for each install path, then verify implementation satisfies them. |
| 2.2 Dead `suggest-compact.js` | **Agent:** `refactor-cleaner`. **Command:** `/refactor-clean` | Refactor-cleaner runs dead code detection (finding the unwired file) and safely removes it with verification. |
| 2.3 Deprecated `getClaudeDir` | Direct fix + **Agent:** `code-reviewer`. **Command:** `/code-review` | Simple find-and-replace, but code-reviewer will catch any callers or downstream effects missed. |
| 2.4 `getSessionIdShort` bug | Direct fix + **Command:** `/verify` | One-line bug fix. Verification loop confirms tests still pass after the change. |
| 2.5 Incomplete `plugin.schema.json` | Direct fix + **Agent:** `code-reviewer` | Schema changes are declarative — code-reviewer validates the schema matches actual data structures used. |

**Workflow:** `/tdd` for 2.1 (biggest piece) → `/refactor-clean` for 2.2 → direct fixes for 2.3-2.5 → `/code-review` on the batch.

### Priority 3 — DRY Violations & Code Quality

| Item | Recommended Tooling | Rationale |
|------|---------------------|-----------|
| 3.1 Duplicated stdin boilerplate | **Agent:** `refactor-cleaner`. **Command:** `/refactor-clean` | Classic consolidation task: identify 6 duplicates, replace with the existing `readStdinJson()`, verify no behavior change. |
| 3.2 Inline `node -e` in hooks.json | **Agent:** `planner` (design the extraction). **Skill:** `coding-standards`. **Command:** `/plan` then direct implementation. | Planner breaks down the 5 extractions into steps and identifies naming/structure. Coding-standards ensures the new files follow project conventions. |
| 3.3 Shared test helper | **Agent:** `architect` (design the API). **Agent:** `tdd-guide` (implement). **Command:** `/plan` then `/tdd` | Architect designs the `createTestRunner` interface. TDD-guide writes tests for the helper itself, then migrates each test file. |
| 3.4 Testability patterns in `utils.js` | **Agent:** `architect`. **Skill:** `coding-standards`. | Architectural decision: factory pattern vs `_resetForTesting`. Architect evaluates trade-offs against the existing `detect-env.js` pattern. |
| 3.5 `readStdinJson` listener cleanup | Direct fix + **Agent:** `code-reviewer` | Small, targeted fix — use named handler functions. Code-reviewer verifies no regressions in hook behavior. |

**Workflow:** `/plan` for 3.2 and 3.3 together (both are extraction tasks) → `/refactor-clean` for 3.1 → `architect` for 3.4 → direct fix for 3.5 → `/code-review` on the batch.

### Priority 4 — CI & Validation

| Item | Recommended Tooling | Rationale |
|------|---------------------|-----------|
| 4.1 Security job `continue-on-error` | Direct fix | One-line YAML change. No agent needed. |
| 4.2 Reusable workflows | **Agent:** `planner`. **Command:** `/plan` | Need to decide: refactor to use them, or delete them. Planner evaluates the trade-off and creates the consolidation plan. |
| 4.3 Heredoc delimiter | Direct fix | One-line fix copying the pattern from the reusable workflow. |
| 4.4 Deeper skill/rule validation | **Agent:** `tdd-guide`. **Skill:** `tdd-workflow`. **Command:** `/tdd` | Writing validation logic with expected test cases — TDD approach ensures the validators actually catch the problems they're meant to catch. |
| 4.5 BOM handling | **Agent:** `refactor-cleaner`. | Extract shared `readMarkdownFile()` helper from `validate-agents.js` and apply to all validators. Classic deduplication. |

**Workflow:** Direct fixes for 4.1, 4.3 → `/plan` for 4.2 → `/tdd` for 4.4 → `/refactor-clean` for 4.5 → `/verify`.

### Priority 5 — Agent & Schema Polish

| Item | Recommended Tooling | Rationale |
|------|---------------------|-----------|
| 5.1 Tool ordering | **Agent:** `doc-updater`. | Consistency pass across 18 markdown files — doc-updater's strength is systematic documentation updates. |
| 5.2 `tdd-guide` missing `Glob` | Direct fix | One word added to YAML frontmatter. |
| 5.3 Agent body structure | **Agent:** `doc-updater`. **Skill:** `coding-standards`. | Batch with 5.1 — same systematic pass across all agent files. Coding-standards skill provides the formatting rules. |
| 5.4 Schema `additionalProperties` | Direct fix + **Agent:** `code-reviewer` | Small schema changes, code-reviewer validates they don't break existing valid configs. |

**Workflow:** Direct fix for 5.2 → `doc-updater` for 5.1 + 5.3 as a batch → direct fix for 5.4 → `/code-review`.

### Priority 6 — Test Infrastructure

| Item | Recommended Tooling | Rationale |
|------|---------------------|-----------|
| 6.1 Test runner improvements | **Agent:** `architect` (design). **Agent:** `tdd-guide` (implement). **Skill:** `tdd-workflow`. | Architect designs the improved runner (timeout, discovery, failure modes). TDD-guide writes tests for the runner itself. |
| 6.2 Windows test gaps | **Agent:** `planner`. **Agent:** `tdd-guide`. **Command:** `/plan` then `/tdd` | Planner surveys all 15+ skipped tests and categorizes them (fixable on Windows vs. fundamentally Unix-only). TDD-guide writes the Windows equivalents. |
| 6.3 Oversized test files | **Agent:** `refactor-cleaner`. **Command:** `/refactor-clean` | File splitting with zero behavior change — refactor-cleaner's core competency. Verify test counts match before and after. |
| 6.4 Misnamed test file | Direct fix | Simple rename + update `run-all.js` test list. |

**Workflow:** `/plan` for 6.2 (needs analysis) → `architect` for 6.1 → `/refactor-clean` for 6.3 → direct fix for 6.4 → run full test suite.

### Priority 7 — Minor & Cosmetic

| Item | Recommended Tooling | Rationale |
|------|---------------------|-----------|
| 7.1 Log rotation | Direct fix + **Agent:** `code-reviewer` | Small feature addition. Code-reviewer validates the rotation logic. |
| 7.2 Array-as-aliases guard | Direct fix | One-line guard addition. |
| 7.3 `listAliases` TypeError | Direct fix | One-line type guard. |
| 7.4 `updateAliasTitle` return mismatch | Direct fix | One-line fix. |
| 7.5 Em-dash consistency | **Agent:** `doc-updater` | Systematic find-and-replace across agent markdown files. Batch with 5.1/5.3 if not already done. |
| 7.6 Tmux regex false positive | Direct fix | One character removed from regex. |
| 7.7 Redundant `existsSync` | Direct fix | Remove one conditional. |
| 7.8 Installer copies itself | Direct fix | Add two filenames to an exclusion list. |

**Workflow:** Batch all direct fixes (7.2-7.4, 7.6-7.8) into one pass → `doc-updater` for 7.5 → `code-reviewer` for 7.1 → `/verify`.

### Quick Reference — Agent/Skill/Command Summary

| Tool | Type | Used For (items) |
|------|------|------------------|
| `security-reviewer` | Agent | 1.1-1.4 — Input validation & security fixes |
| `tdd-guide` | Agent | 1.5, 2.1, 4.4, 6.1, 6.2 — Writing tests, test isolation |
| `code-reviewer` | Agent | 1.4, 2.3, 2.5, 3.5, 5.4, 7.1 — Post-fix review, catching regressions |
| `refactor-cleaner` | Agent | 2.2, 3.1, 4.5, 6.3 — Dead code removal, deduplication |
| `planner` | Agent | 3.2, 4.2, 6.2 — Breaking down multi-step work |
| `architect` | Agent | 3.3, 3.4, 6.1 — Designing shared helpers, DI patterns |
| `doc-updater` | Agent | 5.1, 5.3, 7.5 — Systematic markdown consistency passes |
| `security-review` | Skill | 1.1-1.4 — Input validation checklist and patterns |
| `tdd-workflow` | Skill | 1.5, 2.1, 4.4, 6.1 — TDD methodology and coverage targets |
| `coding-standards` | Skill | 3.2, 3.4, 5.3 — File structure, naming, and formatting rules |
| `verification-loop` | Skill | After any batch of changes — build + test + lint confirmation |
| `/plan` | Command | 3.2, 3.3, 4.2, 6.2 — Before multi-step refactoring |
| `/tdd` | Command | 1.5, 2.1, 4.4, 6.1, 6.2 — Test-first implementation |
| `/code-review` | Command | After every batch — quality gate before commit |
| `/refactor-clean` | Command | 2.2, 3.1, 4.5, 6.3 — Safe dead code removal |
| `/verify` | Command | End of each priority group — full verification loop |

### Parallelization Opportunities

Several items can be worked on simultaneously by launching multiple agents:

1. **1.1-1.3** (security fixes in `package-manager.js`) + **1.4** (security fix in `session-aliases.js`) — independent files
2. **2.2** (`/refactor-clean` on dead code) + **2.3-2.4** (direct bug fixes) — independent changes
3. **3.1** (stdin dedup) + **3.2** (hooks.json extraction) — independent refactors
4. **5.1+5.3** (`doc-updater` on agents) + **5.4** (schema fix) — markdown vs JSON, no overlap
5. **7.2-7.4** (session-aliases fixes) + **7.6-7.8** (hooks/utils fixes) — different files entirely

---

## Execution Order

Suggested order for tackling these improvements:

1. **Security fixes** (1.1-1.4) — Immediate, small changes, high impact
2. **Test isolation** (1.5) — Prevents accidental config corruption
3. **Installer tests** (2.1) — Biggest coverage gap
4. **Dead code cleanup** (2.2-2.4) — Quick wins
5. **DRY refactoring** (3.1-3.3) — Reduces maintenance burden
6. **CI improvements** (4.1-4.5) — Improves PR quality gates
7. **Agent/schema polish** (5.1-5.4) — Consistency pass
8. **Test infrastructure** (6.1-6.4) — Long-term maintainability
9. **Minor fixes** (7.1-7.8) — Polish

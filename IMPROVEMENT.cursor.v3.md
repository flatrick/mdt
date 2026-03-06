# Definitive Improvement Plan

Date: 2026-03-06
Repo: `flatrick/everything-claude-code` (Node-only fork)

This document merges findings from three independent audits (Codex, Claude, Cursor) and their cross-validated second revisions (v2). Every item was confirmed across at least one v2 review against the actual codebase. Items that could not be verified were dropped (see "Dropped / Corrected Findings" at the end).

Source chain: `IMPROVEMENT.codex.md` + `IMPROVEMENT.claude.md` + `IMPROVEMENT.cursor.md` → `IMPROVEMENT.codex.v2.md` + `IMPROVEMENT.claude.v2.md` + `IMPROVEMENT.cursor.v2.md` → this file.

---

## V1 Direction (Intentional Contract)

- Backward compatibility with legacy passthrough behavior is not a goal for this fork's v1.
- Security-first API contract: `resolveSessionAlias(...)` must return a resolved path or `null`, never raw input passthrough.
- Any caller that wants alias-or-path behavior must implement explicit fallback at the call site.
- In general, helpers that process user-provided identifiers should prefer explicit `null`/error over implicit trust.

---

## Status Snapshot (Already Completed)

- Removed missing CI step `validate-windows-parity.js` from `.github/workflows/ci.yml`.
- Removed missing `llms.txt` from `package.json` `files`.
- Updated `skills/configure-ecc/SKILL.md` clone URL to this fork.
- Added dependency preflight script (`scripts/ci/check-dependencies.js`) and wired it into `lint` and `test`.
- Hardened package-manager command validation (`SAFE_NAME_REGEX`, newline-safe args, strict args typing) with updated tests.
- Enforced v1 alias policy: `resolveSessionAlias(...)` now returns `null` when unresolved; typings/tests updated.
- Fixed `readStdinJson` listener cleanup to remove only owned listeners; added `parseJsonObject`.
- Refactored hook/validator scripts for direct-call testing to reduce subprocess-only test coupling.
- Added subprocess capability gating + strict mode and enabled strict mode in CI (`ECC_REQUIRE_SUBPROCESS_TESTS=1`).
- Replaced inline `node -e` command hooks in `hooks/hooks.json` with script-backed Node commands using `scripts/hooks/command-hooks.js`, and updated integration tests to execute both inline and script-form hook commands.
- Consolidated `suggest-compact` implementation into shared `scripts/hooks/suggest-compact.js`; `skills/strategic-compact/suggest-compact.js` now delegates to shared logic.
- Consolidated duplicated hook stdin buffering into shared utilities by adding `readStdinText(...)` in `scripts/lib/utils.js` and migrating hook scripts to shared stdin/JSON parsing helpers.
- Added missing `Glob` tool to `agents/tdd-guide.md` to align write-capable agent tooling with repository conventions.
- Expanded `schemas/plugin.schema.json` to model all active component families used by this fork (`commands`, `rules`, `hooks`, `mcp_configs` in addition to `skills`/`agents`).
- Renamed `tests/scripts/powershell-scripts.test.js` to `tests/scripts/node-runtime-scripts.test.js` and updated test runner wiring to match Node-only runtime coverage scope.
- Corrected tmux reminder command matching in `scripts/hooks/command-hooks.js` by requiring explicit `yarn install|test` (no optional group false-positive on bare `yarn`).
- Added bounded log rotation in `scripts/hooks/pre-compact.js` for `compaction-log.txt` (size threshold + tail retention) to prevent unbounded growth.
- Updated stale repository metadata URLs in `package.json`, `.claude-plugin/plugin.json`, and `.claude-plugin/marketplace.json` to this fork (`flatrick/everything-claude-code`).
- Updated `CONTRIBUTING.md` quick-start and issue references for this fork-first workflow, while explicitly noting upstream PRs as a separate path.
- Normalized user-facing guide/repo links in `README.md`, `the-longform-guide.md`, `the-security-guide.md`, and `commands/skill-create.md` to point to this fork where applicable.
- Added dedicated `tests/hooks/command-hooks.test.js` coverage and wired it into `tests/run-all.js` to verify command-hook mode behavior, passthrough, and exit-code paths.
- Migrated `tests/hooks/evaluate-session.test.js` to shared `tests/helpers/test-runner.js` utilities to reduce duplicated local test harness code.
- Migrated `tests/hooks/suggest-compact.test.js` to shared `tests/helpers/test-runner.js` test utilities (removing duplicated local `test()` implementation).
- Migrated `tests/lib/detect-env.test.js` to shared `tests/helpers/test-runner.js` utilities (removing duplicated local test harness code).
- Migrated `tests/scripts/skill-create-output.test.js` to shared `tests/helpers/test-runner.js` utilities (removing duplicated local test harness code).
- Migrated `tests/lib/project-detect.test.js` to shared `tests/helpers/test-runner.js` utilities (removing duplicated local test harness code).
- Migrated `tests/hooks/hooks-post-edit.test.js` and `tests/hooks/hooks-rounds-4.test.js` to shared `tests/helpers/test-runner.js` utilities (removing duplicated local `test()/asyncTest()` and temp-dir helpers).
- Migrated `tests/hooks/hooks-rounds.test.js`, `tests/hooks/hooks-rounds-2.test.js`, and `tests/hooks/hooks-rounds-3.test.js` to shared `tests/helpers/test-runner.js` utilities (removing duplicated local `test()/asyncTest()` and temp-dir helpers).
- Migrated `tests/hooks/hooks.test.js` and `tests/integration/hooks.test.js` to shared `tests/helpers/test-runner.js` utilities (removing duplicated local async-test and temp-dir helper scaffolding).
- Migrated `tests/ci/validators.test.js`, `tests/ci/validators-rounds*.test.js`, and `tests/lib/package-manager*.test.js` to shared `tests/helpers/test-runner.js` utilities (removing duplicated local `test()` and temp-dir helper scaffolding while preserving direct `os.tmpdir()` usage where needed).
- Migrated `tests/lib/session-manager*.test.js`, `tests/lib/session-aliases*.test.js`, and `tests/lib/utils*.test.js` to shared `tests/helpers/test-runner.js` `test()` helper (removing duplicated local test scaffolding while preserving suite-specific setup/cleanup helpers).
- Added shared hook test utilities in `tests/helpers/hook-test-utils.js` and migrated `tests/hooks/hooks*.test.js` suites to reuse `runScript(...)` and `getSessionsDirForHome(...)` instead of duplicating local implementations.
- Added shared CI validator test utilities in `tests/helpers/validator-test-utils.js` and migrated all `tests/ci/validators*.test.js` suites to reuse common validator invocation helpers (`runValidator*`) instead of duplicating local plumbing.
- Added shared session-aliases test environment setup in `tests/helpers/session-aliases-test-env.js` and migrated `tests/lib/session-aliases*.test.js` suites to reuse common isolated HOME/USERPROFILE bootstrap and alias reset logic.
- Added shared session-manager test utilities in `tests/helpers/session-manager-test-utils.js` and migrated `tests/lib/session-manager*.test.js` suites to reuse cache-reset and temp-dir helper logic instead of duplicating local implementations.
- Added shared integration hook execution utilities in `tests/helpers/hook-integration-test-utils.js` and migrated `tests/integration/hooks.test.js` to reuse common hook-command execution helpers instead of duplicating local process orchestration logic.
- Added shared environment override helper in `tests/helpers/env-test-utils.js` and migrated targeted `tests/lib/session-manager-rounds*.test.js` cases to use `withEnv(...)` for consistent HOME/USERPROFILE/CLAUDE_DIR save/restore handling.
- Expanded `withEnv(...)` adoption in `tests/lib/session-manager-rounds.test.js` for additional TOCTOU/subdirectory/limit-coercion round cases to reduce repeated manual environment save/restore scaffolding.
- Further expanded `withEnv(...)` adoption in `tests/lib/session-manager-rounds.test.js` by migrating additional grouped fixture phases (birthtime fallback and rounds 95-98 setup) to reduce manual environment lifecycle code.
- Further expanded `withEnv(...)` adoption in `tests/lib/session-manager-rounds.test.js` by migrating the initial seeded-session fixture phase (rounds 43/54/66) to shared environment lifecycle handling.
- Expanded `withEnv(...)` adoption in `tests/lib/session-aliases-rounds.test.js` for read-only/save-failure round cases to reduce repeated HOME/USERPROFILE save/restore scaffolding.
- Further expanded `withEnv(...)` adoption in `tests/lib/session-aliases-rounds.test.js` by migrating the Round 90 backup-restore failure path to shared environment lifecycle handling.
- Expanded `withEnv(...)` adoption in `tests/lib/package-manager.test.js` and `tests/lib/package-manager-rounds.test.js` for isolated HOME/USERPROFILE config-path scenarios to reduce repeated manual environment lifecycle code.
- Refactored shared `getSessionsDirForHome(...)` in `tests/helpers/hook-test-utils.js` to use `withEnv(...)` for consistent env override save/restore behavior.
- Expanded `withEnv(...)` adoption in `tests/lib/session-manager.test.js` for shared session fixture and `getAllSessions`/`getSessionById` coverage to eliminate remaining manual HOME/USERPROFILE mutation.
- Refactored `tests/helpers/session-aliases-test-env.js` to wrap `session-aliases` operations in `withEnv(...)` via a proxy, removing global HOME/USERPROFILE mutation while preserving existing test call sites.
- Reduced JavaScript lint baseline by removing unused test scaffolding imports/vars and low-risk script hygiene issues (unused vars, strict equality checks, and explicit no-op catch comments) across installer/claw and continuous-learning helper scripts.
- Hardened the `lint` npm script for Windows shell compatibility by switching markdownlint glob quoting, and fixed repository markdownlint findings (MD034/MD038) in active docs so lint now fails only on real issues.
- Restricted installer script payload to runtime-only directories (`scripts/hooks`, `scripts/lib`) for Claude/Cursor targets and added installer regression coverage in `tests/scripts/install-ecc.test.js` (included in `tests/run-all.js`).
- Made CI security scanning blocking (`npm audit` no longer uses advisory `continue-on-error`) and hardened release changelog output to use a unique heredoc delimiter in `.github/workflows/release.yml`.
- Introduced shared markdown read normalization (`scripts/ci/markdown-utils.js`) and deepened validator rules: skills now require heading + "When to Use/Activate", and rules now require heading + body content; tests and legacy skills were aligned.
- Removed dead reusable workflow variants (`reusable-test.yml`, `reusable-validate.yml`, `reusable-release.yml`) so inline workflows are the single source of truth.
- Added shared test helper utilities (`tests/helpers/test-runner.js`) and migrated several script suites to the common harness to reduce duplicated local test/cleanup scaffolding.
- Split `tests/ci/validators.test.js` into core + rounds suites (`validators.test.js`, `validators-rounds.test.js`) and updated `tests/run-all.js` so both execute in CI/test orchestration.
- Split `tests/lib/session-manager.test.js` into core + rounds suites (`session-manager.test.js`, `session-manager-rounds.test.js`) with isolated round-fixture setup and updated `tests/run-all.js` to execute both suites.
- Split `tests/hooks/hooks.test.js` into core + rounds suites (`hooks.test.js`, `hooks-rounds.test.js`) and updated `tests/run-all.js` to execute both suites.
- Split `tests/lib/session-aliases.test.js` into core + rounds suites (`session-aliases.test.js`, `session-aliases-rounds.test.js`) and updated `tests/run-all.js` to execute both suites.
- Split `tests/lib/utils.test.js` into core + rounds suites (`utils.test.js`, `utils-rounds.test.js`) and updated `tests/run-all.js` to execute both suites.
- Split `tests/lib/package-manager.test.js` into core + rounds suites (`package-manager.test.js`, `package-manager-rounds.test.js`) and updated `tests/run-all.js` to execute both suites.
- Further split oversized hook round coverage by adding `tests/hooks/hooks-rounds-2.test.js` and updated `tests/run-all.js` to execute both rounds suites.
- Split `tests/hooks/hooks.test.js` by concern by extracting post-edit hook coverage into `tests/hooks/hooks-post-edit.test.js`, and updated `tests/run-all.js` to execute it.
- Further split oversized session-manager rounds coverage by adding `tests/lib/session-manager-rounds-2.test.js`, and updated `tests/run-all.js` to execute both session-manager round suites.
- Further split oversized validator rounds coverage by adding `tests/ci/validators-rounds-2.test.js`, and updated `tests/run-all.js` to execute both validator round suites.
- Further split oversized utils rounds coverage by adding `tests/lib/utils-rounds-2.test.js`, and updated `tests/run-all.js` to execute both utils round suites.
- Further split oversized hooks rounds coverage by adding `tests/hooks/hooks-rounds-3.test.js`, and updated `tests/run-all.js` to execute all hooks round suites.
- Further split oversized session-aliases rounds coverage by adding `tests/lib/session-aliases-rounds-2.test.js`, and updated `tests/run-all.js` to execute both session-aliases round suites.
- Further split oversized hooks rounds coverage by adding `tests/hooks/hooks-rounds-4.test.js`, and updated `tests/run-all.js` to execute all hooks round suites.
- Further split oversized validator rounds coverage by adding `tests/ci/validators-rounds-3.test.js`, and updated `tests/run-all.js` to execute all validator round suites.

---

## Group 1 — Security & Input Validation

Input-validation bugs in code that constructs shell commands or file paths.

### 1.1 `SAFE_NAME_REGEX` permits path traversal

**File:** `scripts/lib/package-manager.js:285`
**Confirmed by:** all three v2 audits

The regex `/^[@a-zA-Z0-9_./-]+$/` allows `.`, `/`, and `-` individually, so `../../../etc/passwd` passes. Tests document this as a known gap.

**Fix:** Add a post-regex guard:

```javascript
if (/\.\./.test(name) || name.startsWith('/')) return false;
```

### 1.2 `SAFE_ARGS_REGEX` permits newline injection

**File:** `scripts/lib/package-manager.js:319`
**Confirmed by:** all three v2 audits

`\s` matches `\n` and `\r`, enabling multi-line argument injection. Tests document this.

**Fix:** Replace `\s` with `[ \t]` (space and tab only).

### 1.3 `getExecCommand` bypasses validation for non-string args

**File:** `scripts/lib/package-manager.js:334`
**Confirmed by:** all three v2 audits

When `args` is truthy but not a string (e.g., `{}`, `42`), the `typeof args === 'string'` guard is skipped but the value is still concatenated into the command string.

**Fix:** Reject non-string truthy args explicitly:

```javascript
if (args !== '' && typeof args !== 'string') throw new Error('args must be a string');
```

### 1.4 `resolveSessionAlias` returns unvalidated user input

**File:** `scripts/lib/session-aliases.js:365-374`
**Confirmed by:** all three v2 audits

When input is not a recognized alias, it is returned unchanged. Callers using the result to build file paths receive whatever was passed in with no sanitization.

**Fix options (pick one):**
- Return `null` for unresolved aliases and update all callers to handle `null`.
- Validate the returned string against a safe-path pattern before returning it.

### 1.5 `readStdinJson` removes ALL stdin listeners on timeout

**File:** `scripts/lib/utils.js:248-254`
**Confirmed by:** Codex v2, Claude v2, Cursor v2

`process.stdin.removeAllListeners('data'|'end'|'error')` nukes all listeners, not just those registered by this function. Any other stdin consumer in the process is silently broken.

**Fix:** Use named handler references and remove only those specific listeners.

### 1.6 Tests modify real user and repo config files

**Files:** `tests/lib/package-manager.test.js`, `tests/hooks/evaluate-session.test.js`
**Confirmed by:** Codex v2, Cursor v2

- `package-manager.test.js` writes to `~/.claude/package-manager.json`
- `evaluate-session.test.js` writes corrupt JSON to the repo's `skills/continuous-learning/config.json` and restores later

A crash during these tests corrupts real configuration.

**Fix:** Use isolated temp directories for all config-writing tests. Never touch real user or repo files.

---

## Group 2 — Broken Behavior / Will Fail

These block correct operation today or will fail in CI.

### 2.1 `validate-windows-parity.js` is referenced in CI but does not exist

**File:** `.github/workflows/ci.yml:168`
**Confirmed by:** all three v2 audits

CI runs `node scripts/ci/validate-windows-parity.js`. The file is absent. `reusable-validate.yml` also omits this step, creating drift.

**Fix options (pick one):**
- Add `scripts/ci/validate-windows-parity.js` with tests.
- Remove the step from `ci.yml` and document the decision.

### 2.2 `llms.txt` listed in `package.json` "files" but is absent

**File:** `package.json:77`
**Confirmed by:** all three v2 audits

The `"files"` array includes `"llms.txt"` but no such file exists. `npm pack` will warn or fail.

**Fix options (pick one):**
- Create `llms.txt` with a machine-readable index of skills/agents/commands.
- Remove `"llms.txt"` from the `files` array.

### 2.3 `configure-ecc` clones from upstream, not this fork

**File:** `skills/configure-ecc/SKILL.md:32`
**Confirmed by:** all three v2 audits

The clone URL hardcodes `https://github.com/affaan-m/everything-claude-code.git`. Running `/configure-ecc` installs the upstream version, discarding all fork-specific changes.

**Fix:** Change the clone URL to `https://github.com/flatrick/everything-claude-code.git`.

### 2.4 No dependency bootstrap / preflight gate

**Confirmed by:** Codex v2 (unique finding)

`npm run -s lint` fails with `Cannot find module '@eslint/js'` until `npm ci` is run. There is no preflight script that verifies dependencies before running quality commands.

**Fix:** Add a preflight check in `lint`/`test` wrappers that fails fast with an explicit "run npm ci" message when dependencies are missing. Consider a `npm run bootstrap` script alias for `npm ci`.

---

## Group 3 — Correctness Bugs

Silent wrong-result bugs that don't crash but produce incorrect behavior.

### 3.1 `getSessionIdShort` ignores `CURSOR_TRACE_ID`

**File:** `scripts/lib/utils.js:147-153`
**Confirmed by:** Codex v2, Claude v2, Cursor v2

Reads directly from `process.env.CLAUDE_SESSION_ID` instead of using `detectEnv.getSessionId()`, which also checks `CURSOR_TRACE_ID`. Cursor sessions get the fallback "no-session" instead of their actual session ID.

**Fix:** Use `detectEnv.getSessionId()` (already available via `detect-env.js`).

### 3.2 Deprecated `getClaudeDir()` still in active use

**Files:** `scripts/lib/package-manager.js:10`, `scripts/lib/session-aliases.js:9`
**Confirmed by:** Codex v2, Claude v2, Cursor v2

Both import the deprecated `getClaudeDir` which logs a deprecation warning on every call. The replacement `getConfigDir()` already exists.

**Fix:** Replace all `getClaudeDir()` imports and calls with `getConfigDir()`.

### 3.3 `updateAliasTitle` return value does not match stored value

**File:** `scripts/lib/session-aliases.js:393-400`
**Confirmed by:** all three v2 audits

Stores `title || null` (empty string becomes `null`) but returns the original `title`. A caller passing `""` receives `""` back but `null` is stored.

**Fix:** Return `data.aliases[alias].title` (the stored value) instead of `title`.

### 3.4 `session-aliases.js` accepts arrays as alias maps

**File:** `scripts/lib/session-aliases.js:58`
**Confirmed by:** Claude v2, Cursor v2

`typeof [] === 'object'` is `true`, so a corrupt aliases file with an array at the `aliases` key passes the guard silently.

**Fix:** Add `|| Array.isArray(data.aliases)` to the guard.

### 3.5 `listAliases` throws TypeError on non-string search

**File:** `scripts/lib/session-aliases.js`
**Confirmed by:** Codex v2, Cursor v2

`search.toLowerCase()` throws if search is a number or boolean.

**Fix:** Add `typeof search === 'string'` guard before filtering.

---

## Group 4 — CI & Quality Gates

### 4.1 CI security job has `continue-on-error: true`

**File:** `.github/workflows/ci.yml:199`
**Confirmed by:** all three v2 audits

`npm audit --audit-level=high` runs but never blocks a PR. The comment claims it "marks job as failed" but `continue-on-error: true` makes it report success regardless.

**Fix options (pick one):**
- Remove `continue-on-error: true` to make it blocking.
- Rename to `security-advisory` and add a comment clarifying it is informational only.

### 4.2 Reusable workflows exist but are dead code

**Files:** `reusable-test.yml`, `reusable-validate.yml`, `reusable-release.yml`
**Confirmed by:** Claude v2, Cursor v2

`ci.yml` and `release.yml` inline all logic instead of calling the reusable workflows. This creates maintenance drift — the reusable release workflow has a dynamic heredoc delimiter fix that `release.yml` lacks.

**Fix options (pick one):**
- Refactor `ci.yml`/`release.yml` to call the reusable workflows.
- Delete the reusable files and consolidate into the main workflows.

### 4.3 `release.yml` uses a static heredoc delimiter

**File:** `.github/workflows/release.yml:49`
**Confirmed by:** Codex v2, Claude v2, Cursor v2

`echo "commits<<EOF"` — if any commit message contains `EOF` on its own line, output is truncated. The reusable release workflow already uses a dynamic delimiter.

**Fix:** Use a randomised delimiter:

```yaml
DELIM="COMMITS_$(date +%s%N)"
echo "commits<<$DELIM" >> $GITHUB_OUTPUT
echo "$COMMITS" >> $GITHUB_OUTPUT
echo "$DELIM" >> $GITHUB_OUTPUT
```

### 4.4 Shallow CI validation for skills and rules

**Files:** `scripts/ci/validate-skills.js`, `scripts/ci/validate-rules.js`
**Confirmed by:** Codex v2, Cursor v2

Both validators only check "file exists and is non-empty". They don't validate expected structure (section headings, required fields) that `CONTRIBUTING.md` specifies. Compare with `validate-agents.js` which parses frontmatter and checks required fields.

**Fix:** Add structural checks: skills need a heading and a "When to Use" section; rules need a heading and content.

### 4.5 Inconsistent BOM handling across validators

**Files:** `scripts/ci/validate-agents.js` vs other validators
**Confirmed by:** Codex v2, Cursor v2

`validate-agents.js` strips BOM (`\uFEFF`); no other validator does. Files with BOM pass agent validation but could fail others.

**Fix:** Extract a shared `readMarkdownFile()` helper with BOM stripping, used by all validators.

### 4.6 ESLint is currently failing

**Confirmed by:** Cursor v2 (Codex v2 could not reproduce due to missing deps — see 2.4)

`npx eslint .` reports 21 errors and 3 warnings across `scripts/`, `skills/continuous-learning*`, and `tests/lib/detect-env.test.js`. Errors are mostly unused variables, empty blocks, and `eqeqeq` violations.

**Fix:** Fix all current ESLint errors. Consider enabling lint in CI as a blocking check.

---

## Group 5 — DRY & Code Quality

### 5.1 Five hooks embed complex JavaScript as minified JSON strings

**File:** `hooks/hooks.json` (lines 10, 20, 30, 98, 108)
**Confirmed by:** all three v2 audits

All other hooks delegate to external script files in `scripts/hooks/`. These inline hooks are untestable, unlintable, and unreadable.

Affected hooks:
- Block dev servers outside tmux
- Reminder to use tmux for long-running commands
- Reminder before git push
- Log PR URL after `gh pr create`
- Example: async hook for build analysis

**Fix:** Extract each to a dedicated file under `scripts/hooks/` following the existing pattern. Update `hooks.json` to call `node "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/<name>.js"`. This also resolves the Windows tmux overhead issue — extracted scripts can `process.exit(0)` early on Windows cleanly.

### 5.2 Duplicated stdin-reading boilerplate across 8 hook scripts

**Files:** `doc-file-warning.js`, `post-edit-typecheck.js`, `post-edit-format.js`, `post-edit-console-warn.js`, `check-console-log.js`, `pre-write-doc-warn.js`, `session-end.js`, `evaluate-session.js`
**Confirmed by:** all three v2 audits

Each copy-pastes the same ~12-line stdin buffering pattern. `scripts/lib/utils.js` already exports `readStdinJson()`.

**Fix:** Replace all inline stdin-buffering with the shared `readStdinJson()`. (Fix 1.5's listener cleanup issue first.)

### 5.3 Dead/duplicate `scripts/hooks/suggest-compact.js`

**Confirmed by:** all three v2 audits

`hooks/hooks.json` wires `skills/strategic-compact/suggest-compact.js`, not the version in `scripts/hooks/`. The two implementations have diverged (the scripts version uses shared utilities; the skills version is standalone with `CURSOR_TRACE_ID` support).

**Fix:** Delete `scripts/hooks/suggest-compact.js` and its test. Keep the skills version which is the one actually wired.

### 5.4 Custom test framework reimplemented in every test file

**Confirmed by:** Claude v2, Cursor v2

All test files define their own `passed`, `failed` counters and `test()` / `asyncTest()` functions (~25 lines of boilerplate each). This is the root cause of the fragile stdout-regex parsing in the runner.

**Fix:** Extract a shared `tests/helpers/test-runner.js` that each test file imports. The helper standardizes output format and exit code, making the runner simpler.

### 5.5 `plugin.schema.json` only covers 2 of 6 component types

**File:** `schemas/plugin.schema.json`
**Confirmed by:** Claude v2, Cursor v2

Defines `skills` and `agents` arrays only. Missing: `commands`, `rules`, `hooks`, `mcp_configs`.

**Fix:** Add the missing array definitions to the schema.

### 5.6 Installer copies non-runtime files to target

**File:** `scripts/install-ecc.js:186-194`
**Confirmed by:** Claude v2, Cursor v2

`copyRecursiveSync` copies the entire `scripts/` directory, including `release.js`, `install-ecc.js` itself, `setup-package-manager.js`, `claw.js`, and `scripts/ci/` validators. Only `scripts/hooks/` and `scripts/lib/` are runtime dependencies.

**Fix:** Replace the recursive copy with two selective copies:
- `scripts/hooks/` → `${claudeBase}/scripts/hooks/`
- `scripts/lib/` → `${claudeBase}/scripts/lib/`

### 5.7 `tdd-guide` agent is missing `Glob`

**File:** `agents/tdd-guide.md:4`
**Confirmed by:** all three v2 audits

Tools list is `["Read", "Write", "Edit", "Bash", "Grep"]`. Every other write-capable agent includes `Glob` for file discovery.

**Fix:** Add `"Glob"` to the tools list.

---

## Group 6 — Test Infrastructure

### 6.1 Test runner (`run-all.js`) has multiple fragility issues

**File:** `tests/run-all.js`
**Confirmed by:** all three v2 audits

- **No exit-code checking:** `spawnSync` is called but `result.status` is never read.
- **No spawn error handling:** `result.error` is never checked.
- **No timeout:** A hanging test blocks the suite indefinitely.
- **Regex-based result parsing:** Uses `/Passed:\s*(\d+)/` to extract counts from stdout. If any test file changes its format, totals break silently.
- **Missing files silently skipped:** A deleted or renamed test file disappears from the suite with only a warning.

Note: Codex v1 claimed "0 passed / 0 failed" false-green output. This was corrected in Cursor v2: current output shows 1021 passed / 2 failed. The regex parsing works today, but remains fragile.

**Fix:**
- Check `result.status !== 0` as a fallback failure signal.
- Check `result.error` and count spawn failures.
- Add `timeout: 60000` to `spawnSync` calls.
- Treat missing test files as failures.
- Consider auto-discovering test files via glob and warning if the hardcoded list diverges.

### 6.2 No tests for `install-ecc.js`

**Confirmed by:** Codex v2, Cursor v2

The main installer (374 lines, 3 target platforms, argument parsing, file copying, JSON merging) has zero test coverage. It is the single most important entry point.

**Fix:** Add `tests/scripts/install-ecc.test.js` covering at minimum: Claude/Cursor/Codex install paths (with temp destinations), invalid target handling, missing language argument, self-copy guard, JSON merge behavior.

### 6.3 Oversized test files

**Confirmed by:** Cursor v2

| File | Lines |
|------|-------|
| `tests/hooks/hooks.test.js` | 3,692 |
| `tests/lib/session-manager.test.js` | 2,591 |
| `tests/lib/utils.test.js` | 2,332 |
| `tests/lib/package-manager.test.js` | 1,688 |

These are unmanageable and make failure triage difficult.

**Fix:** Split by concern. E.g., split `hooks.test.js` into `session-hooks.test.js`, `edit-hooks.test.js`, `compact-hooks.test.js`.

### 6.4 Misnamed test file

**File:** `tests/scripts/powershell-scripts.test.js`
**Confirmed by:** Cursor v2

Tests Node.js scripts exclusively. The file's own comment says "Tests for skill runtime scripts (Node.js .js — cross-platform, no .ps1/.sh)".

**Fix:** Rename to `node-scripts.test.js` or `skill-runtime-scripts.test.js`.

### 6.5 Inconsistent testability patterns

**Confirmed by:** Cursor v2

`detect-env.js` uses an excellent factory with dependency injection (`createDetectEnv`). `utils.js` captures platform flags at module load time with no override mechanism, forcing tests to use fragile `delete require.cache` hacks.

**Fix:** Apply the same factory/injection pattern to `utils.js` for platform-dependent behavior, or expose a `_resetForTesting()` function.

---

## Group 7 — Documentation, Minor & Cosmetic

### 7.1 Stale upstream URLs in non-documentation files

**Confirmed by:** all three v2 audits

| File | Issue |
|------|-------|
| `skills/configure-ecc/SKILL.md:32` | Clone URL (fixed by 2.3) |
| `.claude-plugin/plugin.json:9-10` | `homepage` and `repository` point to upstream |
| `.claude-plugin/marketplace.json:22-23` | Same |
| `package.json:27-38` | `author`, `repository`, `homepage`, `bugs` reference upstream |

**Fix:** Update `configure-ecc` clone URL (critical, handled by 2.3). Decide whether `.claude-plugin/` and `package.json` metadata need updating, or are acceptable as upstream attribution since this fork doesn't publish.

### 7.2 `CONTRIBUTING.md` describes upstream contribution workflow

**Confirmed by:** Claude v2, Cursor v2

Instructs readers to fork `affaan-m/everything-claude-code` and submit PRs there. Misleading for a personal fork.

**Fix:** Update to clarify this is a personal fork, redirect contributors to upstream, and describe the actual upstream-sync workflow.

### 7.3 Unbounded log growth in `pre-compact.js`

**File:** `scripts/hooks/pre-compact.js`
**Confirmed by:** Cursor v2

Appends to `compaction-log.txt` indefinitely with no rotation or size limit.

**Fix:** Add log rotation (e.g., keep last 1000 lines or 100KB).

### 7.4 Redundant `existsSync` in `ensureDir`

**File:** `scripts/lib/utils.js:90-94`
**Confirmed by:** Cursor v2

`mkdirSync({ recursive: true })` already handles existing directories. The preceding `existsSync` check is unnecessary.

**Fix:** Remove the `existsSync` check.

### 7.5 Hooks.json tmux regex false positive

**File:** `hooks/hooks.json:20`
**Confirmed by:** Cursor v2

`yarn (install|test)?` — the `?` makes the group optional, matching bare `yarn` commands that aren't install or test.

**Fix:** Remove the `?`: `yarn (install|test)`.

---

## Execution Order

Work in this sequence to avoid rework and maximise safety.

### Phase 1: Security & Broken Behavior (Groups 1 + 2)

Fix security issues first since they affect correctness of everything else. The input validation fixes (1.1–1.3) are small and independent. Test isolation (1.6) prevents config corruption during subsequent work. Broken CI items (2.1–2.3) restore the ability to validate further changes. The preflight gate (2.4) makes the dev loop reliable.

### Phase 2: Correctness & CI (Groups 3 + 4)

Bug fixes (3.1–3.5) are small, targeted, and independent. CI hardening (4.1–4.6) ensures all subsequent changes are properly gated. Fix ESLint (4.6) so linting can be trusted going forward.

### Phase 3: DRY & Code Quality (Group 5)

Extract inline hooks (5.1), consolidate duplicated patterns (5.2, 5.4), remove dead code (5.3). These reduce the surface area for future bugs and make Group 6 work cleaner.

### Phase 4: Test Infrastructure (Group 6)

Improve the test runner (6.1), add missing coverage (6.2), split oversized files (6.3). Do this after the code quality improvements so the test infrastructure reflects the final code structure.

### Phase 5: Polish (Group 7)

Documentation, minor fixes, cosmetics. Low risk, any order.

---

## Parallelisation Opportunities

The following sets of items touch independent files and can be worked simultaneously:

| Parallel set | Items | Files touched |
|-------------|-------|---------------|
| A | 1.1–1.3 + 1.4 | `package-manager.js` + `session-aliases.js` |
| B | 2.1 + 2.2 + 2.3 | `ci.yml` + `package.json` + `SKILL.md` |
| C | 3.1 + 3.2 | `utils.js` + `package-manager.js`/`session-aliases.js` |
| D | 3.3–3.5 (all in `session-aliases.js`) | Batch into one PR |
| E | 5.2 (stdin dedup) + 5.3 (dead code) + 5.7 (tdd-guide Glob) | Hook scripts + `suggest-compact.js` + `tdd-guide.md` |
| F | 6.2 (installer tests) + 6.4 (rename test) | Independent test files |
| G | 7.1 + 7.2 | Documentation files |

---

## Recommended ECC Tooling Per Phase

| Phase | Agents | Commands |
|-------|--------|----------|
| 1: Security & Broken | `security-reviewer`, `tdd-guide`, `code-reviewer` | `/code-review`, `/tdd` |
| 2: Correctness & CI | `build-error-resolver`, `code-reviewer` | `/build-fix`, `/verify` |
| 3: DRY & Quality | `planner`, `refactor-cleaner`, `code-reviewer` | `/plan`, `/refactor-clean`, `/code-review` |
| 4: Test Infra | `architect`, `tdd-guide`, `refactor-cleaner` | `/plan`, `/tdd`, `/refactor-clean` |
| 5: Polish | `doc-updater`, `code-reviewer` | `/update-docs`, `/code-review` |

---

## Dropped / Corrected Findings

Items from the original audits that were incorrect, unverifiable, or purely stylistic:

| Original Claim | Source | Verdict |
|----------------|--------|---------|
| Test summary produces "0 passed / 0 failed" false-green | Codex v1 | **Incorrect.** Tests report 1021 passed / 2 failed. Regex parsing works today, though fragile. |
| 21 ESLint errors reproducible | Codex v1, Cursor v2 | **Partially confirmed.** Codex v2 could not reproduce because `npm run -s lint` fails earlier due to missing deps. Cursor v2 reports the errors after running `npx eslint .` directly. |
| 15+ tests skip on Windows | Cursor v1 | **Unverifiable** without running test suite on Windows. |
| Oversized test files (3600+ lines) | Cursor v1 | **True but stylistic.** Included as 6.3 at lower priority. |
| Inconsistent agent tool ordering | Cursor v1 | **Purely cosmetic.** No functional impact. Excluded. |
| Inconsistent agent body structure | Cursor v1 | **Purely cosmetic.** No functional impact. Excluded. |
| Em-dash consistency across agents | Cursor v1 | **Cosmetic only.** Excluded. |
| Add `--list`/`--dry-run` to installer | Claude v1 | **Good UX improvement but not a defect.** Out of scope for a fix plan. |
| Document upstream sync strategy | Claude v1 | **Good practice but not a code defect.** Out of scope. |
| `additionalProperties: false` in schemas | Cursor v1 | **Stylistic preference.** Could break valid configs. Excluded. |

---

## Item Count Summary

| Group | Items | Risk |
|-------|-------|------|
| 1: Security & Input Validation | 6 | High |
| 2: Broken / Will Fail | 4 | High |
| 3: Correctness Bugs | 5 | Medium |
| 4: CI & Quality Gates | 6 | Medium |
| 5: DRY & Code Quality | 7 | Medium |
| 6: Test Infrastructure | 5 | Low |
| 7: Documentation, Minor & Cosmetic | 5 | Low |
| **Total** | **38** | |

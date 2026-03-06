# Consolidated Improvement Plan v3

Date: 2026-03-06
Basis: Cross-agent synthesis of three independent v2 audits (Codex, Cursor, Claude).

Every item below was confirmed by at least two of the three agents unless marked
**[single-agent]** — those are included where the evidence in source is clear even
without corroboration. Items that were contradicted or could not be verified are
listed in the **Dropped / Disputed** section at the end.

---

## V1 Direction (Intentional Contract)

- Backward compatibility with legacy passthrough behavior is not a goal for this fork's v1.
- Security-first API contract: `resolveSessionAlias(...)` must return a resolved path or `null`, never raw input passthrough.
- Any caller that wants alias-or-path behavior must implement explicit fallback at the call site.
- In general, helpers that process user-provided identifiers should prefer explicit `null`/error over implicit trust.

---

## Status Snapshot (Already Completed)

- Removed the missing CI parity step (`validate-windows-parity.js`) from `.github/workflows/ci.yml`.
- Removed missing `llms.txt` from `package.json` packaging `files`.
- Updated `/configure-ecc` source in `skills/configure-ecc/SKILL.md` to this fork.
- Added dependency preflight check (`scripts/ci/check-dependencies.js`) and enforced it in `lint` and `test`.
- Implemented package-manager hardening (path traversal guard, newline-safe args, non-string args rejection) and aligned tests.
- Implemented v1 alias contract: `resolveSessionAlias(...)` resolves alias or returns `null` (no implicit passthrough).
- Refactored `readStdinJson` to remove only local listeners; exported `parseJsonObject` and updated tests.
- Converted key hook/CI scripts to callable modules and rewrote related tests to avoid unnecessary nested subprocesses.
- Added subprocess capability guard with strict mode, and enabled strict mode in CI via `ECC_REQUIRE_SUBPROCESS_TESTS=1`.
- Replaced inline `node -e` command hooks in `hooks/hooks.json` with script-backed Node commands via `scripts/hooks/command-hooks.js`, and updated integration tests to run both inline and script-form hook commands.
- Consolidated `suggest-compact` behavior into shared `scripts/hooks/suggest-compact.js`; `skills/strategic-compact/suggest-compact.js` now serves as a wrapper entrypoint.
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
- Restricted installer payload to runtime scripts only (`scripts/hooks` and `scripts/lib`) for Claude/Cursor installs and added dedicated installer tests (`tests/scripts/install-ecc.test.js`) to guard copy-scope and settings-merge behavior.
- CI security checks are now blocking by configuration (`npm audit` in `.github/workflows/ci.yml`), and `.github/workflows/release.yml` now uses a dynamic heredoc delimiter for changelog output safety.
- Added shared markdown normalization utilities for CI validators and strengthened structural checks: skills require heading + "When to Use/Activate"; rules require heading + non-empty body content. Validator tests and affected skill docs were updated to match.
- Removed unreferenced reusable workflow files and standardized on inline workflow definitions (`ci.yml`, `release.yml`) to eliminate configuration drift.
- Added shared test runner helpers (`tests/helpers/test-runner.js`) and migrated script-oriented test files to use the shared `test`/temp-dir utilities.
- Split the oversized validator test file into two suites (`tests/ci/validators.test.js` and `tests/ci/validators-rounds.test.js`) and wired both into the aggregate runner.
- Split `tests/lib/session-manager.test.js` into core + rounds suites (`tests/lib/session-manager.test.js`, `tests/lib/session-manager-rounds.test.js`) and wired both suites into `tests/run-all.js` with explicit seeded-session fixture setup in the rounds suite.
- Split `tests/hooks/hooks.test.js` into core + rounds suites (`tests/hooks/hooks.test.js`, `tests/hooks/hooks-rounds.test.js`) and wired both suites into `tests/run-all.js`.
- Split `tests/lib/session-aliases.test.js` into core + rounds suites (`tests/lib/session-aliases.test.js`, `tests/lib/session-aliases-rounds.test.js`) and wired both suites into `tests/run-all.js`.
- Split `tests/lib/utils.test.js` into core + rounds suites (`tests/lib/utils.test.js`, `tests/lib/utils-rounds.test.js`) and wired both suites into `tests/run-all.js`.
- Split `tests/lib/package-manager.test.js` into core + rounds suites (`tests/lib/package-manager.test.js`, `tests/lib/package-manager-rounds.test.js`) and wired both suites into `tests/run-all.js`.
- Further split oversized hooks round coverage by adding `tests/hooks/hooks-rounds-2.test.js` and wiring both hook-round suites into `tests/run-all.js`.
- Split `tests/hooks/hooks.test.js` by concern by extracting post-edit hook coverage into `tests/hooks/hooks-post-edit.test.js`, and wired it into `tests/run-all.js`.
- Further split oversized session-manager round coverage by adding `tests/lib/session-manager-rounds-2.test.js` and wiring both session-manager round suites into `tests/run-all.js`.
- Further split oversized validator round coverage by adding `tests/ci/validators-rounds-2.test.js` and wiring both validator round suites into `tests/run-all.js`.
- Further split oversized utils round coverage by adding `tests/lib/utils-rounds-2.test.js` and wiring both utils round suites into `tests/run-all.js`.
- Further split oversized hooks round coverage by adding `tests/hooks/hooks-rounds-3.test.js` and wiring all hooks round suites into `tests/run-all.js`.
- Further split oversized session-aliases round coverage by adding `tests/lib/session-aliases-rounds-2.test.js` and wiring both session-aliases round suites into `tests/run-all.js`.
- Further split oversized hooks round coverage by adding `tests/hooks/hooks-rounds-4.test.js` and wiring all hooks round suites into `tests/run-all.js`.
- Further split oversized validator round coverage by adding `tests/ci/validators-rounds-3.test.js` and wiring all validator round suites into `tests/run-all.js`.

---

## Batch 1 — Security & Input Validation

Fix first. These touch code that constructs shell commands or builds file paths from
external input. Independent of each other; can be parallelised across the two files.

### 1.1 `SAFE_NAME_REGEX` allows path traversal

**File:** `scripts/lib/package-manager.js:285`
**Confirmed by:** all three agents

The regex `/^[@a-zA-Z0-9_./-]+$/` allows `.`, `/`, and `-` individually, so
`../../../etc/passwd` passes. The existing tests document this as a known gap.

**Fix:** Add a guard before the regex check:

```js
if (/\.\./.test(name) || name.startsWith('/')) throw new Error('Unsafe package name');
```

---

### 1.2 `SAFE_ARGS_REGEX` permits newline injection

**File:** `scripts/lib/package-manager.js:319`
**Confirmed by:** all three agents

`\s` in the character class matches `\n` and `\r`, enabling multi-line argument
injection into constructed shell commands. The tests document this as a known issue.

**Fix:** Replace `\s` with `[ \t]` (space and tab only).

---

### 1.3 `getExecCommand` accepts truthy non-string `args` without validation

**File:** `scripts/lib/package-manager.js:334`
**Confirmed by:** all three agents

When `args` is truthy but not a string (e.g. `{}` or `42`), the
`typeof args === 'string'` guard is skipped, but the value is still
string-concatenated into the returned command.

**Fix:**

```js
if (args !== '' && args !== null && args !== undefined && typeof args !== 'string') {
  throw new Error('args must be a string');
}
```

---

### 1.4 `resolveSessionAlias` returns unvalidated user input unchanged

**File:** `scripts/lib/session-aliases.js:365-374`
**Confirmed by:** all three agents

When the input is not a recognised alias it is returned as-is. Callers that use
the result to build file paths receive the raw caller-supplied string with no
sanitisation.

**Fix:** Return `null` for unresolved aliases. Update all callers to handle `null`.

---

### 1.5 `readStdinJson` removes ALL stdin listeners on timeout

**File:** `scripts/lib/utils.js:252-254`
**Confirmed by:** all three agents (Cursor classifies as P1 security; others P2)

`process.stdin.removeAllListeners('data'|'end'|'error')` nukes every listener,
not only the ones this function registered. Any other stdin consumer in the same
process would be silently broken.

**Fix:** Use named handler references; remove only the specific handlers this
function registered.

Note: Fix this **before** Batch 4 stdin consolidation — the consolidated callers
will all share this code path.

---

### 1.6 `session-aliases.js` accepts arrays as the alias map

**File:** `scripts/lib/session-aliases.js:58`
**Confirmed by:** Codex, Cursor

`typeof [] === 'object'` is `true`, so a corrupt aliases file with
`"aliases": [1,2,3]` passes the guard silently.

**Fix:**

```js
if (!data.aliases || typeof data.aliases !== 'object' || Array.isArray(data.aliases)) { ... }
```

---

### 1.7 `listAliases` throws TypeError on non-string `search`

**File:** `scripts/lib/session-aliases.js`
**Confirmed by:** Codex, Cursor

`search.toLowerCase()` is called without a type guard. Passing a number or
boolean throws immediately.

**Fix:** Add `if (typeof search !== 'string') return [];` (or throw) at the top
of the function.

---

### 1.8 Tests write to real user config and repo config files

**Files:** `tests/lib/package-manager.test.js`, `tests/hooks/evaluate-session.test.js`
**Confirmed by:** Codex, Cursor (Claude excluded as unverified at runtime)

`package-manager.test.js` writes to `~/.claude/package-manager.json`.
`evaluate-session.test.js` writes corrupt JSON to the tracked repo file
`skills/continuous-learning/config.json`. A crash during either test corrupts
real configuration.

**Fix:** Use isolated temp directories for all config-writing tests. Never touch
real user or tracked repo files in tests.

---

## Batch 2 — Broken Behaviour & CI Integrity

Fix before relying on CI to gate any subsequent work.

### 2.1 `configure-ecc` clones from upstream, not this fork

**File:** `skills/configure-ecc/SKILL.md:32`
**Confirmed by:** all three agents

The clone URL hardcodes `https://github.com/affaan-m/everything-claude-code.git`.
Running `/configure-ecc` installs the upstream version, discarding all fork-specific
changes.

**Fix:** Change to `https://github.com/flatrick/everything-claude-code.git`.

---

### 2.2 CI references a missing validator script

**File:** `.github/workflows/ci.yml:168`
**Confirmed by:** all three agents

`node scripts/ci/validate-windows-parity.js` is executed in CI but the file does
not exist anywhere in the repository. CI fails unconditionally on this step.

**Fix options (pick one):**
- Add `scripts/ci/validate-windows-parity.js` that verifies `.ps1` counterparts
  exist for all runtime shell scripts (aligns with the project's Windows parity goal).
- Remove the step from `ci.yml` and document the decision.

After resolving, apply the same change to `reusable-validate.yml` to keep them
in sync (see 2.5).

---

### 2.3 `package.json` lists `llms.txt` in `"files"` but the file is absent

**File:** `package.json:77`
**Confirmed by:** all three agents

`npm pack` will warn; downstream consumers expecting the file will not find it.

**Fix options (pick one):**
- Create `llms.txt` with a machine-readable index of all skills/agents/commands.
- Remove `"llms.txt"` from the `files` array.

---

### 2.4 Security CI job uses `continue-on-error: true`

**File:** `.github/workflows/ci.yml:199`
**Confirmed by:** all three agents

`npm audit --audit-level=high` runs but never blocks a PR. The comment claims it
"marks job as failed" but `continue-on-error: true` makes the step report success
regardless.

**Fix options (pick one):**
- Remove `continue-on-error: true` to make it a blocking gate.
- Rename the job to `security-advisory` and add a comment that it is informational
  only, so the intent is explicit.

---

### 2.5 Reusable workflows exist but are dead code / drifted

**Files:** `reusable-test.yml`, `reusable-validate.yml`, `reusable-release.yml`
**Confirmed by:** Cursor **[single-agent]** — but the heredoc delta (below) is
confirmed by all three, making the drift real.

`ci.yml` and `release.yml` inline all logic instead of calling the reusable
workflows, so the two sets have drifted. Notably, `reusable-release.yml` already
uses a dynamic heredoc delimiter (see 2.6) while `release.yml` does not.

**Fix options (pick one):**
- Refactor `ci.yml`/`release.yml` to call the reusable workflows (preferred for
  long-term maintenance).
- Delete the three reusable files and document that inline workflows are canonical.

---

### 2.6 `release.yml` uses a static `EOF` heredoc delimiter

**File:** `.github/workflows/release.yml:49`
**Confirmed by:** all three agents

If any commit message contains `EOF` on its own line, the GitHub Actions output is
truncated at that point. `reusable-release.yml` already uses a dynamic delimiter.

**Fix:**

```yaml
DELIM="COMMITS_$(date +%s%N)"
echo "commits<<$DELIM" >> $GITHUB_OUTPUT
echo "$COMMITS" >> $GITHUB_OUTPUT
echo "$DELIM" >> $GITHUB_OUTPUT
```

---

## Batch 3 — Test Infrastructure

Fix the test runner before relying on it to validate changes from later batches.

### 3.1 `tests/run-all.js` has multiple structural fragilities

**File:** `tests/run-all.js:46-71`
**Confirmed by:** all three agents

Four independent problems:

1. **No exit-code check:** `spawnSync` result `status` is never read. A suite that
   exits 1 but emits matching stdout regex is counted as passing.
2. **No spawn-error check:** `result.error` is never checked. A failed spawn
   contributes 0 to `totalFailed`.
3. **No timeout:** A hanging test file blocks the entire suite indefinitely (CI hangs).
4. **Hardcoded test list:** New test files must be manually added to the array;
   deleted files are silently absent.

Note: Codex claimed this produces `0/0` false-green totals; Cursor directly
contradicts this, reporting `1021 passed / 2 failed` in the current environment.
The Codex claim is **incorrect as stated** — but the structural fragility is real
and the fixes below are valid regardless.

**Fix:**
- Check `result.status !== 0` as a failure signal even when regex parsing succeeds.
- Check `result.error` and count spawn failures.
- Add `timeout: 60000` to `spawnSync` options.
- Auto-discover test files via glob; warn if the hardcoded list diverges.

---

### 3.2 Missing test files are silently skipped

**File:** `tests/run-all.js:46-49`
**Confirmed by:** Claude, Cursor

When a test file path does not exist it is skipped with a warning but
`totalFailed` is not incremented. A deleted or renamed test disappears silently.

**Fix:** Treat missing test files as failures (increment `totalFailed`).
Batch with 3.1.

---

### 3.3 Custom test boilerplate duplicated across all test files

**Confirmed by:** Claude, Cursor

Every test file reimplements the same ~25-line `test()` / `asyncTest()` helper
with `passed++/failed++` counters. This is also the root cause of the fragile
stdout-regex parsing in the runner: each file prints its own format.

**Fix:** Extract a shared `tests/helpers/test-runner.js` that standardises output
format and exit code. All test files import it. This simplifies the runner and
eliminates the regex parsing dependency.

---

### 3.4 No tests for `install-ecc.js`

**Confirmed by:** Cursor, Codex

The main installer (374 lines, 3 target platforms, argument parsing, file copying,
JSON merging) has zero test coverage. It is the single most important entry point.

**Fix:** Add `tests/scripts/install-ecc.test.js` covering at minimum:
- Claude/Cursor/Codex install paths (with temp destinations)
- Invalid target handling
- Missing language argument
- Self-copy guard
- JSON merge behaviour
- File exclusion list (see Batch 4, item 4.6)

---

## Batch 4 — DRY & Code Quality

Independent of each other within the batch; can be parallelised.

### 4.1 Five hooks embed complex JavaScript as minified JSON strings

**File:** `hooks/hooks.json:10,20,30,98,108`
**Confirmed by:** all three agents

Affected hooks:
- Block dev servers outside tmux (line 10)
- Reminder to use tmux for long-running commands (line 20)
- Reminder before git push (line 30)
- Log PR URL after `gh pr create` (line 98)
- Example async hook for build analysis (line 108)

Every other hook delegates to an external file in `scripts/hooks/`. The inline
hooks are untestable, unlintable, and unreadable. As a side effect, extracted
scripts can `process.exit(0)` early on Windows to avoid tmux-detection overhead.

**Fix:** Extract each to `scripts/hooks/<name>.js` following the existing pattern.
Update `hooks.json` to call `node "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/<name>.js"`.
Add tests in `tests/hooks/`.

---

### 4.2 Duplicated stdin-reading boilerplate across 7-8 hook scripts

**Confirmed by:** Claude, Cursor

The following files each copy-paste ~12 lines of stdin buffering that is already
available as `readStdinJson()` in `scripts/lib/utils.js:241`:

`doc-file-warning.js`, `post-edit-typecheck.js`, `post-edit-format.js`,
`post-edit-console-warn.js`, `check-console-log.js`, `pre-write-doc-warn.js`,
`session-end.js`, `evaluate-session.js`

**Prerequisite:** Fix 1.5 (`readStdinJson` listener cleanup) before this.

**Fix:** Replace all inline stdin-buffering with `const { readStdinJson } = require('../lib/utils')`.

---

### 4.3 Orphaned `scripts/hooks/suggest-compact.js`

**File:** `scripts/hooks/suggest-compact.js`
**Confirmed by:** all three agents

`hooks/hooks.json:50` points to `skills/strategic-compact/suggest-compact.js`.
`scripts/hooks/suggest-compact.js` is not wired into any hook but has a test
(`tests/hooks/suggest-compact.test.js`). The two implementations have diverged:
the scripts version is 81 lines with shared utilities; the skills version is 48
lines, standalone, with `CURSOR_TRACE_ID` support.

**Fix:** Delete `scripts/hooks/suggest-compact.js` and its test. Keep the skills
version, which is the one actually used. (The scripts version is dead code.)

---

### 4.4 Deprecated `getClaudeDir()` still imported in two active files

**Files:** `scripts/lib/package-manager.js:10`, `scripts/lib/session-aliases.js:9`
**Confirmed by:** all three agents

`utils.js:44-60` marks `getClaudeDir` deprecated and documents `getConfigDir()`
as the replacement. The migration is incomplete and generates deprecation warnings
on every call.

**Fix:** Replace all `getClaudeDir()` imports and calls with `getConfigDir()`.

---

### 4.5 `getSessionIdShort` ignores `CURSOR_TRACE_ID`

**File:** `scripts/lib/utils.js:148`
**Confirmed by:** all three agents

Reads `process.env.CLAUDE_SESSION_ID` directly instead of using
`detectEnv.getSessionId()`, which also checks `CURSOR_TRACE_ID`. Cursor sessions
receive the fallback value instead of their real session ID.

**Fix:** Use `detectEnv.getSessionId()` (already imported via `detect-env.js`).

---

### 4.6 Installer copies dev-only files to the user's `~/.claude/scripts/`

**File:** `scripts/install-ecc.js:187-192`
**Confirmed by:** Claude, Cursor

The recursive copy of `scripts/` includes `release.js`, `setup-package-manager.js`,
`claw.js`, `scripts/ci/`, and `install-ecc.js` itself — none of which are needed
at the installed hook runtime. Only `scripts/hooks/` and `scripts/lib/` are
runtime dependencies. The installer copies itself to the target.

**Fix:** Replace the recursive copy of `scripts/` with two selective copies:
```
scripts/hooks/ → ${claudeBase}/scripts/hooks/
scripts/lib/   → ${claudeBase}/scripts/lib/
```

Add a test in `tests/scripts/install-ecc.test.js` (see 3.4) asserting the
exclusions.

---

### 4.7 `updateAliasTitle` return value does not match stored value

**File:** `scripts/lib/session-aliases.js`
**Confirmed by:** all three agents

Stores `title || null` (coercing empty string to `null`) but returns the original
`title`. A caller passing `""` receives `""` back but `null` is stored —
inconsistent observable state.

**Fix:** Return `data.aliases[alias].title` (the normalised stored value) instead
of `title`.

---

## Batch 5 — CI / Workflow (after Batch 2 is complete)

### 5.1 ESLint currently failing

**Confirmed by:** Cursor **[single-agent]** — Codex could not confirm due to
missing `@eslint/js`; Claude excluded it entirely. Cursor reports 21 errors /
3 warnings across `scripts/`, `skills/continuous-learning*/`, and
`tests/lib/detect-env.test.js`.

**Action:** Run `npx eslint .` after `npm ci` to confirm current state, then fix
all reported errors. Consider making lint a blocking CI step.

---

### 5.2 `validate-skills.js` and `validate-rules.js` are shallow

**Confirmed by:** Codex, Cursor

Both validators only check that files exist and are non-empty. `validate-agents.js`
parses frontmatter and checks required fields. Skills and rules validators do not.

**Fix:** Add structural checks to both:
- Skills: verify at minimum a heading and a "When to Use" section.
- Rules: verify heading and non-empty content.

---

### 5.3 Inconsistent BOM handling across validators

**File:** `scripts/ci/validate-agents.js` strips BOM; no other validator does.
**Confirmed by:** Codex, Cursor

A file with a BOM passes agent validation but could fail other validators.

**Fix:** Extract a shared `readMarkdownFile()` helper with BOM stripping, used by
all CI validators.

---

## Batch 6 — Polish

Low risk. Can be done in any order or in a single PR.

### 6.1 `tdd-guide` agent is missing `Glob`

**File:** `agents/tdd-guide.md:4`
**Confirmed by:** all three agents

Current tools: `["Read", "Write", "Edit", "Bash", "Grep"]`. Every other
write-capable agent includes `Glob` for file discovery.

**Fix:** Add `"Glob"` to the tools list.

---

### 6.2 `plugin.schema.json` only covers 2 of 6 component types

**File:** `schemas/plugin.schema.json`
**Confirmed by:** Claude, Cursor

The schema defines `skills` and `agents` arrays only. The project has six
component types. Missing from the schema: `commands`, `rules`, `hooks`,
`mcp_configs`.

**Fix:** Add the missing array definitions, then validate against actual
`plugin.json`.

---

### 6.3 Stale upstream references in non-documentation files

**Confirmed by:** all three agents

| File | Issue |
|------|-------|
| `skills/configure-ecc/SKILL.md:32` | Clone URL (fixed by 2.1) |
| `.claude-plugin/plugin.json:9-10` | `homepage` and `repository` point to upstream |
| `.claude-plugin/marketplace.json:22-23` | Same |
| `package.json:27-38` | `author`, `repository`, `homepage`, `bugs` reference upstream |

**Fix:** Audit all `affaan-m` references. Update `configure-ecc` clone URL (2.1,
critical). Decide whether `.claude-plugin/` files need updating or are acceptable
as upstream attribution (this fork does not publish to the marketplace). Update
`package.json` fields if this fork is ever published.

---

### 6.4 Unbounded log growth in `pre-compact.js`

**File:** `scripts/hooks/pre-compact.js`
**Confirmed by:** Cursor **[single-agent]**

Appends to `compaction-log.txt` indefinitely with no rotation or size limit.

**Fix:** Add log rotation — e.g. keep last 1000 lines or 100 KB.

---

### 6.5 `hooks.json` tmux regex false positive

**File:** `hooks/hooks.json:20`
**Confirmed by:** Cursor **[single-agent]**

`yarn (install|test)?` — the `?` makes the group optional, so bare `yarn `
commands (not install or test) match.

**Fix:** Remove the `?`: `yarn (install|test)`.

---

### 6.6 Inconsistent agent tool ordering

**Confirmed by:** Cursor **[single-agent]**

Four different tool orderings exist across 18 agents. No standard pattern exists.

**Fix:** Standardise on:
- Read-only agents: `["Read", "Grep", "Glob", "Bash"]`
- Write-capable agents: `["Read", "Write", "Edit", "Bash", "Grep", "Glob"]`

---

### 6.7 `ensureDir` has a redundant `existsSync` check

**File:** `scripts/lib/utils.js:90-94`
**Confirmed by:** Cursor **[single-agent]**

`mkdirSync({ recursive: true })` already handles existing directories. The
preceding `existsSync` check is unnecessary.

**Fix:** Remove the `existsSync` check.

---

## Execution Order Summary

```
Batch 1 (security)     — package-manager.js + session-aliases.js (parallelisable)
Batch 2 (CI + correct) — configure-ecc URL, missing script, llms.txt, heredoc, security gate
Batch 3 (test infra)   — fix runner before relying on it for validation
Batch 4 (DRY)          — fix 1.5 first, then stdin consolidation; rest is parallel
Batch 5 (CI quality)   — lint, shallow validators, BOM
Batch 6 (polish)       — any order, single PR
```

### Parallelisation within batches

- **1.1-1.3** (`package-manager.js`) + **1.4-1.7** (`session-aliases.js`) — independent files
- **3.1-3.2** (runner fixes) + **3.3** (shared helper design — design only) + **3.4** (installer tests)
- **4.1** (extract inline hooks) + **4.3** (delete orphan) + **4.4** (getClaudeDir) + **4.5** (getSessionIdShort) + **4.7** (updateAliasTitle)
- **4.2** (stdin consolidation) — sequential, depends on 1.5 being done
- **6.1** + **6.2** + **6.5** + **6.6** + **6.7** — all touch independent files

---

## Dropped / Disputed Findings

| Claim | Verdict |
|-------|---------|
| Codex: test summary produces `0/0` false-green | **Incorrect.** Cursor confirmed `1021 passed / 2 failed`. The runner is structurally fragile, but the specific `0/0` symptom is not reproducible. |
| Cursor: 15+ tests skip on Windows | Could not be verified without running test suite on Windows. Not included. |
| Cursor: oversized test files (3,692 lines) | Stylistic concern. Included as informational context for 3.3 but not a standalone action item. |
| Cursor: `detect-env.js` factory vs `utils.js` module-load testability gap | True but low priority. Refactoring `utils.js` to match the factory pattern is a large undertaking with limited immediate benefit. |
| Claude: document upstream sync strategy | Process concern, not a code defect. Out of scope. |
| Claude: CONTRIBUTING.md describes upstream workflow | True. Deferred — update after code changes settle. |
| Codex: 21 ESLint errors confirmed | Not independently reproducible (missing `@eslint/js`). Included in Batch 5 as a "confirm and fix" action rather than a verified defect count. |

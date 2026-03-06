# Consolidated Improvement Plan

Verified against the codebase on 2026-03-06. Each item was confirmed by reading the
relevant source files. Unverifiable claims from the three source plans (codex, cursor,
claude) were excluded. Items are grouped by severity.

Source plans consulted: `IMPROVEMENT.codex.md`, `IMPROVEMENT.cursor.md`, `IMPROVEMENT.claude.md`

---

## V1 Direction (Intentional Contract)

- Backward compatibility with legacy passthrough behavior is not a goal for this fork's v1.
- Security-first API contract: `resolveSessionAlias(...)` must return a resolved path or `null`, never raw input passthrough.
- Any caller that wants alias-or-path behavior must implement explicit fallback at the call site.
- In general, helpers that process user-provided identifiers should prefer explicit `null`/error over implicit trust.

---

## Group 1 — Broken / Will Fail in CI or at Install Time

These block correct operation today.

### 1.1 `validate-windows-parity.js` is referenced in CI but does not exist

**Evidence:** `ci.yml:168` runs `node scripts/ci/validate-windows-parity.js`.
The file is absent from `scripts/ci/`. The `reusable-validate.yml` workflow also
omits this step, creating drift between the two.

**Fix options (pick one):**
- Add `scripts/ci/validate-windows-parity.js` that checks Windows-specific parity
  (e.g., confirms `.ps1` counterparts exist for all shell scripts).
- Remove the step from `ci.yml` and document the decision.

**Tooling:** `planner` to decide add-vs-remove, `/tdd` if adding the script.

---

### 1.2 `llms.txt` listed in `package.json` "files" but is absent

**Evidence:** `package.json:77` includes `"llms.txt"` in the `files` array.
No `llms.txt` exists in the repository root (`Glob` returned no results).
`npm pack` will warn or fail; downstream consumers expecting the file will not find it.

**Fix options (pick one):**
- Create `llms.txt` with a machine-readable index of all skills/agents/commands.
- Remove `"llms.txt"` from the `files` array.

**Tooling:** Direct edit to `package.json`; `/verify` after.

---

### 1.3 `configure-ecc` skill clones from upstream, not this fork

**Evidence:** `skills/configure-ecc/SKILL.md:32` runs:
```
git clone https://github.com/affaan-m/everything-claude-code.git /tmp/everything-claude-code
```
Invoking `/configure-ecc` installs the upstream version, discarding all fork-specific
changes (Node-only scripts, hook extractions, etc.).

**Fix:** Change the clone URL to `https://github.com/flatrick/everything-claude-code.git`.

**Tooling:** Direct edit; then `/code-review` to catch any other upstream URLs in the file.

---

## Group 2 — Security

Input-validation bugs in code that constructs shell commands.

### 2.1 `SAFE_NAME_REGEX` permits path traversal

**Evidence:** `scripts/lib/package-manager.js:285`:
```js
const SAFE_NAME_REGEX = /^[@a-zA-Z0-9_./-]+$/;
```
The regex allows `.`, `/`, and `-` individually, so `../../../etc/passwd` passes.
The regex comment says it "prevents shell metacharacter injection" but does not
mention path traversal — the existing tests also document this as a known gap.

**Fix:** Add a post-regex guard before the regex check:
```js
if (/\.\./.test(name) || name.startsWith('/')) throw new Error(...);
```

**Tooling:** `security-reviewer` agent on the diff; `security-review` skill checklist.

---

### 2.2 `SAFE_ARGS_REGEX` permits newline injection

**Evidence:** `scripts/lib/package-manager.js:319`:
```js
const SAFE_ARGS_REGEX = /^[@a-zA-Z0-9\s_./:=,'"*+-]+$/;
```
`\s` matches `\n` and `\r`, enabling multi-line argument injection into constructed
shell commands. The tests document this as a known issue.

**Fix:** Replace `\s` with explicit `[ \t]` (space and tab only).

**Tooling:** Batch with 2.1 (same file, same security review pass).

---

### 2.3 `getExecCommand` accepts truthy non-string `args` without validation

**Evidence:** `scripts/lib/package-manager.js:334`:
```js
if (args && typeof args === 'string' && !SAFE_ARGS_REGEX.test(args)) { ... }
```
When `args` is truthy but not a string (e.g., `{}`, `42`), the guard is skipped.
The value is still concatenated into the returned command string at line 339.

**Fix:** Reject non-string truthy args explicitly:
```js
if (args !== '' && typeof args !== 'string') throw new Error('args must be a string');
```

**Tooling:** Batch with 2.1 and 2.2.

---

### 2.4 `resolveSessionAlias` returns unvalidated user input

**Evidence:** `scripts/lib/session-aliases.js:365-374`: when the input is not a
recognized alias, it is returned unchanged. Callers using the result to build file
paths receive whatever the caller passed in with no sanitization.

**Fix:** Return `null` for unresolved aliases and update all callers to handle `null`,
or validate the returned string against a safe-path pattern before returning it.

**Tooling:** `security-reviewer` + `code-reviewer` (API change affects callers).

---

## Group 3 — Test Infrastructure

### 3.1 `tests/run-all.js` never checks process exit codes

**Evidence:** `tests/run-all.js:53-71`. `spawnSync` is called but `result.status`
is never read. Pass/fail counts are parsed from stdout via regex. If a test file
exits with code 1 but its output does not contain the `Passed:` / `Failed:` regex
pattern, `totalFailed` stays at 0 and the suite exits 0 (false green).

**Fix:** Check `result.status !== 0` as a fallback failure signal even when regex
parsing succeeds; count any non-zero-exit as at least one failure.

**Tooling:** `/tdd` with `tdd-guide` (fix the runner test-first).

---

### 3.2 Missing test files are silently skipped, not counted as failures

**Evidence:** `tests/run-all.js:46-49`. When a test file path does not exist,
it is skipped with a warning. A deleted or renamed test file would silently
disappear from the suite.

**Fix:** Treat missing test files as failures (increment `totalFailed`).

**Tooling:** Batch with 3.1.

---

### 3.3 `spawnSync` has no timeout

**Evidence:** `tests/run-all.js:53`. No `timeout` option is passed. A single
hanging test file blocks the entire suite indefinitely (and would hang CI).

**Fix:** Add `timeout: 60000` (or similar) to the `spawnSync` options.

**Tooling:** Batch with 3.1.

---

### 3.4 Custom test helper reimplemented in every test file

**Evidence:** All 15 test files each define their own `passed`, `failed` counters
and `test()` / `asyncTest()` functions (~25 lines of boilerplate each). This is the
root cause of the fragile stdout-regex parsing in the runner: each file prints its
own format.

**Fix:** Extract a shared `tests/helpers/test-runner.js` that each test file imports.
The helper standardizes output format and exit code, making the runner simpler.

**Tooling:** `architect` to design the API; `/tdd` with `tdd-guide` to implement and migrate.

---

## Group 4 — Code Quality / DRY

### 4.1 Five hooks embed complex JavaScript as minified JSON strings

**Evidence:** `hooks/hooks.json` lines 10, 20, 30, 98, 108 each contain a `node -e`
command with multi-line logic squashed into a single JSON string. All other hooks
delegate to external script files in `scripts/hooks/`. The inline hooks are
untestable, cannot be linted, and are nearly unreadable.

Affected hooks:
- Block dev servers outside tmux (line 10)
- Reminder to use tmux for long-running commands (line 20)
- Reminder before git push (line 30)
- Log PR URL after `gh pr create` (line 98)
- Example async hook for build analysis (line 108)

**Fix:** Extract each to a dedicated file under `scripts/hooks/` following the
pattern of `session-start.js`, `pre-compact.js`, etc. Update `hooks.json` to call
`node "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/<name>.js"`. Add tests in
`tests/hooks/hooks.test.js`. The Windows overhead issue (IMPROVEMENT.claude.md §3.3)
is resolved as a side effect — extracted scripts can `process.exit(0)` early on Windows.

**Tooling:** `/plan` → `planner`; then `/tdd` → `tdd-guide`; then `security-reviewer`
(hooks receive arbitrary tool input).

---

### 4.2 `scripts/hooks/suggest-compact.js` is orphaned from `hooks.json`

**Evidence:** `hooks/hooks.json:50` points to
`skills/strategic-compact/suggest-compact.js`. The file `scripts/hooks/suggest-compact.js`
exists and has a test (`tests/hooks/suggest-compact.test.js`) but is not wired into
any hook. The two implementations have diverged (the scripts version uses
`require('../lib/utils')`; the skills version is standalone).

**Fix:** Delete `scripts/hooks/suggest-compact.js` and its test, or wire it into
`hooks.json` and delete the duplicate in `skills/strategic-compact/`. Pick one
canonical location and remove the other.

**Tooling:** `refactor-cleaner` agent; `/refactor-clean`.

---

### 4.3 Seven hook scripts inline stdin-reading instead of using `readStdinJson`

**Evidence:** The following files each copy-paste ~12 lines of stdin-buffering:
`session-end.js`, `post-edit-typecheck.js`, `post-edit-format.js`,
`check-console-log.js`, `evaluate-session.js`, `post-edit-console-warn.js`,
`doc-file-warning.js`. The shared `readStdinJson()` already exists in
`scripts/lib/utils.js:241` and is exported.

**Fix:** Replace all inline stdin-buffering with `const { readStdinJson } = require('../lib/utils')`.

**Tooling:** `refactor-cleaner`; `/refactor-clean`.

---

### 4.4 `readStdinJson` removes all stdin listeners on timeout, not just its own

**Evidence:** `scripts/lib/utils.js:252-254`:
```js
process.stdin.removeAllListeners('data');
process.stdin.removeAllListeners('end');
process.stdin.removeAllListeners('error');
```
This nukes any other listeners registered on stdin, not just the ones this function
added. In a process with multiple stdin consumers this could silently drop events.

**Fix:** Use named handler references and remove only those specific handlers.

**Tooling:** Direct fix + `code-reviewer`.

---

### 4.5 `getClaudeDir()` is deprecated but still imported in two files

**Evidence:**
- `scripts/lib/package-manager.js:10` imports `getClaudeDir`
- `scripts/lib/session-aliases.js:10` imports `getClaudeDir`

`utils.js:44-60` marks `getClaudeDir` deprecated and documents `getConfigDir()` as
the replacement. The migration is incomplete.

**Fix:** Replace all `getClaudeDir()` calls with `getConfigDir()` in the two files above.

**Tooling:** Direct edit; `/verify` after.

---

### 4.6 `getSessionIdShort` ignores `CURSOR_TRACE_ID`

**Evidence:** `scripts/lib/utils.js:148` reads `process.env.CLAUDE_SESSION_ID`
directly instead of using `detectEnv.getSessionId()`, which also checks
`CURSOR_TRACE_ID`. Cursor sessions get the fallback value instead of the real ID.

**Fix:** Use `detectEnv.getSessionId()` (already imported via `detect-env.js`).

**Tooling:** Direct fix; run tests after.

---

### 4.7 Installer copies dev-only files to the user's `~/.claude/scripts/`

**Evidence:** `scripts/install-ecc.js:187-192` copies the entire `scripts/`
directory tree, including `release.js`, `setup-package-manager.js`, `claw.js`,
and `scripts/ci/` validators — none of which are needed by the installed hook runtime.
Only `scripts/hooks/` and `scripts/lib/` are runtime dependencies.

**Fix:** Replace the recursive copy of `scripts/` with two selective copies:
```
scripts/hooks/ → ${claudeBase}/scripts/hooks/
scripts/lib/   → ${claudeBase}/scripts/lib/
```

**Tooling:** `/tdd` to write a test asserting the exclusions; then direct edit.

---

### 4.8 `tdd-guide` agent is missing `Glob`

**Evidence:** `agents/tdd-guide.md:4`:
```yaml
tools: ["Read", "Write", "Edit", "Bash", "Grep"]
```
Every other write-capable agent includes `Glob` for file discovery. `tdd-guide` needs
`Glob` to discover existing test files and source files.

**Fix:** Add `"Glob"` to the tools list.

**Tooling:** Direct edit.

---

### 4.9 `plugin.schema.json` only covers 2 of 6 component types

**Evidence:** `schemas/plugin.schema.json` defines `skills` and `agents` arrays only.
The project has six component types: agents, skills, commands, rules, hooks, mcp-configs.
Missing from the schema: `commands`, `rules`, `hooks`, `mcp_configs`.

**Fix:** Add the missing array definitions to the schema.

**Tooling:** Direct edit + `code-reviewer` to validate against actual `plugin.json`.

---

## Group 5 — CI / Workflow

### 5.1 Security CI job has `continue-on-error: true`

**Evidence:** `ci.yml:199`:
```yaml
run: npm audit --audit-level=high
continue-on-error: true  # Allows PR to proceed...
```
The job is named "Security Scan" but never blocks a PR. PRs with high-severity
vulnerabilities can merge.

**Fix options (pick one):**
- Remove `continue-on-error: true` to make it blocking.
- Rename the job to `security-info` and add a comment that it is advisory only.

**Tooling:** Direct edit to `ci.yml`.

---

### 5.2 `reusable-validate.yml` is out of sync with `ci.yml`

**Evidence:** `ci.yml:167-169` has a `Validate windows parity` step that calls
`validate-windows-parity.js`. `reusable-validate.yml` does not have this step.
The two workflows have drifted. (Note: the script itself also does not exist — see 1.1.)

**Fix:** Once 1.1 is resolved (script added or step removed), apply the same change
to `reusable-validate.yml` to keep them in sync.

**Tooling:** Direct edit; resolved as part of 1.1.

---

### 5.3 `release.yml` uses a static heredoc delimiter

**Evidence:** `release.yml:49`:
```yaml
echo "commits<<EOF" >> $GITHUB_OUTPUT
```
If any commit message contains the literal string `EOF` on its own line, the GitHub
Actions output is truncated at that point. This is the standard GitHub Actions
multiline output pattern but the static delimiter is fragile.

**Fix:** Use a randomised delimiter, e.g.:
```yaml
DELIM="COMMITS_$(date +%s%N)"
echo "commits<<$DELIM" >> $GITHUB_OUTPUT
echo "$COMMITS" >> $GITHUB_OUTPUT
echo "$DELIM" >> $GITHUB_OUTPUT
```

**Tooling:** Direct edit.

---

## Group 6 — Minor Bugs

### 6.1 `session-aliases.js` accepts arrays as alias maps

**Evidence:** `scripts/lib/session-aliases.js:58`:
```js
if (!data.aliases || typeof data.aliases !== 'object') { ... }
```
`typeof [] === 'object'` is `true`, so a corrupt aliases file with an array at the
`aliases` key passes this guard silently.

**Fix:** Add `|| Array.isArray(data.aliases)` to the guard.

**Tooling:** Direct fix + existing tests.

---

### 6.2 `updateAliasTitle` return value does not match stored value

**Evidence:** `scripts/lib/session-aliases.js:393` stores `title || null`
(empty string becomes `null`), but line 400 returns the original `title`.
A caller passing `""` receives `""` back but `null` is stored.

**Fix:** Return `data.aliases[alias].title` (the stored value) instead of `title`.

**Tooling:** Direct fix.

---

## Group 7 — Documentation

### 7.1 Stale upstream URLs in non-documentation files

**Evidence:**
- `skills/configure-ecc/SKILL.md:32` — clone URL (fixed by 1.3)
- `.claude-plugin/plugin.json:9-10` — `homepage` and `repository` point to upstream
- `.claude-plugin/marketplace.json:22-23` — same

The `package.json` `author`, `repository`, `homepage`, and `bugs` fields (lines 27-38)
also still reference the upstream. These matter if this fork is ever published.

**Fix:** Decide scope — update all to `flatrick/everything-claude-code`, or leave
`.claude-plugin/` as upstream attribution and only fix `package.json` and the clone URL.

**Tooling:** `refactor-cleaner` to audit all `affaan-m` references; direct edits.

---

### 7.2 `CONTRIBUTING.md` describes contributing to upstream, not this fork

**Evidence:** `CONTRIBUTING.md` instructs readers to fork `affaan-m/everything-claude-code`
and submit PRs there. This is misleading for a personal fork that does not accept
community contributions in the same way.

**Fix:** Update to clarify this is a personal fork, redirect contributors to upstream,
and describe the actual upstream-sync workflow.

**Tooling:** `doc-updater` agent; `/update-docs`.

---

## Execution Order

1. **Group 1 first** (1.1, 1.2, 1.3) — restores CI correctness and ensures
   `configure-ecc` installs from this fork.
2. **Group 2 in parallel** (2.1-2.3 together in `package-manager.js`; 2.4 separately).
3. **Group 3** (3.1-3.4) — fix the test runner before relying on it to validate
   anything else.
4. **Group 4** (4.1 is highest priority; 4.2-4.9 can be parallelised).
5. **Group 5** (CI fixes; do after 1.1 is resolved).
6. **Groups 6 and 7** — polish; batch into a single PR.

## Parallelisation Opportunities

The following sets of items touch independent files and can be worked simultaneously:

- **2.1-2.3** (`package-manager.js` security) + **2.4** (`session-aliases.js` security)
- **3.1-3.3** (runner fixes) + **3.4** (shared test helper design)
- **4.3** (stdin dedup) + **4.5** (getClaudeDir migration) + **4.6** (getSessionIdShort)
- **4.8** (tdd-guide Glob) + **4.9** (schema) + **6.1-6.2** (alias bugs)
- **7.1** + **7.2** (documentation)

## Items Excluded (Not Verified or Disputed)

The following items appeared in the source plans but were excluded from this plan:

| Claim | Reason excluded |
|-------|----------------|
| codex: 21 ESLint errors | Could not run linter to confirm current state |
| codex: test totals show 0/0 | Partially confirmed (runner doesn't check exit codes) but exact 0/0 claim depends on runtime behaviour |
| cursor: tests modify real config files | Plausible but requires running tests to confirm |
| cursor: 15+ tests skip on Windows | Requires running test suite on Windows to enumerate |
| cursor: oversized test files (3600+ lines) | Stylistic concern; no functional impact confirmed |
| cursor: inconsistent agent tool ordering | Stylistic; no functional impact |
| cursor: inconsistent agent body structure | Stylistic; no functional impact |
| cursor: em-dash consistency | Cosmetic only |
| cursor: unbounded log growth in pre-compact.js | Low severity; no confirmed data loss |
| claude: add --list/--dry-run to installer | Good UX improvement but not a defect |
| claude: document upstream sync strategy | Good practice but not a defect |

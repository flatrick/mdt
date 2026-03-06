# Verified Improvement Backlog

Date: 2026-03-06
Scope: Consolidated review of `IMPROVEMENT.codex.md`, `IMPROVEMENT.cursor.md`, and `IMPROVEMENT.claude.md`.

This document includes only findings I verified directly in this worktree.

## V1 Direction (Intentional Contract)

- Backward compatibility with legacy passthrough behavior is not a goal for this fork's v1.
- Security-first API contract: `resolveSessionAlias(...)` must return a resolved path or `null`, never raw input passthrough.
- Any caller that wants alias-or-path behavior must implement explicit fallback at the call site.
- In general, helpers that process user-provided identifiers should prefer explicit `null`/error over implicit trust.

## P0 - Fix quality gate integrity first

1. Test runner can report false-green totals (`0 passed / 0 failed`) even when suites run.
- Evidence: `npm run -s test` currently prints all suite headers, then `Total Tests: 0`.
- Evidence: [`tests/run-all.js`](C:/src/github/flatrick/codex/tests/run-all.js) aggregates by regexing `Passed:`/`Failed:` text and does not fail on missing parse data.
- Improvement: Make per-suite exit status authoritative, fail on spawn errors, add timeout, and reject `0/0` when suites executed.

2. No dependency-bootstrap/preflight gate before lint/test commands.
- Evidence: `npm run -s lint` initially failed immediately with `Cannot find module '@eslint/js'` from [`eslint.config.js`](C:/src/github/flatrick/codex/eslint.config.js) until `npm ci` was run.
- Evidence: There is no preflight script that verifies/install deps before running project quality commands.
- Improvement: Add a standard bootstrap contract (for example `npm run bootstrap` -> `npm ci`) and a preflight check in `lint`/`test` wrappers that fails fast with an explicit “run npm ci” message when dependencies are missing.

3. CI references a missing script.
- Evidence: [`ci.yml`](C:/src/github/flatrick/codex/.github/workflows/ci.yml) runs `node scripts/ci/validate-windows-parity.js`.
- Evidence: `scripts/ci/validate-windows-parity.js` does not exist.
- Improvement: Add the script (with tests) or remove/replace the step.

4. Release workflow uses static heredoc delimiter.
- Evidence: [`release.yml`](C:/src/github/flatrick/codex/.github/workflows/release.yml) writes `commits<<EOF`.
- Evidence: [`reusable-release.yml`](C:/src/github/flatrick/codex/.github/workflows/reusable-release.yml) already uses a dynamic delimiter.
- Improvement: Use dynamic delimiter in `release.yml` to avoid truncation risk.

5. Packaging manifest references a missing file.
- Evidence: [`package.json`](C:/src/github/flatrick/codex/package.json) includes `llms.txt` in `files`.
- Evidence: `llms.txt` is missing in repo root.
- Improvement: Add `llms.txt` or remove it from `files`; add a prepack existence check.

## P1 - Security and correctness

1. Command validation allows traversal/newline and type-bypass cases.
- Evidence: [`scripts/lib/package-manager.js`](C:/src/github/flatrick/codex/scripts/lib/package-manager.js) `SAFE_NAME_REGEX` allows `.` and `/`, `SAFE_ARGS_REGEX` uses `\s`, and `getExecCommand()` only validates args when `typeof args === 'string'`.
- Evidence: [`tests/lib/package-manager.test.js`](C:/src/github/flatrick/codex/tests/lib/package-manager.test.js) includes tests showing `../../../...`, newline args, and object args pass.
- Improvement: Block `..`/absolute prefixes, replace `\s` with `[ \t]`, and reject non-string truthy args.

2. Alias resolution can return unvalidated input as a path.
- Evidence: [`scripts/lib/session-aliases.js`](C:/src/github/flatrick/codex/scripts/lib/session-aliases.js) `resolveSessionAlias()` returns `aliasOrId` unchanged on miss.
- Improvement: Return `null` on unresolved alias (or validate path-safe format before passthrough).

3. Tests mutate real repo config files.
- Evidence: [`tests/hooks/evaluate-session.test.js`](C:/src/github/flatrick/codex/tests/hooks/evaluate-session.test.js) writes invalid JSON into `skills/continuous-learning/config.json` and restores later.
- Improvement: Use isolated temp config path for these cases; never edit tracked repo config in tests.

4. `updateAliasTitle` returns value inconsistent with stored value.
- Evidence: [`scripts/lib/session-aliases.js`](C:/src/github/flatrick/codex/scripts/lib/session-aliases.js) stores `title || null` but returns raw `title`.
- Improvement: Return the normalized stored value.

5. `listAliases` can throw on non-string search input.
- Evidence: [`scripts/lib/session-aliases.js`](C:/src/github/flatrick/codex/scripts/lib/session-aliases.js) calls `search.toLowerCase()` without type guard.
- Improvement: Enforce `typeof search === 'string'` before filtering.

## P1 - Maintainability and drift reduction

1. Hook configuration contains large inline `node -e` scripts.
- Evidence: [`hooks/hooks.json`](C:/src/github/flatrick/codex/hooks/hooks.json) contains multiple long inline JS hook commands.
- Improvement: Extract to `scripts/hooks/*.js` for readability, testability, and lintability.

2. `suggest-compact` has two implementations with drift.
- Evidence: both [`scripts/hooks/suggest-compact.js`](C:/src/github/flatrick/codex/scripts/hooks/suggest-compact.js) and [`skills/strategic-compact/suggest-compact.js`](C:/src/github/flatrick/codex/skills/strategic-compact/suggest-compact.js) exist.
- Evidence: `hooks/hooks.json` uses the skill version, while many tests target the scripts version.
- Improvement: Choose one canonical implementation and align hook wiring/tests to it.

3. Deprecated `getClaudeDir()` is still imported in active modules.
- Evidence: [`scripts/lib/package-manager.js`](C:/src/github/flatrick/codex/scripts/lib/package-manager.js) and [`scripts/lib/session-aliases.js`](C:/src/github/flatrick/codex/scripts/lib/session-aliases.js) import/use `getClaudeDir()`.
- Improvement: Migrate callers to `getConfigDir()` directly.

4. Session ID helper bypasses central environment detection.
- Evidence: [`scripts/lib/utils.js`](C:/src/github/flatrick/codex/scripts/lib/utils.js) `getSessionIdShort()` reads only `CLAUDE_SESSION_ID`.
- Evidence: [`scripts/lib/detect-env.js`](C:/src/github/flatrick/codex/scripts/lib/detect-env.js) already resolves `CLAUDE_SESSION_ID` and `CURSOR_TRACE_ID`.
- Improvement: Reuse `detectEnv.getSessionId()`.

5. `readStdinJson()` removes all stdin listeners.
- Evidence: [`scripts/lib/utils.js`](C:/src/github/flatrick/codex/scripts/lib/utils.js) uses `removeAllListeners('data'|'end'|'error')` on timeout.
- Improvement: Track handler refs and remove only listeners registered by this function.

6. CI security scan is advisory despite job semantics.
- Evidence: [`ci.yml`](C:/src/github/flatrick/codex/.github/workflows/ci.yml) has `npm audit --audit-level=high` with `continue-on-error: true`.
- Improvement: Either enforce blocking or rename/document as advisory.

## P2 - Validation and consistency

1. Skill and rule validators are shallow.
- Evidence: [`validate-skills.js`](C:/src/github/flatrick/codex/scripts/ci/validate-skills.js) and [`validate-rules.js`](C:/src/github/flatrick/codex/scripts/ci/validate-rules.js) mostly check existence/non-empty.
- Improvement: Add structural checks aligned with documented expectations.

2. BOM handling is inconsistent across validators.
- Evidence: [`validate-agents.js`](C:/src/github/flatrick/codex/scripts/ci/validate-agents.js) strips BOM; other validators do not.
- Improvement: Centralize file read normalization.

3. `tdd-guide` agent is missing `Glob`.
- Evidence: [`agents/tdd-guide.md`](C:/src/github/flatrick/codex/agents/tdd-guide.md) tools list excludes `Glob` unlike most write-capable agents.
- Improvement: Add `Glob` for consistent discovery capability.

4. Installer test coverage gap for main installer.
- Evidence: no `tests/scripts/install-ecc.test.js` exists; installer logic is concentrated in [`scripts/install-ecc.js`](C:/src/github/flatrick/codex/scripts/install-ecc.js).
- Improvement: Add dedicated installer tests (targets, argument parsing, copy behavior, settings merge).

5. Fork identity drift in installer skill and plugin metadata.
- Evidence: [`skills/configure-ecc/SKILL.md`](C:/src/github/flatrick/codex/skills/configure-ecc/SKILL.md) clones upstream `affaan-m/everything-claude-code`.
- Evidence: [`.claude-plugin/plugin.json`](C:/src/github/flatrick/codex/.claude-plugin/plugin.json) and [`.claude-plugin/marketplace.json`](C:/src/github/flatrick/codex/.claude-plugin/marketplace.json) point to upstream URLs.
- Improvement: If this fork is intended as primary install source, update clone/repo URLs; otherwise document intentional upstream linkage.

## Not included (not verifiable as-stated)

- Specific lint error counts from prior audit (`21 errors, 3 warnings`) were not reproducible in this environment because `npm run -s lint` fails earlier due missing local dev dependencies (`Cannot find module '@eslint/js'`).

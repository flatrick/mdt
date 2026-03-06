# Improvement Plan (Codex v3)

Date: 2026-03-06
Repo: `flatrick/everything-claude-code` (Node-only fork)

This v3 plan consolidates the three v2 reviews into one implementation-ready backlog.
It prioritizes verified defects first, separates speculative work, and defines PR-sized
execution slices with acceptance criteria.

## Scope and Method

- Source inputs: `IMPROVEMENT.codex.v2.md`, `IMPROVEMENT.claude.v2.md`, `IMPROVEMENT.cursor.v2.md`.
- Priority rule:
  1. Verified breakage/security issues
  2. Quality gate reliability
  3. Maintainability and drift reduction
  4. Docs/process polish
- Confidence rule:
  - Items with direct file evidence are in scope.
  - Previously disputed or environment-dependent claims are marked as "re-verify before fix".

## V1 Direction (Intentional Contract)

- Backward compatibility with legacy passthrough behavior is not a goal for this fork's v1.
- Security-first API contract: `resolveSessionAlias(...)` must return a resolved path or `null`, never raw input passthrough.
- Any caller that wants alias-or-path behavior must implement explicit fallback at the call site.
- In general, helpers that process user-provided identifiers should prefer explicit `null`/error over implicit trust.

## Status Snapshot (Already Completed)

- Removed missing CI step `validate-windows-parity.js` from `.github/workflows/ci.yml`.
- Removed missing `llms.txt` from `package.json` `files`.
- Updated `skills/configure-ecc/SKILL.md` to clone this fork.
- Added dependency preflight gate: `scripts/ci/check-dependencies.js` + tests, wired into `lint` and `test` scripts.
- Hardened `scripts/lib/package-manager.js` (`SAFE_NAME_REGEX`, newline-safe args, non-string args rejection) and updated tests.
- Enforced v1 alias contract: `resolveSessionAlias(...)` returns `string | null` (no passthrough), plus type updates/tests.
- Refactored `readStdinJson` to remove only owned listeners; added `parseJsonObject` and updated tests.
- Converted key hook/CI scripts to importable/testable modules and updated tests to reduce subprocess dependence.
- Added subprocess capability guard + strict mode (`ECC_REQUIRE_SUBPROCESS_TESTS=1`) and enabled strict mode in CI test step.
- Replaced inline `node -e` command hooks in `hooks/hooks.json` with script-backed Node commands via `scripts/hooks/command-hooks.js`, and updated integration hook command execution tests to support both inline and script forms.
- Consolidated `suggest-compact` behavior to shared `scripts/hooks/suggest-compact.js`; `skills/strategic-compact/suggest-compact.js` is now a thin wrapper entrypoint using shared logic.
- Installer now copies runtime scripts only (`scripts/hooks` + `scripts/lib`) for Claude/Cursor installs, and dedicated installer regression tests were added in `tests/scripts/install-ecc.test.js` (wired into `tests/run-all.js`).
- CI security scan is now intentionally blocking (`continue-on-error: false` for `npm audit --audit-level=high`), and release changelog output uses a dynamic heredoc delimiter to avoid truncation collisions.
- Added shared markdown normalization helper (`scripts/ci/markdown-utils.js`) and upgraded validator depth: `validate-skills.js` now enforces heading + "When to Use/Activate", and `validate-rules.js` now enforces heading + body content; validator tests and affected skills were updated accordingly.
- Removed unused reusable workflow files (`reusable-test.yml`, `reusable-validate.yml`, `reusable-release.yml`) to make inline workflows (`ci.yml`, `release.yml`) canonical and prevent future drift.
- Introduced shared test harness helpers in `tests/helpers/test-runner.js` and migrated multiple script-focused suites to use it (`check-dependencies`, `setup-package-manager`, `install-ecc`, `powershell-scripts`, `claw`).
- Split oversized CI validator suite by concern into core and rounds files: `tests/ci/validators.test.js` (core) + `tests/ci/validators-rounds.test.js` (edge/rounds), and wired both in `tests/run-all.js`.
- Split `tests/lib/session-manager.test.js` into core + rounds suites (`session-manager.test.js`, `session-manager-rounds.test.js`) and wired both into `tests/run-all.js` with isolated seeded-session fixture setup for moved round cases.
- Split `tests/hooks/hooks.test.js` into core + rounds suites (`hooks.test.js`, `hooks-rounds.test.js`) and wired both into `tests/run-all.js`.
- Split `tests/lib/session-aliases.test.js` into core + rounds suites (`session-aliases.test.js`, `session-aliases-rounds.test.js`) and wired both into `tests/run-all.js`.
- Split `tests/lib/utils.test.js` into core + rounds suites (`utils.test.js`, `utils-rounds.test.js`) and wired both into `tests/run-all.js`.
- Split `tests/lib/package-manager.test.js` into core + rounds suites (`package-manager.test.js`, `package-manager-rounds.test.js`) and wired both into `tests/run-all.js`.
- Further split oversized hook rounds coverage by adding `tests/hooks/hooks-rounds-2.test.js`, and wired both hooks rounds suites into `tests/run-all.js`.
- Split `tests/hooks/hooks.test.js` by concern by extracting post-edit hook coverage into `tests/hooks/hooks-post-edit.test.js`, and wired it into `tests/run-all.js`.
- Further split oversized session-manager rounds coverage by adding `tests/lib/session-manager-rounds-2.test.js`, and wired both session-manager rounds suites into `tests/run-all.js`.
- Further split oversized validator rounds coverage by adding `tests/ci/validators-rounds-2.test.js`, and wired both validator rounds suites into `tests/run-all.js`.

## P0 - Breakage and Install/CI Integrity

1. CI references a missing script.
- Evidence: `.github/workflows/ci.yml` calls `scripts/ci/validate-windows-parity.js` that does not exist.
- Action: either add the script with tests, or remove the step from all affected workflows.

2. Packaging manifest references missing `llms.txt`.
- Evidence: `package.json` includes `llms.txt` in `files`, but file is absent.
- Action: add `llms.txt` or remove it from `files`; add a prepack existence check.

3. `configure-ecc` installs from upstream instead of this fork.
- Evidence: `skills/configure-ecc/SKILL.md` clones `affaan-m/everything-claude-code`.
- Action: change clone URL to `flatrick/everything-claude-code`.

4. Test orchestrator reliability gaps in `tests/run-all.js`.
- Evidence: no robust handling for spawn errors, missing files are skipped, no timeout, regex-only aggregation.
- Action: make process exit status authoritative, fail missing suites, add timeout, keep parsing as supplemental.

Acceptance criteria:
- CI has no references to nonexistent scripts.
- `npm pack --dry-run` succeeds without missing-file warnings.
- `/configure-ecc` workflow points to this fork.
- `npm run -s test` fails on spawn/missing/timeout failures deterministically.

## P1 - Security and Correctness

1. Command construction validation gaps in `scripts/lib/package-manager.js`.
- `SAFE_NAME_REGEX` allows traversal-like values.
- `SAFE_ARGS_REGEX` uses `\s` (permits newline injection).
- `getExecCommand` accepts truthy non-string args without strict validation.
- Action: harden validators and reject non-string args explicitly.

2. Alias passthrough risk in `scripts/lib/session-aliases.js`.
- Evidence: unresolved alias may be returned unchanged.
- Action: return `null` for unresolved aliases (or strict path-safe validation) and update callers.

3. Minor alias correctness bugs.
- `updateAliasTitle` return value can differ from stored value.
- `listAliases` may throw on non-string search.
- `loadAliases` should reject array-shaped alias maps.
- Action: normalize return and input validation behavior.

4. `readStdinJson` listener cleanup safety.
- Evidence: timeout path removes all stdin listeners, not only local handlers.
- Action: remove only function-owned listeners.

5. Session ID detection drift.
- Evidence: `getSessionIdShort` should use central detect-env logic (`CLAUDE_SESSION_ID` + `CURSOR_TRACE_ID`).
- Action: switch to shared resolver.

Acceptance criteria:
- New and existing tests cover traversal/newline/non-string argument cases.
- Alias APIs are type-safe and deterministic.
- No broad `removeAllListeners` usage in shared stdin helper timeout path.

## P1 - Quality Gates and Validation

1. Security job semantics mismatch.
- Evidence: `npm audit` step uses `continue-on-error: true`.
- Action: either enforce blocking or rename/document as advisory.

2. Validator depth and normalization consistency.
- Evidence: `validate-skills.js` and `validate-rules.js` are shallow; BOM handling is inconsistent across validators.
- Action: add structural checks and shared file-read normalization.

3. Reusable workflow drift.
- Evidence: workflow variants are out of sync.
- Action: standardize on reusable or inline pattern, then remove drift.

4. Lint-state claim needs controlled re-verification.
- Note: prior counts were environment-dependent.
- Action: after `npm ci`, record current lint baseline and treat as separate fix PR if non-zero.

Acceptance criteria:
- CI security behavior is explicit and intentional.
- Validator failures are actionable and structurally meaningful.
- Workflow duplication does not diverge.

## P2 - Maintainability and DRY

1. Inline `node -e` hook logic in `hooks/hooks.json`.
- Action: extract each complex inline hook into `scripts/hooks/*.js`, wire from JSON.

2. Duplicate `suggest-compact` implementations.
- Action: choose one canonical implementation and remove the other plus stale tests/wiring.

3. Repeated stdin parsing in hook scripts.
- Action: migrate scripts to shared `readStdinJson`.

4. Deprecated config-dir API usage.
- Action: migrate `getClaudeDir()` call sites to `getConfigDir()`.

5. Installer payload hygiene.
- Evidence: installer copies full `scripts/`, including dev-only files.
- Action: copy only runtime-required paths (`scripts/hooks`, `scripts/lib`) or explicit allowlist.

6. Schema completeness.
- Evidence: `plugin.schema.json` does not fully model active component families.
- Action: extend schema for all supported component sections used by this fork.

Acceptance criteria:
- Hook logic is lintable/testable in files, not opaque JSON strings.
- Dead/duplicate implementations are removed.
- Installed payload contains only runtime dependencies.

## P3 - Test Architecture and Coverage

1. Installer tests missing.
- Action: add dedicated tests for `scripts/install-ecc.js` covering target selection, merge behavior, and copy scope.

2. Shared test helper extraction.
- Action: move duplicated local test harness logic into `tests/helpers/test-runner.js`.

3. Oversized test files refactor.
- Action: split largest suites by concern without behavior loss.

4. Optional: test discovery evolution.
- Action: evaluate auto-discovery once runner reliability fixes are complete.

Acceptance criteria:
- Installer has direct regression coverage.
- Test harness format is consistent.
- Large suites are decomposed with identical pass/fail behavior.

## Deferred / Out-of-Scope for Initial Execution

1. Purely stylistic agent formatting consistency.
2. Broad documentation rewrites not tied to code changes.
3. New installer UX flags (`--list`, `--dry-run`) until core correctness items land.
4. Any claim not reproducible after dependency bootstrap and current baseline capture.

## Execution Plan (PR Slices)

PR 1: `fix: restore install and CI gate integrity`
- Fix missing CI script reference decision.
- Resolve `llms.txt` packaging mismatch.
- Update `configure-ecc` clone URL.
- Harden `tests/run-all.js` (spawn/missing/timeout/exit-status logic).

PR 2: `fix: harden command and alias validation`
- Patch `package-manager.js` validation issues.
- Patch `session-aliases.js` unresolved alias and minor correctness bugs.
- Add/adjust tests for all touched validation branches.

PR 3: `refactor: normalize hooks and shared stdin handling`
- Extract inline hook JS to script files.
- Consolidate stdin parsing via shared helper.
- Fix `readStdinJson` listener ownership cleanup.
- Resolve duplicate `suggest-compact` implementation.

PR 4: `refactor: tighten installer/runtime boundaries and schemas`
- Restrict installer copy scope to runtime files.
- Add installer regression tests.
- Complete schema coverage for active plugin component groups.
- Migrate deprecated `getClaudeDir` usage.

PR 5: `chore: align CI semantics and validator depth`
- Resolve security scan advisory vs blocking semantics.
- Add structural checks for skills/rules validators.
- Unify BOM/file-read normalization.
- Eliminate workflow drift between reusable and primary files.

## Verification Loop Per PR

Run after each PR:
1. `npm ci`
2. `npm run -s lint`
3. `npm run -s test`
4. `npm pack --dry-run`

For security-related PRs, add:
5. targeted negative tests for traversal/newline/type-bypass inputs

For hook-related PRs, add:
6. hook-script tests for stdin handling and platform guard behavior

## Risk Notes

- Test-runner hardening may surface previously masked failures.
- Hook extraction changes behavior boundaries; keep one-for-one parity tests.
- Alias API tightening may require small caller adaptations.

## Success Criteria

- No known CI/install-time breakage.
- Security-sensitive command-building paths enforce strict input handling.
- Quality gates are reliable and intentionally configured.
- Hook and test infrastructure are maintainable and regression-resistant.

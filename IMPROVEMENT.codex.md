# Improvement Plan (Codex Audit)

Date: 2026-03-05
Repo: `everything-claude-code`

## Executive summary

Yes, there are high-impact changes worth making now. The biggest issue is **signal integrity in CI and local validation**: lint fails, test aggregation can report false success, and one CI step references a missing script.

## Findings (evidence-driven)

1. Lint is currently failing.
- `npm run -s lint` reports 21 errors and 3 warnings (unused vars, `no-empty`, `eqeqeq`) across `scripts/`, `skills/continuous-learning*`, and `tests/lib/detect-env.test.js`.

2. Test summary can produce false-green output.
- `npm run -s test` prints all suite headers but final totals are `0` passed / `0` failed.
- `tests/run-all.js` does not handle child-process spawn errors, and relies on fragile text parsing.

3. CI references a missing validator script.
- `.github/workflows/ci.yml` runs `node scripts/ci/validate-windows-parity.js`.
- `scripts/ci/validate-windows-parity.js` is not present.

4. Packaging manifest appears inconsistent.
- `package.json` includes `llms.txt` in `"files"`, but `llms.txt` is missing in repo root.

5. Test suite maintainability risk.
- `tests/lib/utils.test.js` is very large (2k+ lines) and mixes many unrelated edge cases in one file, making failures harder to triage.

6. Validator warnings are noisy.
- Command validation reports warnings for references to `skills/learned/` not present locally, which reduces signal quality.

## Prioritized plan

## Phase 1: Restore trust in quality gates (P0)

1. Fix all current ESLint errors in tracked code and tests.
2. Update `tests/run-all.js` to:
- Fail immediately on child-process spawn errors.
- Track per-file pass/fail based on process exit code.
- Keep optional parsing for counts, but never allow `0/0` false-green when tests ran.
3. Resolve CI missing script mismatch:
- Either add `scripts/ci/validate-windows-parity.js` with tests, or remove that step from `.github/workflows/ci.yml`.

Acceptance criteria:
- `npm run -s lint` exits 0.
- `npm run -s test` reports non-zero total test count and fails if any suite fails to execute.
- CI workflow does not reference nonexistent scripts.

## Phase 2: Harden packaging and release path (P1)

1. Fix `package.json` `"files"` list consistency:
- Add missing `llms.txt` if intended, or remove it from `"files"`.
2. Add a `prepack` verification script:
- Check all entries in `"files"` exist.
- Fail with clear error messages.

Acceptance criteria:
- Packaging manifest has no missing-file references.
- `npm pack --dry-run` succeeds in CI environment.

## Phase 3: Improve test architecture and coverage policy (P1)

1. Split `tests/lib/utils.test.js` into focused suites (filesystem, process, regex/text, path/env).
2. Standardize test result output contract (single helper) so `run-all` does not parse ad hoc formats.
3. Add real coverage enforcement (`c8`/`nyc`) with threshold target (>=80%) and wire into CI.

Acceptance criteria:
- Large monolithic test file is decomposed.
- Coverage report is generated in CI and enforces threshold.
- Test output format is consistent across all suites.

## Phase 4: Reduce warning noise and clarify intent (P2)

1. Decide policy for learned skills references in commands:
- If optional by design, downgrade/annotate warnings to avoid duplicates.
- If required, create expected path/docs scaffolding.
2. Add a brief “quality gates” section in `CONTRIBUTING.md`:
- lint, validate scripts, tests, coverage, and expected local commands.

Acceptance criteria:
- Command validation warnings are intentional and documented.
- Contributor workflow is explicit and reproducible.

## Implementation order

1. Phase 1 (mandatory before feature work)
2. Phase 2 and Phase 3 in parallel
3. Phase 4 cleanup

## Risk notes

- Changing test orchestration may initially reveal hidden failures that were previously masked.
- Splitting tests should preserve behavior; do this with small commits and frequent runs.

## Suggested first PR scope

`fix: restore CI/test gate integrity`
- Fix current ESLint errors.
- Patch `tests/run-all.js` failure handling and reporting.
- Resolve missing `validate-windows-parity.js` reference.
- Align `package.json` `"files"` with actual repo contents.

## Recommended ECC arsenal by issue

1. Lint failures and code hygiene drift
- Sub-agents: `build-error-resolver`, `code-reviewer`
- Skills: `coding-standards`, `verification-loop`
- Commands: `/build-fix`, `/code-review`, `/verify`
- Why: quickly clear ESLint debt, then enforce style/regression checks.

2. False-green test aggregation in `tests/run-all.js`
- Sub-agents: `tdd-guide`, `code-reviewer`
- Skills: `tdd-workflow`, `verification-loop`
- Commands: `/tdd`, `/test-coverage`, `/code-review`
- Why: implement runner fix test-first, then verify behavior on failing/spawn-error cases.

3. Missing CI validator script reference
- Sub-agents: `planner`, `build-error-resolver`, `doc-updater`
- Skills: `eval-harness`, `coding-standards`
- Commands: `/plan`, `/build-fix`, `/update-docs`
- Why: decide add-vs-remove strategy, apply minimal fix, and document CI contract.

4. Packaging manifest inconsistency (`llms.txt` listed but absent)
- Sub-agents: `planner`, `code-reviewer`
- Skills: `verification-loop`
- Commands: `/plan`, `/verify`
- Why: treat as release-integrity issue; add guardrails (`prepack` checks) and review publish path.

5. Monolithic `tests/lib/utils.test.js` maintainability risk
- Sub-agents: `planner`, `tdd-guide`, `refactor-cleaner`, `code-reviewer`
- Skills: `tdd-workflow`, `coding-standards`
- Commands: `/plan`, `/tdd`, `/refactor-clean`, `/code-review`
- Why: split safely in phases with parity checks and no behavior loss.

6. Warning noise from optional learned-skill references
- Sub-agents: `planner`, `doc-updater`, `code-reviewer`
- Skills: `verification-loop`
- Commands: `/plan`, `/update-docs`, `/verify`
- Why: define policy (optional vs required), adjust validator severity/message, and document expected behavior.

## Suggested execution sequence (agents + skills)

1. `/plan` with `planner` to break Phase 1 into concrete tasks.
2. `/tdd` with `tdd-guide` for `tests/run-all.js` and CI mismatch fixes.
3. `/build-fix` with `build-error-resolver` to clear all lint errors.
4. `/code-review` with `code-reviewer` on the full Phase 1 diff.
5. `/verify` (verification-loop) before merge; then `/update-docs` with `doc-updater`.

## Security-specific note

None of the current findings are critical auth/secret vulnerabilities, but for any hook/script changes that execute shell commands, run a targeted pass with:
- Sub-agent: `security-reviewer`
- Skill: `security-review`
- Command: `/security-scan`

# Next Steps

## Current Direction

- This fork is primarily for personal daily use, with possible reuse by friends and coworkers.
- Upstream ECC is reference material, not an active sync source.
- v1 remains stabilization work: keep docs honest, verify real workflows, and avoid guesswork across tools.
- The intended destination stays in [docs/V1-TARGET-STATE.md](docs/V1-TARGET-STATE.md).
- The current install/package contract now lives in [docs/package-manifest-schema.md](docs/package-manifest-schema.md).
- Cross-tool parity analysis stays in [docs/functional-parity-plan.md](docs/functional-parity-plan.md).
- Until a commit is tagged `v1.0.0`, install layout and package composition are allowed to change.
- Before `v1.0.0`, assume fresh installs rather than in-place migration: rerun `node scripts/install-mdt.js`.

Recent completed milestone archive:

- [2026-03-11 global-install stabilization](docs/history/2026-03-11.global-install-stabilization.md)
- [2026-03-12 continuous-learning runtime extraction](docs/history/2026-03-12.continuous-learning-runtime-extraction.md)
- [2026-03-12 roadmap rebaseline](docs/history/2026-03-12.roadmap-rebaseline.md)

Installer scope contract:

- normal installs target the tool's user/global config root
- `--global` remains accepted as a compatibility alias/no-op
- `--project-dir` is retired
- any repo-local exception must use an explicit bridge flow and must be documented explicitly

---

## Next Practical Steps

### 1. Add detached-process lifecycle management for background helpers (P1)

Local debugging found that stale detached `node.exe` processes can keep old
Cursor `.cursor/` state alive even after reinstalling or removing files. This
should become a general MDT rule for any background helper launched separately
from a tool session.

Next implementation slice:

- add a shared detached-process lifecycle contract
- make observers/helpers self-terminate when the owning tool/session is gone
- clean up PID files on exit
- document stale detached-process checks as part of normal troubleshooting for
  Cursor and any future background helper integrations

### 2. Validate weekly continuous-learning retrospectives (P2)

Goal:

- keep the live observer cheap and low-noise
- validate one-calendar-week summaries as useful sources of automation
  candidates
- keep monthly rollups deferred unless weekly summaries prove useful

Current shipped surface:

- Codex weekly retrospectives run through:
  `node ~/.codex/skills/continuous-learning-manual/scripts/codex-learn.js weekly --week YYYY-Www`
- structured output lands under:
  `~/.codex/mdt/homunculus/<project-id>/retrospectives/weekly/YYYY-Www.json`

Follow-ups:

- manually validate that weekly summaries produce useful automation candidates
  instead of noise
- decide whether Cursor should get the same explicit weekly command surface
- keep monthly rollups deferred until weekly summaries prove useful

### 3. Cut a stabilization release boundary (P2)

Once detached-process lifecycle management lands and the current workflow smoke
surface stays green, prepare release notes covering:

- global-first install stabilization
- package-manifest contract + validation
- continuous-learning runtime extraction and Codex manual workflow baseline
- workflow smoke coverage and compatibility suites

---

## Keep Using

For future verification passes, use:

- `node scripts/verify-tool-setups.js`
- `node scripts/smoke-tool-setups.js`
- `node scripts/smoke-claude-workflows.js`
- `node scripts/smoke-codex-workflows.js`
- `node tests/run-all.js --profile neutral`

If a tool is not installed locally, record it as `SKIP` rather than guessing.

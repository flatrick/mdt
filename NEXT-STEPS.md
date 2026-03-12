# Next Steps

## Current Direction

- This fork is primarily for personal daily use, with possible reuse by friends and coworkers.
- Upstream ECC is reference material, not an active sync source.
- v1 remains stabilization work: keep docs honest, verify real workflows, and avoid guesswork across tools.
- The intended destination stays in [docs/V1-TARGET-STATE.md](docs/V1-TARGET-STATE.md).
- The current install/package contract now lives in [docs/package-manifest-schema.md](docs/package-manifest-schema.md).
- Cross-tool parity analysis stays in [docs/functional-parity-plan.md](docs/functional-parity-plan.md).
- Until a commit is tagged `v1.0.0`, install layout and package composition are allowed to change.
- Before `v1.0.0`, assume fresh installs rather than in-place migration: rerun `mdt install`.

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

### 1. Finish the v1 docs convergence pass (P1)

Current-state docs should describe only what is shipped now, and roadmap docs
should describe only what is still planned.

Remaining pass criteria:

- all current user-facing docs prefer `mdt ...` over retired direct script entrypoints
- current support docs under `docs/tools/` match local verification and current install behavior
- roadmap docs keep future work separate from current support claims
- historical command examples stay under `docs/history/` only

### 2. Validate weekly retrospectives against real usage (P2)

Current shipped surface:

- `mdt learning retrospective weekly --week YYYY-Www`
- installed Codex dev root equivalent:
  `node ~/.codex/mdt/scripts/mdt.js learning retrospective weekly --week YYYY-Www`
- structured output under:
  `~/.codex/mdt/homunculus/<project-id>/retrospectives/weekly/YYYY-Www.json`

What still needs proof:

- whether one-calendar-week summaries produce useful automation candidates instead of noise
- whether Cursor needs the same explicit weekly workflow called out in its docs
- whether monthly rollups should stay deferred past `v1.0.0`

### 3. Cut the `v1.0.0` release boundary (P1)

Once the docs pass is complete and the current verification surface stays
green, prepare release notes covering:

- global-first install stabilization
- the `mdt` umbrella CLI contract
- package-manifest contract and validation
- continuous-learning runtime extraction plus observer lifecycle hardening
- workflow smoke coverage for Claude, Cursor, and Codex

---

## Keep Using

For future verification passes, use:

- `mdt verify tool-setups`
- `mdt smoke tool-setups`
- `mdt smoke workflows --tool claude`
- `mdt smoke workflows --tool codex`
- `node tests/run-all.js --profile neutral`

If a tool is not installed locally, record it as `SKIP` rather than guessing.

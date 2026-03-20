# Scripts Layer

Read [../AGENTS.md](../AGENTS.md) first. This file adds local rules for `scripts/`.

## Purpose

- `scripts/` contains the Node-first runtime, installers, validators, and adapter helpers that drive MDT.
- Prefer shared helpers in `scripts/lib/` over duplicated path, install, or environment logic.

## Local Invariants

- Keep runtime code cross-platform and shell-neutral unless a file is explicitly tool- or shell-specific.
- If a script changes install layout, verification behavior, or workflow contracts, update the adjacent docs and tests in the same pass.
- Nested `AGENTS.md` files are local guidance, not automatic repo-root markers. Use the shared root-detection helper instead of ad hoc checks.

## When Editing Here Also Update

- [../docs/INSTALLATION.md](../docs/INSTALLATION.md) when install behavior changes
- [../docs/tools](../docs/tools) when tool-facing behavior changes
- [../tests](../tests) for the relevant runtime surface

## Local Validation

- `node tests/ci/validators.test.js`
- `node scripts/mdt.js verify tool-setups`

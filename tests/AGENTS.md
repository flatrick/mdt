# Tests Layer

Read [../AGENTS.md](../AGENTS.md) first. This file adds local rules for `tests/`.

## Purpose

- `tests/` verifies MDT runtime behavior, tool adapters, validators, and compatibility surfaces.
- Keep tests close to the behavior they protect: `tests/lib/` for helpers, `tests/scripts/` for CLI/runtime wrappers, `tests/ci/` for validators, `tests/compatibility-testing/` for real execution surfaces.

## Local Invariants

- Update or add the narrowest test that covers the changed behavior.
- Use `tests/compatibility-testing/` for tool-facing launch contracts, not only file existence.
- If a workflow or capability doc changes because runtime behavior changed, add or refresh the matching automated check where possible.

## When Editing Here Also Update

- [compatibility-testing/README.md](./compatibility-testing/README.md) when compatibility coverage expectations change
- [../docs/testing/manual-verification](../docs/testing/manual-verification) when a runtime quirk needs human validation
- [../docs/tools](../docs/tools) when a test reveals a tool-specific limitation

## Local Validation

- `node tests/ci/validators.test.js`

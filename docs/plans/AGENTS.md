# Plans Layer

Read [../../AGENTS.md](../../AGENTS.md) and [../AGENTS.md](../AGENTS.md) first. This file adds local rules for `docs/plans/`.

## Purpose

- `docs/plans/` tracks non-trivial implementation work and its lifecycle.

## Local Invariants

- Follow the naming and lifecycle rules in [README.md](./README.md).
- Keep `active.md`, `finished.md`, and `rejected.md` in sync with the detail files.
- When all workstreams are implemented, stop and ask whether to archive or extend the plan.

## When Editing Here Also Update

- [README.md](./README.md)
- [active.md](./active.md)
- [finished.md](./finished.md)
- [rejected.md](./rejected.md)

## Local Validation

- `node tests/ci/validators.test.js`

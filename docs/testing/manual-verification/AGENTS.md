# Manual Verification Layer

Read [../../../AGENTS.md](../../../AGENTS.md) and [../../AGENTS.md](../../AGENTS.md) first. This file adds local rules for `docs/testing/manual-verification/`.

## Purpose

- This directory holds human-run verification checklists for real tool behavior.

## Local Invariants

- Each tool page must keep `Last verified:` and `Tested with version:`.
- Use these pages for behavior that cannot be proven well by static validation or unit tests.
- Keep the checklist aligned with `docs/tools/local-verification.md` and the actual installed runtime.

## When Editing Here Also Update

- [README.md](./README.md)
- [../../tools/local-verification.md](../../tools/local-verification.md)
- [../../tools](../../tools) when manual verification changes documented capability claims

## Local Validation

- `node tests/ci/validators.test.js`
- `node scripts/mdt.js verify tool-setups`

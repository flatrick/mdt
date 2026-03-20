# Compatibility Testing Layer

Read [../../AGENTS.md](../../AGENTS.md) and [../AGENTS.md](../AGENTS.md) first. This file adds local rules for `tests/compatibility-testing/`.

## Purpose

- This directory covers execution-surface compatibility tests that model how real tools launch MDT.

## Local Invariants

- Prefer real wrapper and installed-layout execution over narrow module-level assertions here.
- Cover direct public entrypoints, installed layouts, smoke contracts, and one tool-specific edge surface when relevant.
- If a compatibility test reveals a tool-specific limitation, document it in `docs/tools/` and the matching manual verification page.

## When Editing Here Also Update

- [README.md](./README.md)
- [../../docs/tools](../../docs/tools)
- [../../docs/testing/manual-verification](../../docs/testing/manual-verification)

## Local Validation

- `node tests/ci/validators.test.js`

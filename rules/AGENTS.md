# Rules Layer

Read [../AGENTS.md](../AGENTS.md) first. This file adds local rules for `rules/`.

## Purpose

- `rules/common/` defines universal defaults.
- Language directories extend common guidance without flattening or replacing it.

## Local Invariants

- Preserve the common-plus-language layering described in [README.md](./README.md).
- Keep relative references between common and language-specific rules valid.
- When a rule affects a tool-facing behavior, document the realization in `docs/tools/` instead of implying native parity.

## When Editing Here Also Update

- [README.md](./README.md)
- [../docs/tools/authoring.md](../docs/tools/authoring.md)
- [../cursor-template/rules](../cursor-template/rules) when Cursor materialization changes

## Local Validation

- `node tests/ci/validators.test.js`

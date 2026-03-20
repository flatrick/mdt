# Packages Layer

Read [../AGENTS.md](../AGENTS.md) first. This file adds local rules for `packages/`.

## Purpose

- `packages/` defines installable MDT package slices and tool-specific materialization boundaries.
- Changes here affect what gets shipped into tool homes or selected install sets.

## Local Invariants

- Keep package manifests aligned with the files they claim to install.
- If package content changes tool support or baselines, update `metadata/tools/` and the relevant docs.
- Prefer documenting package schema or selection rules in `docs/package-manifest-schema.md` instead of duplicating them here.

## When Editing Here Also Update

- [../docs/package-manifest-schema.md](../docs/package-manifest-schema.md)
- [../metadata/tools](../metadata/tools)
- [../scripts/install-mdt.js](../scripts/install-mdt.js) when install logic changes

## Local Validation

- `node tests/ci/validators.test.js`
- `node scripts/mdt.js verify tool-setups`

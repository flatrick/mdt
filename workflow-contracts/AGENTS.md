# Workflow Contracts Layer

Read [../AGENTS.md](../AGENTS.md) first. This file adds local rules for `workflow-contracts/`.

## Purpose

- `workflow-contracts/workflows/` is the machine-readable source of truth for intended MDT workflow outcomes.
- Human-readable workflow docs must follow these contracts, not the other way around.

## Local Invariants

- Keep contract names, expected outcomes, and enabled artifacts consistent with the docs pack.
- When a workflow is added or materially changed, update smoke coverage and the relevant tool docs in the same change.
- Do not treat tool-specific realization details as the workflow itself; those belong in `docs/tools/`.

## When Editing Here Also Update

- [workflows](./workflows)
- [../docs/tools/workflow-matrix.md](../docs/tools/workflow-matrix.md)
- [../docs/tools/authoring.md](../docs/tools/authoring.md)

## Local Validation

- `node scripts/mdt.js verify tool-setups`

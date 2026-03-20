# Agents Layer

Read [../AGENTS.md](../AGENTS.md) first. This file adds local rules for `agents/`; it does not relax repo-wide requirements.

## Purpose

- `agents/*.md` defines specialized role prompts and delegated workflow helpers.
- Keep agent prompts tool-agnostic by default. Tool-specific realization belongs in `docs/tools/` and the relevant template layer.

## Local Invariants

- The `agents/` directory is authoritative if the root agent table drifts.
- Keep each agent focused on one role and one decision boundary.
- If an agent changes a core workflow outcome, update the matching entries in `docs/tools/workflow-matrix.md`.

## When Editing Here Also Update

- [../AGENTS.md](../AGENTS.md) when the available-agent table changes
- [../docs/tools/authoring.md](../docs/tools/authoring.md) when the agent authoring guidance changes
- [../docs/tools/surfaces/agents.md](../docs/tools/surfaces/agents.md) when cross-tool agent realization changes

## Local Validation

- `node tests/ci/validators.test.js`
- `node scripts/mdt.js verify tool-setups`

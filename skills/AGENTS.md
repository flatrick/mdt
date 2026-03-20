# Skills Layer

Read [../AGENTS.md](../AGENTS.md) first. This file adds local rules for `skills/`.

## Purpose

- Each skill lives in its own directory and is anchored by `SKILL.md`.
- Skills should remain tool-agnostic unless a tool-specific materialization genuinely requires divergence.

## Local Invariants

- Keep the primary contract in `SKILL.md`; add `skill.meta.json` only when the install/runtime flow requires it.
- Reuse shared assets under the skill directory instead of copying instructions into multiple places.
- If a skill is shipped through a tool template, keep the template copy aligned with the source skill.

## When Editing Here Also Update

- [../docs/tools/authoring.md](../docs/tools/authoring.md)
- [../docs/tools/surfaces/skills.md](../docs/tools/surfaces/skills.md)
- [../codex-template/skills](../codex-template/skills) when a shipped Codex skill changes
- [../packages](../packages) when package materialization or manifests change

## Local Validation

- `node tests/ci/validators.test.js`
- `node scripts/mdt.js verify tool-setups`

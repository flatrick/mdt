## Codex Guidance

This repository is **ModelDev Toolkit (MDT)**, designed to be consumed by Codex as a **scaffolding source** for config, skills, and helper scripts.

### How Codex should treat this repo

- **Primary guidance**: read root `AGENTS.md` for cross-tool rules and workflows.
- **Codex-specific details**: see `docs/tools/codex.md` (source of truth for Codex capability claims and integration points).
- **Install source**: treat `codex-template/` as the **authoritative source tree** for Codex-facing assets (`config.toml`, `AGENTS.md`, skills, and helper scripts).
- **Install targets**:
  - tool-facing layer: `~/.codex/` for Codex config and global guidance
  - MDT-owned layer: `~/.codex/mdt/` for runtime helpers, observer scripts, and learning state

### Expected install workflow

- Use `node scripts/install-mdt.js --target codex <package...>` to materialize:
  - configuration into `~/.codex/`
  - selected skills from `codex-template/skills/` into `~/.codex/skills/`
  - runtime helpers into `~/.codex/mdt/scripts/`
- Codex tools should assume:
  - MDT installs are global-only by default,
  - skills follow the shared `SKILL.md` + optional `agents/openai.yaml` convention,
  - continuous-learning state lives under `~/.codex/mdt/homunculus/<project-id>/`,
  - smoke-style checks are run via the shipped Node scripts rather than Codex-specific markdown commands.

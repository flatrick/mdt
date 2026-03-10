## Codex Guidance

This repository is **ModelDev Toolkit (MDT)**, designed to be consumed by Codex as a **scaffolding source** for config, skills, and local scripts, not as an already-installed project.

### How Codex should treat this repo

- **Primary guidance**: read root `AGENTS.md` for cross-tool rules and workflows.
- **Codex-specific details**: see `docs/tools/codex.md` (source of truth for Codex capability claims and integration points).
- **Install source**: treat `codex-template/` as the **authoritative source tree** for Codex-facing assets (`config.toml`, `AGENTS.md`, skills, and helper scripts).
- **Install targets**:
  - user layer: `~/.codex/` for Codex config and global guidance
  - project layer: `.agents/skills/` and `.agents/scripts/` as **generated, untracked install surfaces**

### Expected install workflow

- Use `node scripts/install-mdt.js --target codex [--project-dir <repo>] <package...>` to materialize:
  - configuration into `~/.codex/`
  - selected skills from `codex-template/skills/` into `.agents/skills/`
  - runtime helpers into `.agents/scripts/`
- Codex tools should assume:
  - `.agents/` is **not** a source of truth and may be safely regenerated,
  - skills follow the shared `SKILL.md` + optional `agents/openai.yaml` convention,
  - smoke-style checks are run via the shipped Node scripts (for example `scripts/smoke-codex-workflows.js`) rather than Codex-specific markdown commands.


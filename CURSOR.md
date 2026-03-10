## Cursor / Cursor Agent Guidance

This repository is **ModelDev Toolkit (MDT)**, designed to be consumed by Cursor and Cursor Agent as a **scaffolding source**, not as an already-installed project.

### How Cursor should treat this repo

- **Primary guidance**: read root `AGENTS.md` for cross-tool rules and workflows.
- **Cursor-specific details**: see `docs/tools/cursor.md` (source of truth for Cursor capability claims and integration points).
- **Install layout**: treat `cursor-template/` as the **install source** for rules, skills, commands, and the optional hook adapter.
- **Install target**: `.cursor/` is a **local, untracked install surface**. MDT intentionally does **not** commit `.cursor/` into git.

### Expected install workflow

- Use `node scripts/install-mdt.js --target cursor <package...>` to materialize:
  - rules into `.cursor/rules/`
  - skills into `.cursor/skills/`
  - custom commands into `.cursor/commands/`
  - optional experimental hooks from `cursor-template/hooks.*`
- Cursor tools should assume:
  - this repo is safe to clone and install from,
  - `.cursor/` contents are ephemeral and may be regenerated,
  - workflows must still function even if the experimental hook adapter is ignored (rules, skills, `AGENTS.md`, memories, and background agents remain primary).


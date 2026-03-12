## Cursor / Cursor Agent Guidance

This repository is **ModelDev Toolkit (MDT)**, designed to be consumed by Cursor and Cursor Agent as a **scaffolding source**, not as an already-installed project.

### How Cursor should treat this repo

- **Primary guidance**: read root `AGENTS.md` for cross-tool rules and workflows.
- **Cursor-specific details**: see `docs/tools/cursor.md` (source of truth for Cursor capability claims and integration points).
- **Install layout**: treat `cursor-template/` as the **install source** for rules, skills, commands, and the optional hook adapter.
- **Install target**: `~/.cursor/` is the normal MDT install target, even for users who currently only use Cursor IDE. MDT-owned runtime/state lives under `~/.cursor/mdt/`.
- **Local exception**: if a workflow needs a repo-local Cursor surface, use the explicit bridge command instead of a full project install.

### Expected install workflow

- Use `node scripts/install-mdt.js --target cursor <package...>` to materialize the primary global Cursor install into `~/.cursor/`, even if the user is not currently using `cursor-agent`:
  - global rules into `~/.cursor/rules/*.mdc`
  - skills into `~/.cursor/skills/`
  - custom commands into `~/.cursor/commands/`
  - optional experimental hooks into `~/.cursor/hooks*`
  - MDT-owned helpers/state into `~/.cursor/mdt/`
- Use `node scripts/materialize-mdt-local.js --target cursor --surface rules <package...>` only when a repo-local `.cursor/rules/` bridge is explicitly needed for Cursor IDE.
- Cursor tools should assume:
  - this repo is safe to clone and install from,
  - repo-local `.cursor/` contents are exception surfaces, not the primary install target,
  - workflows must still function even if the experimental hook adapter is ignored (rules, skills, `AGENTS.md`, memories, and background agents remain primary).

### Rules Surface Split

Local verification last true on `2026-03-12` shows a current split between
Cursor surfaces:

- Cursor IDE reads project rules from the opened repo's `.cursor/rules/`
- Cursor IDE user-global rules appear to live in Cursor-managed app storage
  rather than `~/.cursor/rules/*.mdc`
- `cursor-agent` reads file-backed user-global rules from
  `~/.cursor/rules/*.mdc`

Operational rule for MDT:

- always install the main MDT Cursor payload into `~/.cursor/`
- add repo-local `.cursor/rules/` only when Cursor IDE needs project rules in a
  given repo

Do not treat repo-local `.cursor/rules/` and global `~/.cursor/rules/*.mdc` as
interchangeable. They differ in scope, storage, and which Cursor surface reads
them.

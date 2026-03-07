# Supported LLM Tools

ModelDev Toolkit (MDT) spans multiple LLM modalities and IDEs. Because each tool has its own architecture, MDT installs distinct configurations when you use `npx mdt-install --target <tool>`.

This matrix explains what features are supported natively in each tool and how the underlying configuration works.

| Feature | Claude Code | Cursor | Codex | Gemini (Antigravity) | OpenCode |
|---------|-------------|--------|-------|-----------------------|-----------|
| **Install Target** | `claude` | `cursor` | `codex` | `gemini` | N/A (Plugin) |
| **Agents / Workflows** | Yes (`/plan`, etc.) | Yes (Local) | Yes | Yes (Native Workflows) | Yes |
| **Skills / Contexts** | Yes (`skills/`) | Yes (`skills/`) | Limited | Yes (Rules/Skills) | Yes |
| **Custom Commands** | Yes (`commands/`) | Yes (`commands/`) | N/A | Yes (`.toml` Commands) | Yes |
| **System Hooks** | Yes (JS/Node) | Yes (JS/Node) | N/A | N/A | Yes |
| **Rules Configuration** | Global & Local | Local Only (`.cursorrules`) | Global Instructs | Global & Local | Yes |

---

## Claude Code (Default)
**Target:** `claude` (Local/Global to `~/.claude/`)

Claude Code is Anthropic's CLI. It natively supports commands, agents, skills, and rules via markdown configurations located in `~/.claude/`.

- **Rules:** Appends rules to `~/.claude/rules/`.
- **Agents:** Populates `~/.claude/agents/`. You invoke them via slash commands.
- **Skills:** Loaded from `~/.claude/skills/`. Read manually by Claude.
- **Commands:** Copied to `~/.claude/commands/`.
- **Hooks:** Merges events into `~/.claude/settings.json` and runs `scripts/hooks` logic.

**What you can't do here:** Claude Code doesn't natively parse deep workspace integrations without explicitly setting up custom tools. It runs fully isolated in your CLI.

---

## Cursor IDE
**Target:** `cursor` (Project-local `.cursor/` or Global `~/.cursor/`)

Cursor is an AI-first IDE fork of VSCode.

- **Rules:** Copies markdown rules into `.cursor/rules/`. **Note:** You cannot use file-based rules globally in Cursor (they must exist in `.cursor/rules/`). For global, you must paste rules manually into Settings.
- **Agents / Skills:** Loaded as read context internally by Cursor's codebase indexer.
- **Hooks:** Uses custom Node scripts attached to file events, defined in `.cursor/hooks.json`.
- **Custom Commands:** Setup for the Cursor Composer terminal.

**What you can't do here:** Global rule installations without manual UI copy-pasting.

---

## OpenAI Codex CLI
**Target:** `codex` (Global `~/.codex/config.toml`)

Codex is a command-line wrapper focusing tightly on file system access and system generation.

- **Configuration:** Employs a single `~/.codex/config.toml`.
- **Instructions:** Uses an `instructions` string in TOML rather than an entire localized `rules/` directory tree.
- **Agents:** Relies completely on a master `AGENTS.md` file rather than segmented subagents, instructing Codex on how to dynamically resolve roles.

**What you can't do here:** Codex does not support discrete slash commands or individual agent profiles. Everything operates under its monolithic system prompt.

---

## Gemini CLI & Antigravity
**Target:** `gemini` (Project-local `.agent/` and `.gemini/`, or Global)

Gemini (powered structurally by Antigravity) reads local workspace variables deeply. Our installer maps MDT assets perfectly to Google's folder structures.

- **Global Install:** `~/.gemini/antigravity/.agents` (Skills/Workflows) and `~/.gemini/commands` (CLI custom commands). Appends rules to `~/.gemini/GEMINI.md`.
- **Local Install:** `.agent/` and `.gemini/`.
- **Commands:** The installer parses MDT's Markdown commands and reconstructs them into TOML structures inside `.gemini/commands/{brand}.toml` for Native Gemini CLI auto-completions.
- **Workflows:** MDT agents drop cleanly into `workflows/`.
- **Skills:** Drop precisely into `skills/`.

**What you can't do here:** Gemini does not natively execute post-generation JS hooks like Claude/Cursor, it operates securely via strict MCP or plugin constraints.

---

## OpenCode
**Target:** N/A (Loaded as NPM Plugin)

OpenCode reads everything dynamically from `opencode.json` plugins. No CLI scaffolding is required; you simply `npm install opencode-MDT` and run `/plan`! It maps MDT hooks directly internally.

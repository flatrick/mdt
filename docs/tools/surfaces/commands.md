# Commands Across Tools

Use this page when you need to compare how MDT should create user-invoked workflow commands across Claude Code, Cursor, and Codex.

## Support Summary

| Tool | Status | What MDT should author |
| --- | --- | --- |
| Claude | `official` | Markdown slash commands from `commands/*.md` |
| Cursor | `official` | Shared `commands/*.md` plus optional `cursor-template/commands/*.md` overrides |
| Codex | `repo-adapter` for MDT workflow commands | Skills, `AGENTS.md`, and explicit `mdt` workflows rather than Claude-style command files |

## Source Files

| Tool | Primary source files | Notes |
| --- | --- | --- |
| Claude | `commands/*.md`, `commands/*.meta.json` | Native command model |
| Cursor | `commands/*.md`, `commands/*.meta.json`, optional `cursor-template/commands/*.md` | Cursor may need wording overrides |
| Codex | no native MDT markdown command surface | Codex built-in slash commands are session controls, not MDT workflow prompts |

## Creation Model

### Claude

- Create `commands/<name>.md`.
- Add `commands/<name>.meta.json`.
- Reference shared agents and skills accurately.

### Cursor

- Keep the shared source in `commands/`.
- Add `commands/<name>.meta.json` with `cursor` in the tool list.
- Add `cursor-template/commands/<name>.md` only when Cursor needs different phrasing or a tool-specific override.

### Codex

- Do not create a markdown command and describe it as a native Codex surface.
- If the workflow outcome must exist in Codex, realize it through skills, `AGENTS.md`, workflow contracts, and explicit `mdt` verification flows.

## Key Differences

| Question | Claude | Cursor | Codex |
| --- | --- | --- | --- |
| Are markdown command files a native surface? | Yes | Yes | No |
| Does MDT use shared `commands/*.md` directly? | Yes | Yes, with optional overrides | No |
| What are built-in slash commands for? | MDT and vendor commands | MDT and vendor commands | Session control, not MDT markdown workflows |
| Common mistake | assuming markdown commands are the whole story | forgetting the override model | confusing native Codex slash commands with MDT command files |

## Contributor Rules

- Default to `commands/*.md` as the shared command source.
- Treat `cursor-template/commands/` as an override directory, not the canonical source.
- For Codex, document the workflow outcome and its Codex realization instead of pretending a command file exists.

## Decision Rule

- If the workflow should appear as a user-invoked prompt in Claude and Cursor, start in `commands/`.
- Add a Cursor override only when the shared command wording is materially wrong for Cursor.
- If Codex needs the same outcome, describe and verify the Codex realization separately instead of trying to force command-file parity.

# Claude Code

Audit date: `2026-03-12`

Status:
- `official`
- `locally-verified`

Tested with version:
- `claude --version` -> `2.1.73 (Claude Code)`

## MDT-Relevant Native Surfaces

- `CLAUDE.md` and memory files for persistent guidance
- markdown slash commands
- subagents
- hooks
- MCP
- plugins
- settings JSON

## Native Surfaces vs MDT

| MDT Concern | Claude surface | Repo status |
|---|---|---|
| Rules / project guidance | `CLAUDE.md`, markdown guidance, settings | `official` |
| Skills | `skills/*/SKILL.md` | `official` |
| Commands | markdown slash commands in `commands/` | `official` |
| Agents | markdown subagent definitions in `agents/` | `official` |
| Automations | `hooks` in settings JSON | `official` |
| MCP | CLI + config/settings | `official` |

## MDT Mapping Notes

- Claude is still the clearest native reference implementation for MDT hook-capable workflows.
- Claude-specific docs should stay vendor-specific and must not be projected onto Cursor or Codex.
- Current-state docs should use `mdt ...` as the public operational surface; installed-home raw script paths are verification equivalents only.

## Verification Method

Local CLI evidence:
- `claude --version`
- `claude --help`
- `claude agents --help`
- `claude mcp --help`

Runtime workflow check:
- `mdt dev smoke tool-setups --tool claude`
- `mdt dev smoke workflows --tool claude`

Installed-home equivalent:
- `node ~/.claude/mdt/scripts/mdt.js dev smoke tool-setups --tool claude`
- `node ~/.claude/mdt/scripts/mdt.js dev smoke workflows --tool claude`

## What Not To Assume

- Claude-native behavior does not automatically transfer to Cursor or Codex.
- Claude hooks are stronger than the documented automation surfaces in Codex and currently better documented than MDT's Cursor hook adapter.

## Source Links

- Hooks: [docs.anthropic.com/en/docs/claude-code/hooks](https://docs.anthropic.com/en/docs/claude-code/hooks)
- Slash commands: [docs.anthropic.com/en/docs/claude-code/slash-commands](https://docs.anthropic.com/en/docs/claude-code/slash-commands)
- Subagents: [docs.anthropic.com/en/docs/claude-code/sub-agents](https://docs.anthropic.com/en/docs/claude-code/sub-agents)
- Memory: [docs.anthropic.com/en/docs/claude-code/memory](https://docs.anthropic.com/en/docs/claude-code/memory)
- Skills: [docs.anthropic.com/en/docs/claude-code/skills](https://docs.anthropic.com/en/docs/claude-code/skills)

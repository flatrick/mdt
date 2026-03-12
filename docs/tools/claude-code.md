# Claude Code

Audit date: `2026-03-11`

Status:
- `official`
- `locally-verified`

Local version seen:
- `claude --version` -> `2.1.72 (Claude Code)`

## MDT-Relevant Native Surfaces

- `CLAUDE.md` and memory files for persistent project guidance
- slash commands
- subagents
- hooks
- MCP
- plugins
- settings JSON

This is the tool that most directly matches MDT's current repo structure.

## Native Surfaces vs MDT

| MDT Concern | Claude surface | Repo status |
|---|---|---|
| Rules / project guidance | `CLAUDE.md`, markdown guidance, settings | native |
| Skills | `skills/*/SKILL.md` | native |
| Commands | markdown slash commands in `commands/` | native |
| Agents | markdown subagent definitions in `agents/` | native |
| Automations | `hooks` in settings JSON | native |
| MCP | CLI + config/settings | native |

## Syntax and Paths Used By MDT

### Hooks

MDT's Claude hook source of truth is:

- `claude-template/hooks.json`
- mirrored to `hooks/hooks.json`

The commands in that file use the `MDT_ROOT` placeholder, for example:

```json
{
  "type": "command",
  "command": "node \"${MDT_ROOT}/scripts/hooks/run-with-flags.js\" \"session:start\" \"scripts/hooks/session-start.js\" \"minimal,standard,strict\""
}
```

Claude loads hooks from settings. In this repo, the installer materializes hook paths into the Claude config directory.

### Commands

MDT uses markdown slash-command files under `commands/`.

### Smoke verification

Claude smoke now has two complementary surfaces:

- in-session `/smoke` for fast runtime-aware sanity checks inside Claude Code
- `mdt smoke workflows --tool claude` for deterministic local verification
  of the current Claude workflow contract surfaces

For installed Claude homes, the same deterministic check is materialized to:

```bash
node ~/.claude/mdt/scripts/mdt.js smoke workflows --tool claude
```

### Agents

MDT uses markdown subagent files under `agents/`.

### Memory and persistent guidance

Use `CLAUDE.md` for project guidance and Claude Code memory mechanisms for persistent context.

## What Not To Assume

- Claude-native behavior does not automatically transfer to Cursor or Codex.
- Claude hooks are stronger than the documented automation surfaces in Codex and currently better documented than MDT's Cursor hook adapter.

## Local Verification Commands

```bash
claude --version
claude --help
claude agents --help
claude mcp --help
mdt smoke workflows --tool claude
```

Useful local checks:
- `claude agents --help` confirms agent management exists locally.
- `claude mcp --help` confirms MCP management exists locally.
- `claude --help` shows session options including agents, settings, MCP, plugins, and permission modes.

## Source Links

- Hooks: [docs.anthropic.com/en/docs/claude-code/hooks](https://docs.anthropic.com/en/docs/claude-code/hooks)
- Slash commands: [docs.anthropic.com/en/docs/claude-code/slash-commands](https://docs.anthropic.com/en/docs/claude-code/slash-commands)
- Subagents: [docs.anthropic.com/en/docs/claude-code/sub-agents](https://docs.anthropic.com/en/docs/claude-code/sub-agents)
- Memory: [docs.anthropic.com/en/docs/claude-code/memory](https://docs.anthropic.com/en/docs/claude-code/memory)
- Skills: [docs.anthropic.com/en/docs/claude-code/skills](https://docs.anthropic.com/en/docs/claude-code/skills)

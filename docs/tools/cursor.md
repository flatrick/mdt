# Cursor

Audit date: `2026-03-08`

Status:
- `official`
- `locally-verified`
- `experimental` for MDT's current hook adapter

Local versions and binaries seen:
- `cursor --version` -> `2.6.13`
- `agent --help` launches Cursor Agent
- `cursor-agent --help` is also available locally

## MDT-Relevant Native Surfaces

- project/user rules
- `AGENTS.md`
- custom commands
- memories
- background agents
- terminal agent / CLI
- MCP from the CLI

These are official Cursor surfaces and should be treated as the primary integration points.

## Native Surfaces vs MDT

| MDT Concern | Cursor surface | Repo status |
|---|---|---|
| Rules / project guidance | `.cursor/rules/` plus `AGENTS.md` | official |
| Commands | Cursor custom commands | official vendor surface, not yet fully documented as an MDT adapter in this repo |
| Agents / delegation | custom modes, background agents, terminal agent | official |
| Skills / reusable workflows | no clearly named Cursor-native "skills" abstraction in this audit | `repo-adapter` at best |
| Persistent context | rules, memories, `AGENTS.md` | official |
| Automations / hooks | no vendor-documented equivalent to MDT `.cursor/hooks.json` found during this audit | treat current repo hook path as `experimental` |
| MCP | Cursor CLI and agent can manage/use MCP | official |

## What MDT Currently Ships

The repo currently ships:
- `.cursor/rules/`
- `.cursor/hooks.json`
- `.cursor/hooks/*.js`

The rules are easy to justify from official docs.

The hook layer is not yet something future agents should assume is an official Cursor feature. Until Cursor publishes that surface clearly, treat:
- `.cursor/hooks.json`
- `.cursor/hooks/*.js`
- `hooks/cursor/*`

as MDT's `experimental` Cursor adapter, not as vendor truth.

## Syntax and Paths To Prefer

### Official guidance surfaces

- Rules in `.cursor/rules/`
- `AGENTS.md` at repo root
- custom commands in Cursor's documented command system
- memories in Cursor's documented memory system
- background agents for delegated/async workflows

### Terminal agent

Local CLI evidence:

```bash
agent --help
cursor agent --help
cursor-agent --help
```

The installed terminal agent supports:
- `--mode plan`
- `--mode ask`
- `--resume`
- `--model`
- `--sandbox`
- `mcp`
- `generate-rule`

That makes Cursor a viable official target for planning, Q&A, MCP, and rule-generation workflows even without assuming hook parity.

## What Not To Assume

- Do not assume `.cursor/hooks.json` is official just because it exists in this repo.
- Do not assume "skills" are a first-class Cursor concept equivalent to Claude skills or Codex skills.
- Do not force Claude hook semantics onto Cursor when rules, memories, background agents, or commands achieve the same MDT outcome more cleanly.

## Local Verification Commands

```bash
cursor --version
cursor --help
agent --help
cursor agent --help
cursor-agent --help
```

Look for:
- `agent` subcommand in `cursor --help`
- plan/ask modes in `agent --help`
- MCP-related CLI support such as `--add-mcp`

## Source Links

- Rules: https://docs.cursor.com/en/context/rules
- AGENTS.md and rules together: https://docs.cursor.com/en/cli/using
- Custom commands: https://docs.cursor.com/en/agent/chat/commands
- Memories: https://docs.cursor.com/en/context/memories
- Background agents: https://docs.cursor.com/en/background-agents/overview
- Terminal agent / CLI: https://docs.cursor.com/en/cli/agent

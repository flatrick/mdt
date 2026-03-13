# Cursor

Audit date: `2026-03-12`

Status:
- `official`
- `locally-verified`
- `experimental` for MDT's current hook adapter

Tested with version:
- `agent --version` -> `2026.03.11-6dfa30c`
- `cursor-agent --version` -> `2026.03.11-6dfa30c`
- Cursor IDE -> `not-locally-verified` in this audit; manual human verification required

## MDT-Relevant Native Surfaces

- project rules
- user-global rules for `cursor-agent`
- `AGENTS.md`
- custom commands
- skills
- memories
- background agents
- terminal agent / CLI
- MCP

## Native Surfaces vs MDT

| MDT Concern | Cursor surface | Repo status |
|---|---|---|
| Rules / project guidance | `.cursor/rules/` for project scope and `~/.cursor/rules/*.mdc` for `cursor-agent` user scope | `official`, `locally-verified` |
| Commands | Cursor custom commands | `official` |
| Agents / delegation | custom modes, background agents, terminal agent | `official` |
| Skills / reusable workflows | `.cursor/skills/` and `~/.cursor/skills/` | `official` |
| Persistent context | rules, memories, `AGENTS.md` | `official` |
| Automations / hooks | MDT `cursor-template/hooks.json` adapter | `experimental` |
| MCP | Cursor CLI and agent MCP support | `official` |

## MDT Mapping Notes

- Treat Cursor IDE project rules and Cursor Agent user-global rules as distinct install surfaces.
- Do not describe `~/.cursor/rules/*.mdc` as a vendor-wide user rule surface for every Cursor experience.
- Treat `cursor-template/hooks.json` and `cursor-template/hooks/*.js` as MDT's experimental adapter, not as vendor-native truth.
- Cursor IDE verification is manual and human-operated.

## Verification Method

Local CLI evidence:
- `agent --version`
- `agent --help`
- `cursor-agent --version`
- `cursor-agent --help`

Runtime workflow check:
- `mdt dev smoke tool-setups --tool cursor`
- `mdt dev smoke workflows --tool cursor`

Installed-home equivalent:
- `node ~/.cursor/mdt/scripts/mdt.js dev smoke tool-setups --tool cursor`
- `node ~/.cursor/mdt/scripts/mdt.js dev smoke workflows --tool cursor`

Manual verification boundary:
- Cursor IDE checks must be run by a human operator.
- When Cursor IDE is re-verified, record the exact tested version on the manual verification page.

## Local Bridge Exception

Use the repo-local rules bridge only when a specific repository needs `.cursor/rules/` for Cursor IDE:

```bash
mdt bridge materialize --tool cursor --surface rules
```

The installed Cursor custom command `/install-rules` is the in-product equivalent.

## What Not To Assume

- Do not assume the hook adapter is an official Cursor feature.
- Do not assume Cursor IDE and `cursor-agent` share the same user-global rule storage model.
- Do not assume Cursor IDE can be launched and prompted through the current CLI verification flow.

## Source Links

- Rules: [docs.cursor.com/en/context/rules](https://docs.cursor.com/en/context/rules)
- AGENTS.md and rules together: [docs.cursor.com/en/cli/using](https://docs.cursor.com/en/cli/using)
- Custom commands: [docs.cursor.com/en/agent/chat/commands](https://docs.cursor.com/en/agent/chat/commands)
- Memories: [docs.cursor.com/en/context/memories](https://docs.cursor.com/en/context/memories)
- Background agents: [docs.cursor.com/en/background-agents/overview](https://docs.cursor.com/en/background-agents/overview)
- Terminal agent / CLI: [docs.cursor.com/en/cli/agent](https://docs.cursor.com/en/cli/agent)
- Skills: [cursor.com/docs/skills](https://cursor.com/docs/skills)

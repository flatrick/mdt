# MDT Capability Matrix

Audit date: `2026-03-08`

Status legend:
- `official`
- `locally-verified`
- `experimental`
- `repo-adapter`
- `unsupported`
- `not-locally-verified`

## Matrix

| MDT Feature Family | Claude Code | Cursor | Codex | OpenCode |
|---|---|---|---|---|
| Base project guidance | `official`, `locally-verified` via `CLAUDE.md` and settings sources | `official`, `locally-verified` via rules plus `AGENTS.md` | `official`, `locally-verified` via layered `AGENTS.md` | `official`, `not-locally-verified` via `instructions` in `opencode.json` |
| Rules / reusable guidance | `official` markdown docs/rules; user-level rules in `~/.claude/rules/` are file-based | `official` `.cursor/rules/` at project scope only; user-level rules are database-backed and not file-installable | `official` `.rules` files under Codex config layers | `official` via `instructions` files |
| Skills / reusable workflows | `official` Claude Code skills docs exist; MDT ships `skills/*/SKILL.md` | `official` `.cursor/skills/` (project) and `~/.cursor/skills/` (user); same `SKILL.md` format; MDT ships `frontend-slides`, others need adding | `official` skills under `.agents/skills` or user/system skill locations | `official` in practice via `instructions` entries that point at `SKILL.md` files |
| Repo-defined workflow commands | `official` markdown slash commands | `official` custom commands exist; MDT does not yet document a stable Cursor command adapter in this repo | `unsupported` as a direct Claude-style markdown command model; Codex docs emphasize built-in slash commands, skills, rules, and AGENTS | `official` `command` entries or markdown command files |
| Built-in slash / session control commands | `official` slash commands | `official` commands plus terminal agent modes | `official`, `locally-verified` built-in slash/session commands such as `/permissions`, `/agent`, `/status`, `/model` | `official` command palette/config commands |
| Agents / subagents / delegation | `official`, `locally-verified` subagents and `claude agents` | `official`, `locally-verified` custom modes, background agents, terminal agent; `AGENTS.md` also official | `official` `AGENTS.md`; `experimental`, `locally-verified` feature flags for multi-agent support | `official` `agent` config with primary and subagent modes |
| Event automations / hooks | `official` hooks in settings | `experimental` for MDT `.cursor/hooks.json`; not treated as vendor-documented in this audit | `unsupported` as Claude-style event hooks; use automations/rules/skills instead | `official` plugins and tools; not locally verified |
| Persistent context / memory | `official` `CLAUDE.md` and memory docs | `official` rules, memories, and `AGENTS.md` | `official` persistent layered instructions; `experimental`, `locally-verified` local `memories` feature flag exists | `official` persistent instructions/config; no local verification |
| MCP / tool integration | `official`, `locally-verified` CLI has MCP management | `official`, `locally-verified` CLI can add MCP servers | `official`, `locally-verified` `mcp` command and `config.toml` | `official` config/plugin/tool surfaces; not locally verified |

## How To Read This Matrix

- If a cell says `official`, prefer the vendor-native surface on that tool page.
- If a cell says `repo-adapter`, MDT can emulate the outcome, but the vendor does not expose the same named concept.
- If a cell says `experimental`, do not make it the default assumption in planning or implementation.
- If a cell says `unsupported`, redesign the workflow rather than trying to force Claude semantics onto that tool.

## Immediate MDT Planning Implications

- Treat Claude Code as the reference implementation for current MDT hook/command/subagent structure.
- Treat Cursor as a strong official target for rules, skills, commands, memories, modes, and background agents.
- Treat Codex as a first-class target for layered instructions, rules, skills, and built-in session control, but not as a hook-compatible clone of Claude.
- Treat OpenCode as a config/plugin target. Use repo config and official docs, but clearly mark local verification gaps until `opencode` is installed here.

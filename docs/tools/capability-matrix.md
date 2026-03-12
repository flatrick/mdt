# MDT Capability Matrix

Audit date: `2026-03-11`

Status legend:
- `official`
- `locally-verified`
- `experimental`
- `repo-adapter`
- `unsupported`
- `not-locally-verified`

## Matrix

| MDT Feature Family | Claude Code | Cursor | Codex |
|---|---|---|---|
| Base project guidance | `official`, `locally-verified` via `CLAUDE.md` and settings sources | `official`, `locally-verified` via rules plus `AGENTS.md` | `official`, `locally-verified` via layered `AGENTS.md` |
| Rules / reusable guidance | `official` markdown docs/rules; user-level rules in `~/.claude/rules/` are file-based | `official` project `.cursor/rules/`; `locally-verified` user-global `~/.cursor/rules/*.mdc` via `cursor-agent`; Cursor IDE appears to use Cursor-managed app storage for user-global rules instead of that file surface (last locally true `2026-03-12`) | `official` `.rules` files under Codex config layers |
| Skills / reusable workflows | `official` Claude Code skills docs exist; MDT ships `skills/*/SKILL.md` | `official` `.cursor/skills/` (project) and `~/.cursor/skills/` (user); same `SKILL.md` format; MDT installs package-selected Cursor skills globally by default | `official` skills under project `.codex/skills` or user/system skill locations; MDT installs package-selected Codex skills into `~/.codex/skills/` |
| Repo-defined workflow commands | `official` markdown slash commands including quick sanity checks such as `smoke` | `official`, `locally-verified` custom commands via `cursor-template/commands/*.md` installed to `~/.cursor/commands/`, including `smoke` | `repo-adapter` via skills and local smoke scripts, not a Claude-style markdown command model |
| Built-in slash / session control commands | `official` slash commands | `official` commands plus terminal agent modes | `official`, `locally-verified` built-in slash/session commands such as `/permissions`, `/agent`, `/status`, `/model` |
| Agents / subagents / delegation | `official`, `locally-verified` subagents and `claude agents` | `official`, `locally-verified` custom modes, background agents, terminal agent; `AGENTS.md` also official | `official` `AGENTS.md`; `experimental`, `locally-verified` feature flags for multi-agent support |
| Event automations / hooks | `official` hooks in settings | `experimental` for MDT `cursor-template/hooks.json`; not treated as vendor-documented in this audit | `unsupported` as Claude-style event hooks; use automations/rules/skills instead |
| Persistent context / memory | `official` `CLAUDE.md` and memory docs | `official` rules, memories, and `AGENTS.md` | `official` persistent layered instructions; `experimental`, `locally-verified` local `memories` feature flag exists; MDT also uses project-scoped continuous-learning state under `~/.codex/mdt/homunculus/` |
| MCP / tool integration | `official`, `locally-verified` CLI has MCP management | `official`, `locally-verified` CLI can add MCP servers | `official`, `locally-verified` `mcp` command and `config.toml` |

## How To Read This Matrix

- If a cell says `official`, prefer the vendor-native surface on that tool page.
- If a cell says `repo-adapter`, MDT can emulate the outcome, but the vendor does not expose the same named concept.
- If a cell says `experimental`, do not make it the default assumption in planning or implementation.
- If a cell says `unsupported`, redesign the workflow rather than trying to force Claude semantics onto that tool.

## Immediate MDT Planning Implications

- Treat Claude Code as the reference implementation for current MDT hook/command/subagent structure.
- Treat Cursor as a strong official target for rules, skills, commands, memories, modes, and background agents.
- Treat Codex as a first-class target for layered instructions, rules, skills, and built-in session control, but not as a hook-compatible clone of Claude.

# Agents Across Tools

Use this page when you need to compare how MDT should model specialized agents or delegation across Claude Code, Cursor, and Codex.

## Support Summary

| Tool | Status | What MDT should author |
| --- | --- | --- |
| Claude | `official` | Shared `agents/*.md` subagent definitions |
| Cursor | `official` for delegation, but not via Claude agent files | Describe Cursor in terms of modes, background agents, terminal agent, and `AGENTS.md` |
| Codex | `official` for `AGENTS.md`, `experimental` for some multi-agent features | Use layered `AGENTS.md` and any skill-local Codex metadata |

## Source Files

| Tool | Primary source files | Notes |
| --- | --- | --- |
| Claude | `agents/*.md` | Real Claude-facing subagent prompts |
| Cursor | `AGENTS.md` plus Cursor-native delegation surfaces | Shared `agents/*.md` are not proof of native Cursor consumption |
| Codex | `.codex/AGENTS.md`, Codex skill add-ons such as `codex-template/skills/<name>/agents/openai.yaml` where needed | Codex does not use the top-level Claude agent model directly |

## Example Files

Use these examples when you need the concrete file shape for each realization:

- Claude-native agent file: [examples/claude-agent.md](./examples/claude-agent.md)
- Cursor delegation realization: [examples/cursor-agent-realization.md](./examples/cursor-agent-realization.md)
- Codex delegation realization: [examples/codex-agent-realization.md](./examples/codex-agent-realization.md)

## Creation Model

### Claude

- Add `agents/<name>.md`.
- Include valid frontmatter with `model` and `tools`.
- Reference the agent from commands or docs only when the file exists.

Claude example:

- [examples/claude-agent.md](./examples/claude-agent.md)

### Cursor

- Do not frame `agents/*.md` as Cursor's native authoring format.
- If a workflow needs delegation in Cursor, document the intended behavior in Cursor-native terms and shared `AGENTS.md`.
- Keep any shared prompt asset language explicit that Claude is the direct consumer.

Cursor example:

- [examples/cursor-agent-realization.md](./examples/cursor-agent-realization.md)

### Codex

- Put repo-wide guidance in `.codex/AGENTS.md`.
- Put skill-specific Codex interface metadata inside the relevant skill add-on when needed.
- Do not invent a top-level Codex `agents/` story unless audited support changes.

Codex example:

- [examples/codex-agent-realization.md](./examples/codex-agent-realization.md)

## Key Differences

| Question | Claude | Cursor | Codex |
| --- | --- | --- | --- |
| Do `agents/*.md` map directly to the tool? | Yes | No | No |
| Is delegation still supported? | Yes | Yes | Yes, but realized differently |
| Primary MDT authoring surface | `agents/*.md` | `AGENTS.md` plus Cursor-native delegation model | layered `AGENTS.md` plus Codex-specific skill metadata |
| Common mistake | assuming parity is universal | describing Claude subagents as Cursor files | documenting Codex as instructions-only or as Claude-compatible subagents |

## Contributor Rules

- Use `agents/*.md` when the shared asset is genuinely part of the Claude realization.
- Use workflow docs and tool pages to explain how Cursor and Codex reach the same outcome differently.
- Separate "shared prompt asset" from "tool-native agent surface" in every doc that mentions agents.

## Short Version

- Claude: the `agents/*.md` file itself is the native tool-facing definition.
- Cursor: delegation is real, but the audited native realization is not "create an `agents/*.md` file and Cursor consumes it as a subagent definition".
- Codex: delegation is also real, but it is primarily expressed through layered `AGENTS.md` guidance and, when needed, skill-local Codex metadata.

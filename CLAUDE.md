# CLAUDE.md

This file is the Claude-specific entrypoint for working in this repository.

## Shared Repo Guidance

Read [AGENTS.md](AGENTS.md) first.

That file is the shared source of truth for:

- repo working rules
- development workflow
- testing and security expectations
- cross-tool documentation policy

## Claude-Specific Details

For durable Claude capability and integration details, use:

- [docs/tools/claude-code.md](docs/tools/claude-code.md)
- [docs/supported-tools.md](docs/supported-tools.md)

Claude-native note:

- `CLAUDE.md` is a real Claude guidance surface, so keep this file as a thin
  Claude entrypoint that points back to shared repo guidance rather than
  duplicating repository rules here.

## Project-Local Claude Config (`.claude/`)

The `.claude/` directory is **Claude Code session config for developers working
in this repo**. It is not part of what MDT installs for end-users.

| Path | Who it's for | Purpose |
|------|-------------|---------|
| `.claude/rules/` | Claude Code (dev) | Rules auto-loaded in every session in this repo |
| `.claude/skills/` | Claude Code (dev) | Project-local skill definitions for this repo |
| `.claude/settings.local.json` | Claude Code (dev) | Local session settings |
| `rules/` | MDT end-users | Installable rules shipped to users' tool configs |
| `skills/`, `agents/`, `commands/` | MDT end-users | Installable MDT content |

**Never** put dev-only Claude guidance into `rules/`, `skills/`, `agents/`, or
`commands/` at the repo root — those directories are MDT product output and get
installed into users' tool configs.

### `.claude/rules/` contents

- `context-mode.md` — when and how to use `ctx_execute` / `ctx_execute_file` in this repo
- `serena.md` — Serena MCP symbol navigation patterns for this repo

### `.claude/skills/` contents

- `context-mode/SKILL.md` — context-mode skill definition (copied from global plugin)
- `serena-mcp/SKILL.md` — Serena MCP skill definition (copied from `~/.claude/skills/serena-mcp/`)

## Verification

When changing code in this repo, use the normal repo verification flow unless
the task explicitly calls for something narrower:

```bash
npm run lint
npm test
npm run test:verbose
```

`npm test` writes detailed JSONL run artifacts under `.artifacts/logs/test-runs/` and only prints the actionable summary by default.

# CLAUDE.md

This file is the Claude Code entrypoint for projects using MDT.

## MDT Install

MDT is installed manually from the MDT repo.
For manual install verification, see `docs/tools/claude-code.md` in the MDT repo.

## MDT Guidance

MDT rules, commands, agents, and skills are installed globally via the plugin or
`mdt install`. The shared working rules are loaded from `~/.claude/rules/`,
commands from `~/.claude/commands/`, and agents from `~/.claude/agents/`.

## Verification

When changing code in this repo, use the normal repo verification flow unless
the task explicitly calls for something narrower:

```bash
npm run lint
npm test
```

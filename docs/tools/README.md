# MDT Tool Docs Pack

This directory is the authoritative reference for how MDT maps onto Claude Code, Cursor, Codex, and OpenCode.

It exists to prevent repeated web searches and prevent agents from guessing based on Claude-specific assumptions.

## What This Pack Covers

- Native feature names and config surfaces per tool
- Exact MDT-relevant differences for hooks, skills, commands, agents, rules, and memory
- Whether each claim is `official`, `experimental`, `repo-adapter`, or `unsupported`
- How to verify each claim locally on this machine

## Files

- [capability-matrix.md](./capability-matrix.md) - side-by-side comparison by MDT feature family
- [claude-code.md](./claude-code.md) - Claude Code reference target
- [cursor.md](./cursor.md) - Cursor IDE plus terminal agent
- [codex.md](./codex.md) - OpenAI Codex CLI
- [opencode.md](./opencode.md) - OpenCode config/plugin target
- [local-verification.md](./local-verification.md) - repeatable audit procedure

## Read Order

1. Read the matrix to identify the feature family.
2. Open the per-tool page for exact syntax, paths, limits, and repo mapping.
3. Use the verification playbook if the claim needs re-checking.

## Audit Baseline

Audit date: `2026-03-08`

Local tools seen on this machine:
- Claude Code `2.1.71`
- Cursor IDE `2.6.13`
- Cursor terminal agent present as `agent` on this machine, with `cursor-agent` also installed
- Codex CLI `0.111.0`
- OpenCode not installed locally

## Important Rule

Do not assume that a feature with the same name across tools has the same behavior.

Examples:
- Claude `hooks` are not the same thing as Codex automations.
- Codex slash commands are built-in session controls, not the same thing as Claude/MDT markdown prompt commands.
- Cursor `AGENTS.md`, rules, custom commands, memories, and background agents are official; MDT's `.cursor/hooks.json` path is still only a repo adapter unless Cursor documents it.

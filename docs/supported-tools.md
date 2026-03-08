# Supported Tools

This page is the entrypoint for MDT's audited tool-capability docs.

Use this when you need to answer:
- Can tool `X` do feature `Y`?
- What is the native surface called in that tool?
- Is MDT using an official vendor surface, an experimental adapter, or a repo-only convention?
- How can I verify the claim locally on this machine?

## Status Labels

- `official` - confirmed in vendor documentation during this audit
- `locally-verified` - confirmed on this machine with installed CLI/help output
- `experimental` - present in repo or tool, but not treated as stable/default
- `repo-adapter` - MDT-specific mapping layer, not a native vendor concept
- `unsupported` - do not assume this exists
- `not-locally-verified` - tool is not installed on this machine

## Start Here

- [Docs Pack Index](./tools/README.md)
- [Capability Matrix](./tools/capability-matrix.md)
- [Workflow Matrix](./tools/workflow-matrix.md)
- [Claude Code](./tools/claude-code.md)
- [Cursor](./tools/cursor.md)
- [Codex](./tools/codex.md)
- [OpenCode](./tools/opencode.md)
- [Local Verification Playbook](./tools/local-verification.md)

## Current Audit Summary

- Claude Code is the closest match to MDT's current structure: hooks, slash commands, subagents, skills, and `CLAUDE.md`/memory are all native concepts.
- Cursor officially supports rules, `AGENTS.md`, custom commands, memories, background agents, and a terminal agent/CLI. MDT's current `cursor-template/hooks.json` flow should be treated as `experimental` until Cursor documents that surface.
- Codex officially supports layered `AGENTS.md`, rule files, skills, and built-in slash commands. The repo currently underuses Codex by shipping only `config.toml` and `AGENTS.md`.
- OpenCode officially exposes config-driven `instructions`, `agent`, `command`, and `plugin` surfaces. It is not installed locally on this machine, so its page is `not-locally-verified`.

## Local Tool Versions Observed During This Audit

- Claude Code: `2.1.71`
- Cursor IDE: `2.6.13`
- Cursor terminal agent present: `agent` (with `cursor-agent` also installed locally here)
- Codex CLI: `0.111.0`
- OpenCode: not installed locally

## Source Policy

- Prefer these docs first when working in MDT.
- Use [Workflow Matrix](./tools/workflow-matrix.md) when the question is "how should MDT realize workflow X on tool Y?"
- If a page here is stale, use the verification workflow in [Local Verification Playbook](./tools/local-verification.md).
- Do not promote a claim from `experimental` or `repo-adapter` to `official` without checking vendor docs.

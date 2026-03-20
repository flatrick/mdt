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
- [Authoring Guide](./tools/authoring.md)
- [Capability Matrix](./tools/capability-matrix.md)
- [Workflow Matrix](./tools/workflow-matrix.md)
- [Claude Code](./tools/claude-code.md)
- [Cursor](./tools/cursor.md)
- [Codex](./tools/codex.md)
- [Local Verification Playbook](./tools/local-verification.md)

## Current Audit Summary

- Audit date: `2026-03-12`
- MDT is intended to stay tool-agnostic by default across Claude Code, Cursor, and Codex.
- Tool-specific differences should only be treated as first-class where a tool's native surface actually requires them.
- Repo-local layered `AGENTS.md` files are maintainer guidance for developing MDT itself; installed tool surfaces should only ship an `AGENTS.md` where the target tool actually uses one.
- Cursor remains a first-class MDT target, but Cursor IDE verification is manual and human-operated.
- Codex remains a first-class MDT target for layered guidance, rules, skills, and explicit verification flows.

## Local Tool Versions Observed During This Audit

- Claude Code: `2.1.73`
- Cursor Agent CLI: `2026.03.11-6dfa30c`
- Cursor IDE: `not-locally-verified` in this audit; use the manual verification page and stamp the human-tested version there
- Codex CLI: `0.114.0`

## Verification Method

- Local CLI probes were run for `claude`, `agent`, `cursor-agent`, and `codex`.
- Cursor IDE was not re-verified by CLI in this audit and should be treated as a manual verification surface.
- Exact tool-specific behavior lives in the tool docs pack under `docs/tools/`.

## Source Policy

- Prefer these docs first when working in MDT.
- Use [Workflow Matrix](./tools/workflow-matrix.md) when the question is "how should MDT realize workflow X on tool Y?"
- If a page here is stale, use the verification workflow in [Local Verification Playbook](./tools/local-verification.md).
- Do not promote a claim from `experimental` or `repo-adapter` to `official` without checking vendor docs.

# MDT Tool Docs Pack

This directory is the authoritative reference for how MDT maps onto Claude Code, Cursor, and Codex.

Use this pack when you need current truth about:
- native tool surfaces
- MDT-specific adapters
- local verification status
- exact differences between tools

## Files

- [capability-matrix.md](./capability-matrix.md) - side-by-side capability view
- [workflow-matrix.md](./workflow-matrix.md) - workflow realization by tool
- [claude-code.md](./claude-code.md) - Claude Code reference page
- [claude-code.dev.md](./claude-code.dev.md) - Claude Code developer setup for working on MDT itself (Serena shared instance, rg/fd, .claude/ config)
- [cursor.md](./cursor.md) - Cursor Agent and Cursor IDE notes
- [codex.md](./codex.md) - Codex CLI reference page
- [local-verification.md](./local-verification.md) - local verification playbook

## Audit Baseline

Audit date: `2026-03-12`

Tested with version:
- Claude Code `2.1.73`
- Cursor Agent CLI `2026.03.11-6dfa30c`
- `cursor-agent` `2026.03.11-6dfa30c`
- Cursor IDE `not-locally-verified` in this audit; use the manual verification page and stamp the human-tested version there
- Codex CLI `0.114.0`

## Read Order

1. Read the matrix to identify the feature family.
2. Read the workflow matrix for intended MDT behavior.
3. Read the per-tool page for exact paths and limits.
4. Use the local verification playbook when you need to refresh a claim.

## Important Rule

Do not assume that a feature with the same name across tools has the same behavior.

Examples:
- Claude hooks are not the same thing as Codex automations.
- Codex slash commands are built-in session controls, not markdown workflow prompts.
- Cursor IDE verification is manual and human-operated even though Cursor Agent has a CLI.
- Every environment-specific verification claim in this docs pack should include the tested version or an explicit `not-locally-verified` label.

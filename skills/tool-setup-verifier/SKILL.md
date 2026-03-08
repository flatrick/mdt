---
name: tool-setup-verifier
description: Verify MDT's shipped Claude, Cursor, Codex, and OpenCode setups against the local workflow contract. Use when auditing tool support, checking whether setup files still exist, validating workflow coverage, or producing a per-tool readiness report without relying on GitHub Actions or live model calls.
---

# Tool Setup Verifier

## When to Use

Use this skill when auditing MDT's local tool adapters, validating documented workflow coverage, or producing a per-tool readiness report without relying on CI or live model calls.

Use this skill to verify that MDT's documented workflows still map cleanly onto the shipped tool adapters.

## Source Of Truth

Read these first:

1. `docs/supported-tools.md`
2. `docs/tools/workflow-matrix.md`
3. `scripts/lib/tool-workflow-contract.js`

Treat the docs pack as the human-readable source of truth and the JS contract as the machine-readable enforcement surface.

## Required Workflow

1. Run `node scripts/verify-tool-setups.js`.
2. If the relevant CLIs are installed locally, run `node scripts/smoke-tool-setups.js`.
3. For deeper Codex coverage, run `node scripts/smoke-codex-workflows.js`.
4. Summarize results by workflow and by tool.
5. If something fails, identify the missing file, stale doc claim, or broken local probe before proposing broader changes.

## Reporting Format

Return a concise matrix that includes:

- workflow
- tool
- support status: `official`, `repo-adapter`, `experimental`, or `unsupported`
- contract status: `PASS` or `FAIL`
- smoke status: `PASS`, `SKIP`, or `FAIL`
- known limitation
- next fix

Also include:

- overall setup status per tool
- top 3 remediation items with exact file paths

## Rules

- Do not rely on GitHub Actions or CI for this workflow.
- Do not require authentication, network access, or a live model session to count a local smoke check as useful.
- If a tool is not installed locally, mark its smoke status as `SKIP`.
- Do not promote a workflow claim to `official` unless the docs pack already supports that classification.
- If the docs and the contract disagree, fix the disagreement before expanding scope.

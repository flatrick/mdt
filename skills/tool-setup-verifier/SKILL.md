---
name: tool-setup-verifier
description: Verify MDT's shipped Claude, Cursor, Codex, and OpenCode setups against the local workflow contract. Use when auditing tool support, checking whether setup files still exist, validating workflow coverage, or producing a per-tool readiness report without relying on GitHub Actions or live model calls.
---

# Tool Setup Verifier

## When to Use

Use this skill when auditing MDT's local tool adapters, validating documented workflow coverage, or producing a per-tool readiness report without relying on CI or live model calls.

Use this skill to verify that MDT's documented workflows still map cleanly onto the shipped tool adapters.

## Source Of Truth

Choose the right mode first:

### MDT repo mode

Use this when the current repo contains:

- `docs/tools/capability-matrix.md`
- `docs/tools/workflow-matrix.md`
- `scripts/lib/tool-workflow-contract.js`

Read these first:

1. `docs/tools/capability-matrix.md`
2. `docs/tools/workflow-matrix.md`
3. `scripts/lib/tool-workflow-contract.js`

Treat the docs pack as the human-readable source of truth and the JS contract as
the machine-readable enforcement surface.

### Installed target repo mode

Use this when the current repo only has installed Codex assets such as:

- `.codex/skills/`
- `.codex/scripts/`
- project `.codex/`

and does **not** have the full MDT docs pack at repo root.

In that mode:

1. read `.codex/skills/tool-setup-verifier/SKILL.md`
2. read `.codex/scripts/lib/tool-workflow-contract.js`
3. treat `~/.codex/` plus the local `.codex/` tree as the install surface
4. do **not** fail just because `docs/tools/*` or `scripts/verify-tool-setups.js`
   are absent at repo root

## Required Workflow

### MDT repo mode

1. Run `node scripts/verify-tool-setups.js`.
2. If the relevant CLIs are installed locally, run `node scripts/smoke-tool-setups.js`.
3. For deeper Codex coverage, run `node scripts/smoke-codex-workflows.js`.
4. Summarize results by workflow and by tool.
5. If something fails, identify the missing file, stale doc claim, or broken local probe before proposing broader changes.

### Installed target repo mode

1. Run `node .codex/scripts/smoke-tool-setups.js`.
2. Run `node .codex/scripts/smoke-codex-workflows.js`.
3. Summarize Codex readiness from the installed project/user surfaces only.
4. If something fails, identify the missing installed skill, missing local script,
   or missing `~/.codex/` file before proposing broader changes.

## Local Prerequisites

- `node` must be installed and available on `PATH`
- tool smoke probes require a local shell/session that allows subprocess spawn
- if `smoke-tool-setups.js` reports `SKIP` with `EPERM` or `EACCES`, treat that
  as an environment limitation, not as proof that the tool is missing or broken
- in that case, rely on workflow smoke plus direct local invocation in a less
  restricted shell before claiming the tool setup is broken

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
- In installed target repo mode, do not report false failures just because the
  full MDT repo docs pack is not present.

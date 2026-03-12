# MDT Workflow Matrix

This page is the human-readable view of MDT's machine-readable workflow contracts under [workflow-contracts/](../../workflow-contracts/). It defines the intended MDT workflows, the repo artifacts that enable them, and how each supported tool is expected to realize the same outcome.

Use this together with [capability-matrix.md](./capability-matrix.md) and the per-tool pages. The capability matrix explains native surfaces; this page explains the MDT behaviors those surfaces are expected to support.

## Status Labels

- `official` - MDT is using a vendor-documented native surface for this workflow
- `repo-adapter` - MDT is mapping the workflow onto the tool using repo-defined instructions or configuration
- `experimental` - available in the repo, but not treated as stable/default
- `unsupported` - no supported MDT mapping exists

## Core Workflows

| Workflow | Intended Outcome | Claude | Cursor | Codex |
| --- | --- | --- | --- | --- |
| `plan` | Break work into phases, risks, and concrete implementation steps before execution. | `official` via [commands/plan.md](../../commands/plan.md) and [agents/planner.md](../../agents/planner.md) | `repo-adapter` via [cursor-template/commands/plan.md](../../cursor-template/commands/plan.md), [AGENTS.md](../../AGENTS.md), and [common-development-workflow.md](../../cursor-template/rules/common-development-workflow.md) | `repo-adapter` via [AGENTS.md](../../codex-template/AGENTS.md) and [config.toml](../../codex-template/config.toml) |
| `tdd` | Write failing tests first, implement the minimum change, then refactor with verification. | `official` via [commands/tdd.md](../../commands/tdd.md), [agents/tdd-guide.md](../../agents/tdd-guide.md), and [skills/tdd-workflow/SKILL.md](../../skills/tdd-workflow/SKILL.md) | `repo-adapter` via [cursor-template/commands/tdd.md](../../cursor-template/commands/tdd.md), [AGENTS.md](../../AGENTS.md), and [common-testing.md](../../cursor-template/rules/common-testing.md) | `repo-adapter` via [AGENTS.md](../../codex-template/AGENTS.md), [config.toml](../../codex-template/config.toml), and [tdd-workflow](../../codex-template/skills/tdd-workflow/SKILL.md) materialized into `~/.codex/skills/` |
| `code-review` | Review changes for correctness, regressions, and missing tests before sign-off. | `official` via [commands/code-review.md](../../commands/code-review.md) and [agents/code-reviewer.md](../../agents/code-reviewer.md) | `repo-adapter` via [cursor-template/commands/code-review.md](../../cursor-template/commands/code-review.md), [AGENTS.md](../../AGENTS.md), and [common-coding-style.md](../../cursor-template/rules/common-coding-style.md) | `repo-adapter` via [AGENTS.md](../../codex-template/AGENTS.md) and [config.toml](../../codex-template/config.toml) |
| `verify` | Run targeted validation and summarize whether the current change is safe to ship. | `official` via [commands/verify.md](../../commands/verify.md) and [skills/verification-loop/SKILL.md](../../skills/verification-loop/SKILL.md) | `repo-adapter` via [cursor-template/commands/verify.md](../../cursor-template/commands/verify.md), [AGENTS.md](../../AGENTS.md), and [common-testing.md](../../cursor-template/rules/common-testing.md) | `repo-adapter` via [AGENTS.md](../../codex-template/AGENTS.md), [config.toml](../../codex-template/config.toml), and [verification-loop](../../codex-template/skills/verification-loop/SKILL.md) materialized into `~/.codex/skills/` |
| `smoke` | Run a quick sanity check that MDT is installed and the tool-specific workflow surfaces are present. | `official` via [commands/smoke.md](../../commands/smoke.md), [smoke-claude-workflows.js](../../scripts/smoke-claude-workflows.js), and [claude-code.md](../../docs/testing/manual-verification/claude-code.md) | `repo-adapter` via [cursor-template/commands/smoke.md](../../cursor-template/commands/smoke.md) and [cursor.md](../../docs/testing/manual-verification/cursor.md) | `repo-adapter` via [smoke](../../codex-template/skills/smoke/SKILL.md), [codex.md](../../docs/testing/manual-verification/codex.md), and the local smoke scripts |
| `security` | Apply security review guidance before committing changes that touch trust boundaries or secrets. | `official` via [agents/security-reviewer.md](../../agents/security-reviewer.md) and [skills/security-review/SKILL.md](../../skills/security-review/SKILL.md) | `repo-adapter` via [AGENTS.md](../../AGENTS.md) and [common-security.md](../../cursor-template/rules/common-security.md) | `repo-adapter` via [AGENTS.md](../../codex-template/AGENTS.md), [config.toml](../../codex-template/config.toml), and [security-review](../../codex-template/skills/security-review/SKILL.md) materialized into `~/.codex/skills/` |
| `e2e` | Exercise critical end-to-end user flows when the change affects workflow behavior. | `official` via [commands/e2e.md](../../commands/e2e.md), [agents/e2e-runner.md](../../agents/e2e-runner.md), and [skills/e2e-testing/SKILL.md](../../skills/e2e-testing/SKILL.md) | `repo-adapter` via [AGENTS.md](../../AGENTS.md) and [common-testing.md](../../cursor-template/rules/common-testing.md) | `repo-adapter` via [AGENTS.md](../../codex-template/AGENTS.md), [config.toml](../../codex-template/config.toml), and [e2e-testing](../../codex-template/skills/e2e-testing/SKILL.md) materialized into `~/.codex/skills/` |

## Local Verification Method

For each workflow/tool mapping:

1. Run `node scripts/verify-tool-setups.js` to verify that the documented files still exist and this matrix still matches the machine-readable workflow contracts in `workflow-contracts/`.
2. Run `node scripts/smoke-tool-setups.js` when you want a local CLI probe for installed tools.
3. If a tool is not installed locally, record the smoke result as `SKIP` instead of guessing.

## Scope Notes

- This page is intentionally limited to MDT's core workflows.
- It does not claim full feature parity across tools.
- Codex support in this page refers to the current MDT setup built around `codex-template/AGENTS.md`, `codex-template/config.toml`, `codex-template/skills/`, and package-selected assets materialized into `~/.codex/`.
- Tool-native terms like `command`, `skill`, `rule`, `hook`, and `guidance` are implementation surfaces, not the primary concept; the shared workflow outcome in `workflow-contracts/` is the source of truth.

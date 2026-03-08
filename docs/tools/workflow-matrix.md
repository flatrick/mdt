# MDT Workflow Matrix

This page defines the intended MDT workflows, the repo artifacts that enable them, and how each supported tool is expected to realize the same outcome.

Use this together with [capability-matrix.md](./capability-matrix.md) and the per-tool pages. The capability matrix explains native surfaces; this page explains the MDT behaviors those surfaces are expected to support.

## Status Labels

- `official` - MDT is using a vendor-documented native surface for this workflow
- `repo-adapter` - MDT is mapping the workflow onto the tool using repo-defined instructions or configuration
- `experimental` - available in the repo, but not treated as stable/default
- `unsupported` - no supported MDT mapping exists

## Core Workflows

| Workflow | Intended Outcome | Claude | Cursor | Codex | OpenCode |
| --- | --- | --- | --- | --- | --- |
| `plan` | Break work into phases, risks, and concrete implementation steps before execution. | `official` via [commands/plan.md](../../commands/plan.md) and [agents/planner.md](../../agents/planner.md) | `repo-adapter` via [AGENTS.md](../../AGENTS.md) and [common-development-workflow.md](../../cursor-template/rules/common-development-workflow.md) | `repo-adapter` via [AGENTS.md](../../codex-template/AGENTS.md) and [config.toml](../../codex-template/config.toml) | `official` via [plan.md](../../.opencode/commands/plan.md) and [planner.txt](../../.opencode/prompts/agents/planner.txt) |
| `tdd` | Write failing tests first, implement the minimum change, then refactor with verification. | `official` via [commands/tdd.md](../../commands/tdd.md), [agents/tdd-guide.md](../../agents/tdd-guide.md), and [skills/tdd-workflow/SKILL.md](../../skills/tdd-workflow/SKILL.md) | `repo-adapter` via [AGENTS.md](../../AGENTS.md) and [common-testing.md](../../cursor-template/rules/common-testing.md) | `repo-adapter` via [AGENTS.md](../../codex-template/AGENTS.md) and [.agents/skills/tdd-workflow/SKILL.md](../../.agents/skills/tdd-workflow/SKILL.md) | `official` via [tdd.md](../../.opencode/commands/tdd.md) and [tdd-guide.txt](../../.opencode/prompts/agents/tdd-guide.txt) |
| `code-review` | Review changes for correctness, regressions, and missing tests before sign-off. | `official` via [commands/code-review.md](../../commands/code-review.md) and [agents/code-reviewer.md](../../agents/code-reviewer.md) | `repo-adapter` via [AGENTS.md](../../AGENTS.md) and [common-coding-style.md](../../cursor-template/rules/common-coding-style.md) | `repo-adapter` via [AGENTS.md](../../codex-template/AGENTS.md) and [config.toml](../../codex-template/config.toml) | `official` via [code-review.md](../../.opencode/commands/code-review.md) and [code-reviewer.txt](../../.opencode/prompts/agents/code-reviewer.txt) |
| `verify` | Run targeted validation and summarize whether the current change is safe to ship. | `official` via [commands/verify.md](../../commands/verify.md) and [skills/verification-loop/SKILL.md](../../skills/verification-loop/SKILL.md) | `repo-adapter` via [AGENTS.md](../../AGENTS.md) and [common-testing.md](../../cursor-template/rules/common-testing.md) | `repo-adapter` via [AGENTS.md](../../codex-template/AGENTS.md) and [.agents/skills/verification-loop/SKILL.md](../../.agents/skills/verification-loop/SKILL.md) | `official` via [verify.md](../../.opencode/commands/verify.md) and [run-tests.ts](../../.opencode/tools/run-tests.ts) |
| `security` | Apply security review guidance before committing changes that touch trust boundaries or secrets. | `official` via [agents/security-reviewer.md](../../agents/security-reviewer.md) and [skills/security-review/SKILL.md](../../skills/security-review/SKILL.md) | `repo-adapter` via [AGENTS.md](../../AGENTS.md) and [common-security.md](../../cursor-template/rules/common-security.md) | `repo-adapter` via [AGENTS.md](../../codex-template/AGENTS.md) and [.agents/skills/security-review/SKILL.md](../../.agents/skills/security-review/SKILL.md) | `official` via [security.md](../../.opencode/commands/security.md), [security-reviewer.txt](../../.opencode/prompts/agents/security-reviewer.txt), and [security-audit.ts](../../.opencode/tools/security-audit.ts) |
| `e2e` | Exercise critical end-to-end user flows when the change affects workflow behavior. | `official` via [commands/e2e.md](../../commands/e2e.md), [agents/e2e-runner.md](../../agents/e2e-runner.md), and [skills/e2e-testing/SKILL.md](../../skills/e2e-testing/SKILL.md) | `repo-adapter` via [AGENTS.md](../../AGENTS.md) and [common-testing.md](../../cursor-template/rules/common-testing.md) | `repo-adapter` via [AGENTS.md](../../codex-template/AGENTS.md) and [.agents/skills/e2e-testing/SKILL.md](../../.agents/skills/e2e-testing/SKILL.md) | `official` via [e2e.md](../../.opencode/commands/e2e.md) and [e2e-runner.txt](../../.opencode/prompts/agents/e2e-runner.txt) |

## Local Verification Method

For each workflow/tool mapping:

1. Run `node scripts/verify-tool-setups.js` to verify that the documented files still exist and the workflow matrix still matches the machine-readable contract.
2. Run `node scripts/smoke-tool-setups.js` when you want a local CLI probe for installed tools.
3. If a tool is not installed locally, record the smoke result as `SKIP` instead of guessing.

## Scope Notes

- This page is intentionally limited to MDT's core workflows.
- It does not claim full feature parity across tools.
- OpenCode is verified here as a repo adapter, not as an `install-mdt` target.
- Codex support in this page refers to the current MDT setup built around `codex-template/AGENTS.md`, `codex-template/config.toml`, and Codex-readable skill content under `.agents/skills/`.

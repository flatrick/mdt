# Harness Audit Command

Audit the current repository's agent harness setup and return a prioritized scorecard.

## Usage

`/harness-audit [scope] [--format text|json]`

- `scope` (optional): `repo` (default), `hooks`, `skills`, `commands`, `agents`, `setup`
- `--format`: output style (`text` default, `json` for automation)

## What to Evaluate

Score each category from `0` to `10`:

1. Tool Coverage
2. Context Efficiency
3. Quality Gates
4. Memory Persistence
5. Eval Coverage
6. Security Guardrails
7. Cost Efficiency

## Output Contract

Return:

1. `overall_score` out of 70
2. Category scores and concrete findings
3. Top 3 actions with exact file paths
4. Suggested MDT skills to apply next

For `setup` scope, return:

1. Per-workflow coverage across Claude, Cursor, Codex, and OpenCode
2. Deterministic contract status from `node scripts/verify-tool-setups.js`
3. Optional local smoke status from `node scripts/smoke-tool-setups.js`
4. Top 3 setup fixes with exact file paths

## Checklist

- Inspect `hooks/hooks.json`, `scripts/hooks/`, and hook tests.
- Inspect `skills/`, command coverage, and agent coverage.
- Verify cross-harness parity for `cursor-template/`, `.opencode/`, and `codex-template/`.
- Flag broken or stale references.
- For `setup` scope, use `skills/tool-setup-verifier/SKILL.md`, `docs/tools/workflow-matrix.md`, and `scripts/lib/tool-workflow-contract.js`.

## Example Result

```text
Harness Audit (repo): 52/70
- Quality Gates: 9/10
- Eval Coverage: 6/10
- Cost Efficiency: 4/10

Top 3 Actions:
1) Add cost tracking hook in scripts/hooks/cost-tracker.js
2) Add pass@k docs and templates in skills/eval-harness/SKILL.md
3) Add command parity for /harness-audit in .opencode/commands/
```

## Arguments

$ARGUMENTS:
- `repo|hooks|skills|commands|agents|setup` (optional scope)
- `--format text|json` (optional output format)

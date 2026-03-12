---
name: code-review
description: Review the current diff for correctness, regressions, weak tests, and security or performance risk.

---

# Code Review Command

Use this command to review the current uncommitted or in-branch change set.

## Review Focus

Prioritize findings in this order:

1. Correctness bugs
2. Behavioral regressions
3. Missing or weak tests
4. Security risks
5. Performance or maintainability issues

## Review Workflow

1. Identify changed files.
2. Inspect the diff, not just final file state.
3. Look for:
   - broken assumptions
   - missing validation
   - incorrect edge-case handling
   - fragile or absent tests
   - misleading docs or contracts
4. Report findings ordered by severity.

## Required Output

Report findings first with:
- severity
- file reference
- clear explanation of the issue
- why it matters

If no findings are present, state that explicitly and mention any residual risk or testing gap.

## Required Behavior

- Do not pad with praise.
- Do not approve changes that still have high-risk issues.
- Keep the summary brief after the findings.
- Prefer concrete, defensible findings over broad style commentary.

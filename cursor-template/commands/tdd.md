---
name: tdd
description: Enforce a test-driven development workflow: write failing tests first, implement the minimum fix, then refactor with tests green.
---

# TDD Command

Use this command to enforce the MDT red-green-refactor workflow.

## What This Command Does

1. Define the interface or expected behavior.
2. Write tests first.
3. Verify the new tests fail for the right reason.
4. Implement the minimum code to make them pass.
5. Refactor while keeping tests green.
6. Check coverage and add tests if needed.

## When to Use

Use `tdd` when:
- implementing a new feature
- fixing a bug
- refactoring behavior with regression risk
- adding core business logic
- changing code that should remain well-covered

## Required Workflow

1. **RED**
   - write a failing test first
   - explain why it should fail
2. **GREEN**
   - implement the smallest change that makes the test pass
3. **REFACTOR**
   - improve readability or structure without breaking tests
4. **VERIFY**
   - rerun the relevant tests
   - report current coverage if available

## Required Behavior

- Do not skip the failing-test step.
- Prefer behavior-focused tests over implementation-detail tests.
- Add edge cases and error cases where the change justifies them.
- If the repo already has testing conventions, follow them.
- If tests cannot be run, say so explicitly and explain why.

## Response Structure

Use a concise flow like:

```md
# TDD Session

## Interface / Expected Behavior
- ...

## RED
- test file(s):
- expected failure:

## GREEN
- implementation plan:

## REFACTOR
- cleanup opportunities:

## VERIFY
- tests to run:
- coverage expectations:
```

## Quality Bar

- tests first
- minimal implementation
- no silent regressions
- maintain or improve coverage

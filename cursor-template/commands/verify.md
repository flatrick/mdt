---
name: verify
description: Run targeted verification on the current change and decide whether it is safe to ship.
---

# Verification Command

Use this command to verify the current codebase state after a change.

## Verification Order

Execute checks in this order when they exist for the repo:

1. Build check
2. Type check
3. Lint check
4. Targeted or full test suite
5. Console logging / debug artifact audit
6. Git status and changed-files review

## How To Adapt

- Run only the checks that are relevant and available in this repository.
- Prefer targeted checks first if the change is narrow.
- If a blocking check fails, report it clearly before moving on.
- If a check cannot run, say that explicitly instead of assuming success.

## Output Format

Produce a concise report like:

```text
VERIFICATION: PASS|FAIL

Build:    OK|FAIL
Types:    OK|X errors|N/A
Lint:     OK|X issues|N/A
Tests:    X/Y passed|FAIL|N/A
Logs:     OK|X findings
Git:      clean|dirty

Ready for PR: YES|NO
```

## Required Behavior

- Summarize concrete failures with file references where possible.
- Do not mark a change as ready if critical checks failed.
- Call out missing verification separately from passing verification.
- Prefer evidence over guesswork.

## Arguments

Support these modes when the user asks for them:
- `quick` for build plus types
- `full` for the full relevant suite
- `pre-commit` for checks needed before a commit
- `pre-pr` for full verification plus any available security scan

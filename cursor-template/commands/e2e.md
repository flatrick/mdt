---
name: e2e
description: Generate and run end-to-end tests with Playwright using Page Object Model. Creates test journeys, runs tests, and captures artifacts on failure.

---

# E2E Command

Use this command to create and execute end-to-end tests for critical user flows.

## What This Command Does

1. Identify user journeys to test.
2. Generate Playwright tests using Page Object Model.
3. Run tests and capture artifacts on failure.
4. Report results and flag flaky tests.

## When to Use

Use `e2e` when:
- testing critical multi-step user flows
- verifying frontend and backend integration
- validating UI interactions and navigation
- preparing for production deployment

## Required Workflow

1. **IDENTIFY**
   - list the user journeys to cover
   - prioritize by risk and frequency
2. **GENERATE**
   - write Page Object Model classes for each page involved
   - write test scenarios covering the happy path and key failure cases
3. **RUN**
   - execute with `npx playwright test`
   - capture screenshots, videos, and traces on failure
4. **REPORT**
   - summarize pass/fail counts
   - flag any flaky tests with a quarantine recommendation

## Required Behavior

- Use Page Object Model — keep selectors in page classes, not test bodies.
- Prefer `data-testid` selectors over CSS classes or text content.
- Wait for network responses or state changes instead of fixed timeouts.
- Never run tests that involve real money or destructive actions against production.
- If Playwright is not installed, say so and show the install command.

## Artifact Handling

On failure:
- screenshot of the failing state
- video recording of the run
- trace file for step-by-step replay

On success:
- HTML report at `playwright-report/index.html`

View artifacts:
```bash
npx playwright show-report
npx playwright show-trace <trace-file>
```

## Quality Bar

- critical flows covered
- no brittle selectors
- no arbitrary `sleep` or fixed-timeout waits
- flaky tests quarantined, not ignored

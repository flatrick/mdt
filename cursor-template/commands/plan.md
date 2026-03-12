---
name: plan
description: Restate requirements, assess risks, and create a step-by-step implementation plan. Wait for user confirmation before touching code.

---

# Plan Command

Use this command to produce a concrete implementation plan before writing code.

## What This Command Does

1. Restate the request and constraints in clear terms.
2. Identify risks, blockers, and dependencies.
3. Break the work into specific implementation phases.
4. Wait for explicit user confirmation before making code changes.

## When to Use

Use `plan` when:
- starting a new feature
- making significant architectural changes
- working on a complex refactor
- touching multiple files or systems
- requirements or scope are unclear

## How To Respond

Produce a concise planning response with:

1. Requirements restatement
2. Scope and assumptions
3. Implementation phases
4. Risks and dependencies
5. Estimated complexity
6. A clear confirmation gate such as `WAITING FOR CONFIRMATION`

## Required Behavior

- Do not write code yet.
- Do not edit files yet.
- Do not run destructive commands.
- If the user wants changes to the plan, revise the plan first.
- Only proceed to implementation after an explicit approval such as `yes`, `proceed`, or equivalent.

## Example Structure

```md
# Implementation Plan

## Requirements Restatement
- ...

## Scope And Assumptions
- ...

## Implementation Phases
1. ...
2. ...

## Risks And Dependencies
- ...

## Estimated Complexity
- ...

WAITING FOR CONFIRMATION
```

## Follow-Up

After the user confirms the plan:
- use `tdd` for implementation workflow
- use `verify` before calling the change ready
- use `code-review` on the resulting diff

---
name: skill-create
description: Turn a repeated workflow or solution pattern into a reusable MDT skill definition.

---

# Skill Creation Command

Use this command to draft a reusable MDT skill from a repeated workflow, pattern, or debugging approach.

## What A Good Skill Should Capture

1. When to use the skill
2. The problem it solves
3. The workflow steps to follow
4. Inputs, constraints, and guardrails
5. A few concrete examples

## Response Structure

Draft the skill in a form close to a real `SKILL.md`:

```md
# Skill Name

## When to Use
...

## Problem
...

## Workflow
1. ...
2. ...

## Examples
...
```

## Required Behavior

- Prefer one focused skill over a vague umbrella skill.
- Only extract durable patterns, not one-off fixes.
- Keep the instructions concrete enough that another agent could follow them.
- If the pattern is not yet stable, say so and propose a draft rather than pretending it is finalized.

## Good Candidates

- repeated verification workflows
- recurring debugging patterns
- project-specific integration playbooks
- language or tool onboarding patterns

# Smoke Command

Run a lightweight MDT sanity check for the current tool and workspace.

## Goal

Use this command for a quick confidence check, not a full verification pass.

It should answer:

- is MDT installed where this tool expects it?
- are the core workflow surfaces present?
- is one representative runtime-specific feature wired correctly?
- what should be tested next if anything looks incomplete?

## What To Check

Keep the check short and tool-aware.

### Claude Code

Check for:

1. `.claude/` install exists for this project or the active global config
2. core MDT assets are present:
   - commands
   - agents
   - skills
   - hooks/runtime scripts
3. one quick runtime-specific signal:
   - hook config exists
   - continuous-learning storage path resolves
   - session/runtime files can be described correctly

### Cursor

Check for:

1. `.cursor/` install exists for this project
2. core MDT assets are present:
   - rules
   - skills
   - custom commands
   - `AGENTS.md`
3. one quick runtime-specific signal:
   - hook config exists or was intentionally skipped
   - continuous-learning storage resolves under `.cursor/`
   - session/runtime paths are understood correctly

## Output Format

Produce a short report like:

```text
SMOKE: PASS|FAIL|PARTIAL

Tool:      claude|cursor
Install:   OK|MISSING
Guidance:  OK|MISSING
Commands:  OK|MISSING|N/A
Runtime:   OK|SKIPPED|FAIL

Next step: ...
```

## Required Behavior

- prefer fast checks over exhaustive checks
- do not run the full test suite unless the user explicitly asks
- clearly separate `missing`, `skipped`, and `failed`
- if the install is absent, say exactly what reinstall command to run
- if runtime behavior cannot be proven from the current session, say what manual step to do next

## Suggested Follow-Up

- use `verify` for deeper repo validation
- use the manual verification docs for tool-specific runtime checks

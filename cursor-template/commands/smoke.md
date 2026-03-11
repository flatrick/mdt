---
name: smoke
description: Run a quick MDT sanity check for the current Cursor workspace.
---

# Smoke Command

Use this command for a fast Cursor-specific MDT sanity check.

## Goal

Confirm that the current workspace has the expected MDT surfaces without turning
the check into a full verification run.

Before reporting status, inspect the relevant paths directly in the workspace.
Do not guess from prior context.

## What To Check

1. `~/.cursor/` install exists
2. core project guidance is present:
   - `~/.cursor/rules/`
   - `~/.cursor/skills/`
   - `~/.cursor/commands/`
   - repo-root `AGENTS.md`
3. one runtime-specific signal:
   - `~/.cursor/hooks.json` exists, or hook install was intentionally skipped
   - continuous-learning storage resolves under `~/.cursor/mdt/`
   - session/runtime paths are described correctly

Important runtime rule:

- `~/.cursor/mdt/homunculus/` is created lazily after relevant continuous-learning
  activity
- if install paths such as `~/.cursor/`, `~/.cursor/rules/`, `~/.cursor/skills/`, or
  `~/.cursor/commands/` exist on disk, do not report them as `MISSING`
- if `~/.cursor/mdt/homunculus/` does not exist yet but the install is otherwise
  present, report runtime as `PARTIAL`, not `FAIL`, and tell the user to trigger
  an edit or shell command before checking again

## Preferred Output

```text
SMOKE: PASS|FAIL|PARTIAL

Install:   OK|MISSING
Rules:     OK|MISSING
Skills:    OK|MISSING
Commands:  OK|MISSING
Runtime:   OK|PARTIAL|SKIPPED|FAIL

Next step: ...
```

## Required Behavior

- keep the check short
- prefer concrete file/path evidence
- cite the path you inspected when reporting `MISSING` or `FAIL`
- do not claim hook runtime behavior is working unless the current session proves it
- if `~/.cursor/` is missing or stale, recommend a fresh install command
- if hooks are absent, distinguish between `skipped intentionally` and `not installed`

## Useful Follow-Up

- use `verify` for deeper validation
- use the Cursor manual verification checklist for runtime behavior beyond this smoke pass

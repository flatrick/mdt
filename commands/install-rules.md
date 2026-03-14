---
name: install-rules
description: Copy the installed global Cursor rules into the current repo's `.cursor/rules/` bridge.

---

# Install Rules Command

Use this command when the current workspace should get a repo-local
`.cursor/rules/` copy of the rules already installed under `~/.cursor/rules/`.

## Goal

Materialize the current global Cursor rule set into the opened repo so Cursor
IDE can read repo-local rules from `.cursor/rules/`.

## Required Behavior

1. Confirm the current workspace root first.
2. Run the installed MDT bridge script from the global Cursor install:

```bash
node ~/.cursor/mdt/scripts/mdt.js bridge materialize --tool cursor --surface rules
```

3. Report:
   - the repo path used
   - the destination `.cursor/rules/` path
   - the files copied

## Constraints

- Do not guess package names for this command.
- Copy from the installed global `~/.cursor/rules/` surface.
- If the global Cursor rules directory is missing, report that MDT is not fully
  installed under `~/.cursor/` and tell the user to run:

```bash
mdt install --tool cursor <package...>
```

- If the repo cannot be detected, stop and report that clearly.

## Follow-Up

- Use this after a normal Cursor install when Cursor IDE needs repo-local rules
  in the current workspace.
- Do not describe this as replacing the global `~/.cursor/` install.

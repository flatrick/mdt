---
name: projects
description: List known projects and their instinct statistics
command: true
---

# Projects Command

List project registry entries and per-project instinct/observation counts for continuous-learning-manual.

## Implementation

Run the project-installed Cursor instinct CLI:

```bash
node ".cursor/skills/continuous-learning-manual/scripts/instinct-cli.js" projects
```

For a user/global Cursor install, replace `.cursor` with `~/.cursor`.

Do not fall back to other tool directories such as `~/.claude`, `~/.codex`,
repo `skills/...`, or `${MDT_ROOT}/...`. If the Cursor-installed path is
missing, report the install as incomplete.

---
name: projects
description: List known projects and their instinct statistics
command: true
---

# Projects Command

List project registry entries and per-project instinct/observation counts for continuous-learning-manual.

## Implementation

Run the globally installed Cursor instinct CLI:

```bash
node "<config>/skills/continuous-learning-manual/scripts/instinct-cli.js" projects
```

Default `<config>` is `~/.cursor`. If your Cursor config root is overridden, use that instead.

Do not fall back to other tool directories such as `~/.claude`, `~/.codex`,
repo `skills/...`, or `${MDT_ROOT}/...`. If the Cursor-installed path is
missing, report the install as incomplete.

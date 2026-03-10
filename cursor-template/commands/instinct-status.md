---
name: instinct-status
description: Show learned instincts (project + global) with confidence
command: true
---

# Instinct Status Command

Shows learned instincts for the current project plus global instincts, grouped by domain.

## Implementation

Run the project-installed Cursor instinct CLI:

```bash
node ".cursor/skills/continuous-learning-manual/scripts/instinct-cli.js" status
```

For a user/global Cursor install, replace `.cursor` with `~/.cursor`.

Do not fall back to:

- `skills/...`
- `${MDT_ROOT}/...`
- `~/.claude/...`
- `~/.codex/...`
- any other tool directory

If `.cursor/skills/continuous-learning-manual/scripts/instinct-cli.js` does not
exist in the current project, report that the Cursor project install is missing
or incomplete instead of guessing another path.

## Usage

```
/instinct-status
```

## What to Do

1. Detect current project context
2. Read project instincts from `.cursor/homunculus/projects/<project-id>/instincts/`
3. Read global instincts from `.cursor/homunculus/instincts/`
4. Merge with precedence rules
5. Display grouped by domain with confidence bars and observation stats

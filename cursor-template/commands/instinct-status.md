---
name: instinct-status
description: Show learned instincts (project + global) with confidence
command: true

---

# Instinct Status Command

Shows learned instincts for the current project plus global instincts, grouped by domain.

## Implementation

Run the globally installed Cursor instinct CLI:

```bash
node "<config>/skills/continuous-learning-manual/scripts/instinct-cli.js" status
```

Default `<config>` is `~/.cursor`. If your Cursor config root is overridden, use that instead.

Do not fall back to:

- `skills/...`
- `${MDT_ROOT}/...`
- `~/.claude/...`
- `~/.codex/...`
- any other tool directory

If `<config>/skills/continuous-learning-manual/scripts/instinct-cli.js` does
not exist, report that the global Cursor install is missing or incomplete
instead of guessing another path.

## Usage

```
/instinct-status
```

## What to Do

1. Detect current project context
2. Read project instincts from `<config>/mdt/homunculus/<project-id>/instincts/`
3. Read global instincts from `<config>/mdt/homunculus/instincts/`
4. Merge with precedence rules
5. Display grouped by domain with confidence bars and observation stats

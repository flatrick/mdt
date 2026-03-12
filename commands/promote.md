---
name: promote
description: Promote project-scoped instincts to global scope
command: true

---

# Promote Command

Promote instincts from project scope to global scope in continuous-learning-manual.

## Implementation

Run the instinct CLI using `MDT_ROOT` when available:

```bash
node "${MDT_ROOT}/skills/continuous-learning-manual/scripts/instinct-cli.js" promote [instinct-id] [--force] [--dry-run]
```

For manual installs, replace `<config>` with your MDT config directory (for example `~/.claude` or `~/.cursor`):

```bash
node "<config>/skills/continuous-learning-manual/scripts/instinct-cli.js" promote [instinct-id] [--force] [--dry-run]
```

## Usage

```bash
/promote                      # Auto-detect promotion candidates
/promote --dry-run            # Preview auto-promotion candidates
/promote --force              # Promote all qualified candidates without prompt
/promote grep-before-edit     # Promote one specific instinct from current project
```

## What to Do

1. Detect current project
2. If `instinct-id` is provided, promote only that instinct (if present in current project)
3. Otherwise, find cross-project candidates that:
   - Appear in at least 2 projects
   - Meet confidence threshold
4. Write promoted instincts to `<data>/homunculus/instincts/personal/` with `scope: global`

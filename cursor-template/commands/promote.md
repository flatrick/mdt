---
name: promote
description: Promote project-scoped instincts to global scope
command: true

---

# Promote Command

Promote instincts from project scope to global scope in continuous-learning-manual.

## Implementation

Run the globally installed Cursor instinct CLI:

```bash
node "<config>/skills/continuous-learning-manual/scripts/instinct-cli.js" promote [instinct-id] [--force] [--dry-run]
```

Default `<config>` is `~/.cursor`. If your Cursor config root is overridden, use that instead.

Do not fall back to other tool directories such as `~/.claude`, `~/.codex`,
repo `skills/...`, or `${MDT_ROOT}/...`. If the Cursor-installed path is
missing, report the install as incomplete.

## Usage

```bash
/promote                      # Auto-detect promotion candidates
/promote --dry-run            # Preview auto-promotion candidates
/promote --force              # Promote all qualified candidates without prompt
/promote grep-before-edit     # Promote one specific instinct from current project
```

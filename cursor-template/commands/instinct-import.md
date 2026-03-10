---
name: instinct-import
description: Import instincts from file or URL into project/global scope
command: true
---

# Instinct Import Command

## Implementation

Run the project-installed Cursor instinct CLI:

```bash
node ".cursor/skills/continuous-learning-manual/scripts/instinct-cli.js" import <file-or-url> [--dry-run] [--force] [--min-confidence 0.7] [--scope project|global]
```

For a user/global Cursor install, replace `.cursor` with `~/.cursor`.

Do not fall back to other tool directories such as `~/.claude`, `~/.codex`,
repo `skills/...`, or `${MDT_ROOT}/...`. If the Cursor-installed path is
missing, report the install as incomplete.

## Usage

```
/instinct-import team-instincts.yaml
/instinct-import https://github.com/org/repo/instincts.yaml
/instinct-import team-instincts.yaml --dry-run
/instinct-import team-instincts.yaml --scope global --force
```

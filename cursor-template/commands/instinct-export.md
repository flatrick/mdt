---
name: instinct-export
description: Export instincts from project/global scope to a file
command: /instinct-export
---

# Instinct Export Command

## Implementation

Run the project-installed Cursor instinct CLI:

```bash
node ".cursor/skills/continuous-learning-manual/scripts/instinct-cli.js" export <file-or-url> [--dry-run] [--force] [--min-confidence 0.7] [--scope project|global|all]
```

For a user/global Cursor install, replace `.cursor` with `~/.cursor`.

Do not fall back to other tool directories such as `~/.claude`, `~/.codex`,
repo `skills/...`, or `${MDT_ROOT}/...`. If the Cursor-installed path is
missing, report the install as incomplete.

## Usage

```
/instinct-export                           # Export all personal instincts
/instinct-export --domain testing          # Export only testing instincts
/instinct-export --min-confidence 0.7      # Only export high-confidence instincts
/instinct-export --output team-instincts.yaml
/instinct-export --scope project --output project-instincts.yaml
```

---
name: instinct-export
description: Export instincts from project/global scope to a file
command: /instinct-export

---

# Instinct Export Command

## Implementation

Run the globally installed Cursor instinct CLI:

```bash
node "<config>/skills/continuous-learning-manual/scripts/instinct-cli.js" export <file-or-url> [--dry-run] [--force] [--min-confidence 0.7] [--scope project|global|all]
```

Default `<config>` is `~/.cursor`. If your Cursor config root is overridden, use that instead.

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

---
paths:
  - "**/*.sh"
  - "**/*.bash"
---
# Bash Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Bash specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **shellcheck**: Run after editing `.sh` files to catch bugs and style issues
- **bash -n**: Syntax check after editing shell scripts

## Warnings

- Warn about `eval` usage — potential command injection
- Warn about missing `set -euo pipefail` at script top
- Warn about unquoted variables — word splitting and glob expansion risks
- Warn about `rm -rf` with variable paths — verify variable is set before use

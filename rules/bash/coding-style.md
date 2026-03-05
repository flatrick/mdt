---
paths:
  - "**/*.sh"
  - "**/*.bash"
  - "**/Makefile"
---
# Bash Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Bash specific content.

## Standards

- Always use `#!/usr/bin/env bash` for portability (unless POSIX sh required, then `#!/bin/sh`)
- Always add `set -euo pipefail` at the top of every script
- Run **ShellCheck** for linting: `shellcheck script.sh`

## Naming Conventions

```bash
# Functions: lowercase with underscores
function get_user_name() { }
get_user_name() { }  # Both forms acceptable

# Variables: lowercase with underscores (local), UPPER_SNAKE_CASE (env/global)
local user_name="Alice"
readonly MAX_RETRIES=3
export DATABASE_URL="..."

# Constants: UPPER_SNAKE_CASE
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```

## Quoting Rules

```bash
# ALWAYS quote variables
echo "$variable"          # Good
echo "${variable}"        # Good (disambiguation)
echo $variable            # Bad — word splitting and glob expansion

# Quote arrays correctly
cmd "${args[@]}"          # Good — each element as separate argument
cmd "${args[*]}"          # Joins with IFS — use intentionally
cmd $args                 # Bad — breaks on spaces
```

## Reference

See skill: `bash-patterns` for comprehensive shell scripting patterns and safety techniques.

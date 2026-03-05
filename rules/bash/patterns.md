---
paths:
  - "**/*.sh"
  - "**/*.bash"
---
# Bash Patterns

> This file extends [common/patterns.md](../common/patterns.md) with Bash specific content.

## Script Template

Every script should follow this template:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Script constants
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "$0")"

# Logging functions
log_info()  { echo "[INFO]  $*" >&2; }
log_warn()  { echo "[WARN]  $*" >&2; }
log_error() { echo "[ERROR] $*" >&2; }

# Usage
usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS] <argument>

Options:
    -h, --help      Show this help
    -v, --verbose   Enable verbose output

Arguments:
    argument        Description of required argument
EOF
}

# Cleanup trap
cleanup() {
    local exit_code=$?
    # Remove temp files, etc.
    exit "$exit_code"
}
trap cleanup EXIT INT TERM

# Main
main() {
    # Parse args, run logic
    :
}

main "$@"
```

## Dependency Checking Pattern

```bash
require_command() {
    local cmd="$1"
    if ! command -v "$cmd" &>/dev/null; then
        log_error "Required command not found: $cmd"
        exit 1
    fi
}

require_command curl
require_command jq
require_command git
```

## Reference

See skill: `bash-patterns` for comprehensive patterns including argument parsing, error handling, and testing.

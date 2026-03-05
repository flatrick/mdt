---
paths:
  - "**/*.sh"
  - "**/*.bash"
---
# Bash Security

> This file extends [common/security.md](../common/security.md) with Bash specific content.

## Input Validation

```bash
# Validate and sanitize inputs
validate_username() {
    local username="$1"
    if [[ ! "$username" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        log_error "Invalid username: $username"
        exit 1
    fi
}

# Never pass user input to eval
# Bad:
eval "$user_input"

# Good: Use specific commands with validated args
case "$command" in
    start|stop|restart) systemctl "$command" myservice ;;
    *) log_error "Invalid command: $command"; exit 1 ;;
esac
```

## Secure Temporary Files

```bash
# Use mktemp — never predictable /tmp/myapp.tmp
tmp_file=$(mktemp)
tmp_dir=$(mktemp -d)

# Always clean up
trap 'rm -f "$tmp_file"; rm -rf "$tmp_dir"' EXIT
```

## Secret Management

```bash
# Use environment variables — never hardcode
API_KEY="${MY_API_KEY:?MY_API_KEY environment variable must be set}"

# Never log secrets
log_info "Connecting to API..."  # Good
log_info "API key: $API_KEY"    # Bad
```

## Reference

See skill: `bash-patterns` for secure scripting patterns.

---
paths:
  - "**/*.sh"
  - "**/*.bash"
---
# Bash Testing

> This file extends [common/testing.md](../common/testing.md) with Bash specific content.

## Framework

Use **bats-core** (Bash Automated Testing System) for shell script testing.

```bash
# Install bats-core
npm install -g bats
# or
brew install bats-core
```

## Test Structure

```bash
#!/usr/bin/env bats

setup() {
    # Runs before each test
    export TEST_DIR="$(mktemp -d)"
}

teardown() {
    # Runs after each test
    rm -rf "$TEST_DIR"
}

@test "script exits 0 on valid input" {
    run ./my-script.sh valid-input
    [ "$status" -eq 0 ]
}

@test "script exits 1 on missing argument" {
    run ./my-script.sh
    [ "$status" -eq 1 ]
    [[ "$output" == *"Usage:"* ]]
}

@test "creates output file" {
    run ./my-script.sh --output "$TEST_DIR/result.txt" input.txt
    [ -f "$TEST_DIR/result.txt" ]
}
```

## Reference

See skill: `bash-patterns` for detailed bats testing patterns and test helpers.

---
name: bash-patterns
description: Safe, portable, and idiomatic Bash/shell scripting patterns including error handling, security hardening, argument parsing, testing with bats-core, and cross-platform techniques.
origin: ECC
---

# Bash Development Patterns

Safe, portable, and maintainable shell scripting patterns for building robust scripts and automation tools.

## When to Activate

- Writing new shell scripts (`.sh`, `.bash`)
- Reviewing or refactoring existing shell scripts
- Designing shell-based automation or CI/CD pipelines
- Adding tests for shell scripts with bats-core
- Hardening scripts for production or privileged execution

## Core Principles

### 1. Always Start With the Safety Header

Every bash script must begin with the shebang and safety options:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

- `#!/usr/bin/env bash` — portable shebang that finds bash in PATH
- `set -e` — exit immediately if a command fails
- `set -u` — treat unset variables as errors
- `set -o pipefail` — catch failures in pipelines (not just the last command)

For POSIX sh scripts requiring maximum portability:

```bash
#!/bin/sh
set -eu
# Note: pipefail is not POSIX; omit for /bin/sh scripts
```

### 2. Always Quote Variable Expansions

Unquoted variables cause word splitting and glob expansion — a common source of bugs and security issues:

```bash
# Bad: word splitting breaks on spaces, glob expansion on * ? [
echo $filename
cp $src $dst
if [ $status = "ok" ]; then

# Good: always double-quote
echo "$filename"
cp "$src" "$dst"
if [ "$status" = "ok" ]; then

# Good: brace-quote for disambiguation
echo "${prefix}suffix"
echo "${array[@]}"   # all array elements as separate words
echo "${array[*]}"   # all elements joined by IFS (use intentionally)
```

Exception: intentional word splitting or glob expansion should be explicitly commented.

### 3. Safe Temporary Files With mktemp and Cleanup Traps

Never use predictable temporary file names:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Create temp files/dirs safely
tmp_file=$(mktemp)
tmp_dir=$(mktemp -d)

# Always register cleanup before using temp resources
cleanup() {
    local exit_code=$?
    rm -f "$tmp_file"
    rm -rf "$tmp_dir"
    exit "$exit_code"
}
trap cleanup EXIT INT TERM

# Now use temp resources safely
echo "data" > "$tmp_file"
process "$tmp_file"
```

The `trap cleanup EXIT` fires on any exit (success or failure), ensuring cleanup always runs.

### 4. Argument Parsing With getopts

Use `getopts` for portable option parsing:

```bash
#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"

usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS] <input-file>

Options:
    -h          Show this help message
    -v          Enable verbose output
    -o <file>   Write output to file (default: stdout)
    -n <count>  Number of iterations (default: 1)

Arguments:
    input-file  Path to the input file to process

Examples:
    $SCRIPT_NAME -v input.txt
    $SCRIPT_NAME -o output.txt -n 5 input.txt
EOF
}

verbose=false
output_file=""
count=1

while getopts ":hvo:n:" opt; do
    case "$opt" in
        h) usage; exit 0 ;;
        v) verbose=true ;;
        o) output_file="$OPTARG" ;;
        n) count="$OPTARG" ;;
        :) echo "Error: Option -$OPTARG requires an argument" >&2; usage >&2; exit 1 ;;
        \?) echo "Error: Unknown option -$OPTARG" >&2; usage >&2; exit 1 ;;
    esac
done
shift $((OPTIND - 1))

# Validate required positional arguments
if [[ $# -lt 1 ]]; then
    echo "Error: input-file is required" >&2
    usage >&2
    exit 1
fi

input_file="$1"

# Validate argument types
if [[ ! "$count" =~ ^[0-9]+$ ]]; then
    echo "Error: -n requires a positive integer, got: $count" >&2
    exit 1
fi

if [[ ! -f "$input_file" ]]; then
    echo "Error: input file not found: $input_file" >&2
    exit 1
fi
```

### 5. Functions and Local Variables

Always declare function-local variables with `local` to avoid polluting global scope:

```bash
# Good: all variables local to the function
process_file() {
    local input_file="$1"
    local output_file="${2:-/dev/stdout}"
    local line_count=0
    local line

    while IFS= read -r line; do
        line_count=$((line_count + 1))
        echo "$line" >> "$output_file"
    done < "$input_file"

    echo "Processed $line_count lines" >&2
    return 0
}

# Bad: global variable pollution
process_file() {
    input_file="$1"   # global!
    line_count=0       # global!
    ...
}
```

Use `readonly` for constants:

```bash
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly MAX_RETRIES=3
readonly DEFAULT_TIMEOUT=30
```

### 6. Error Handling and Logging Functions

Consistent logging functions that write to stderr:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Logging — always write to stderr to keep stdout clean for data
log_debug() { [[ "${VERBOSE:-false}" == "true" ]] && echo "[DEBUG] $*" >&2 || true; }
log_info()  { echo "[INFO]  $*" >&2; }
log_warn()  { echo "[WARN]  $*" >&2; }
log_error() { echo "[ERROR] $*" >&2; }

# Error with exit
die() {
    log_error "$@"
    exit 1
}

# Usage examples
log_info "Starting process..."
log_warn "Config file not found, using defaults"
log_error "Failed to connect to database"
die "Fatal: disk full, cannot continue"
```

With timestamps for long-running scripts:

```bash
log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*" >&2
}
```

### 7. Checking Command Availability

Always verify external command dependencies before using them:

```bash
require_command() {
    local cmd="$1"
    local install_hint="${2:-}"
    if ! command -v "$cmd" &>/dev/null; then
        log_error "Required command not found: $cmd"
        if [[ -n "$install_hint" ]]; then
            log_error "Install with: $install_hint"
        fi
        exit 1
    fi
}

# Check all dependencies upfront
require_command curl "apt-get install curl / brew install curl"
require_command jq "apt-get install jq / brew install jq"
require_command git "apt-get install git / brew install git"

# Optional command check
has_command() {
    command -v "$1" &>/dev/null
}

if has_command shellcheck; then
    shellcheck "$0"
else
    log_warn "shellcheck not available — skipping lint"
fi
```

### 8. Here-Docs for Multiline Content

Use here-documents for multiline strings, avoiding complex quoting:

```bash
# Generate config file
cat > "$config_file" <<'EOF'
# Generated config — do not edit manually
[settings]
timeout=30
retries=3
EOF

# Indented here-doc (bash only, use <<-EOF with tabs)
generate_config() {
    local host="$1"
    local port="$2"
    cat <<EOF
[server]
host=$host
port=$port
EOF
}

# Here-doc as input to a command
ssh "$remote_host" <<'ENDSSH'
    set -euo pipefail
    echo "Running on remote host"
    hostname
ENDSSH

# Here-string (single line)
grep "pattern" <<< "$variable_content"
```

### 9. Arrays and Associative Arrays (Bash 4+)

Use arrays to avoid word-splitting problems with lists:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Indexed arrays
files=()
files+=("file with spaces.txt")
files+=("another file.txt")
files+=("normal.txt")

# Iterate safely — each element is one word
for file in "${files[@]}"; do
    echo "Processing: $file"
done

# Array length
echo "Count: ${#files[@]}"

# Build command arrays — the safe way to construct commands
cmd=(rsync -avz --delete)
[[ "$verbose" == "true" ]] && cmd+=(--progress)
cmd+=("$source_dir/" "$dest_dir/")
"${cmd[@]}"  # Execute — each element is a separate argument

# Associative arrays (bash 4+)
declare -A config
config[host]="localhost"
config[port]="5432"
config[database]="mydb"

echo "Connecting to ${config[host]}:${config[port]}/${config[database]}"

# Iterate associative array
for key in "${!config[@]}"; do
    echo "$key = ${config[$key]}"
done
```

### 10. Cross-Platform Considerations

Handle differences between macOS (BSD tools) and Linux (GNU tools):

```bash
#!/usr/bin/env bash
set -euo pipefail

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Darwin) echo "macos" ;;
        Linux)  echo "linux" ;;
        MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
        *) echo "unknown" ;;
    esac
}

OS="$(detect_os)"

# sed: macOS requires empty string argument for in-place edit
sed_inplace() {
    local file="$1"
    shift
    if [[ "$OS" == "macos" ]]; then
        sed -i '' "$@" "$file"
    else
        sed -i "$@" "$file"
    fi
}

# date: different flags between BSD and GNU
get_timestamp() {
    if [[ "$OS" == "macos" ]]; then
        date -u "+%Y-%m-%dT%H:%M:%SZ"
    else
        date -u --iso-8601=seconds
    fi
}

# stat: different format flags
get_file_size() {
    local file="$1"
    if [[ "$OS" == "macos" ]]; then
        stat -f%z "$file"
    else
        stat --format="%s" "$file"
    fi
}

# readlink -f not available on macOS — use Python or perl fallback
realpath_portable() {
    if command -v realpath &>/dev/null; then
        realpath "$1"
    elif command -v python3 &>/dev/null; then
        python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$1"
    else
        # Pure bash fallback
        local path="$1"
        cd "$(dirname "$path")" && echo "$PWD/$(basename "$path")"
    fi
}
```

## Complete Script Template

Every production script should follow this template:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Script constants
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_VERSION="1.0.0"

# Logging functions
log_debug() { [[ "${VERBOSE:-false}" == "true" ]] && echo "[DEBUG] $*" >&2 || true; }
log_info()  { echo "[INFO]  $*" >&2; }
log_warn()  { echo "[WARN]  $*" >&2; }
log_error() { echo "[ERROR] $*" >&2; }
die()       { log_error "$@"; exit 1; }

# Usage
usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS] <argument>

$SCRIPT_NAME v$SCRIPT_VERSION — Short description of what this script does.

Options:
    -h, --help      Show this help message
    -v, --verbose   Enable verbose output
    -n, --dry-run   Show what would be done without doing it

Arguments:
    argument        Description of required argument

Examples:
    $SCRIPT_NAME input.txt
    $SCRIPT_NAME -v --dry-run input.txt

EOF
}

# Cleanup trap
cleanup() {
    local exit_code=$?
    # Remove any temp files or dirs created during the script
    [[ -n "${tmp_file:-}" ]] && rm -f "$tmp_file"
    [[ -n "${tmp_dir:-}" ]] && rm -rf "$tmp_dir"
    exit "$exit_code"
}
trap cleanup EXIT INT TERM

# Dependency checks
require_command() {
    command -v "$1" &>/dev/null || die "Required command not found: $1"
}

# Parse arguments
parse_args() {
    local verbose=false
    local dry_run=false
    local argument=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)    usage; exit 0 ;;
            -v|--verbose) verbose=true; shift ;;
            -n|--dry-run) dry_run=true; shift ;;
            --)           shift; break ;;
            -*)           die "Unknown option: $1. Use -h for help." ;;
            *)            argument="$1"; shift ;;
        esac
    done

    [[ -z "$argument" ]] && die "Missing required argument. Use -h for help."

    # Export parsed values for main to use
    VERBOSE="$verbose"
    DRY_RUN="$dry_run"
    ARGUMENT="$argument"
}

# Main logic
main() {
    parse_args "$@"

    require_command curl
    require_command jq

    log_info "Starting $SCRIPT_NAME..."
    log_debug "Argument: $ARGUMENT"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would process: $ARGUMENT"
        return 0
    fi

    # Create temp resources after trap is registered
    tmp_file=$(mktemp)
    tmp_dir=$(mktemp -d)

    log_info "Processing $ARGUMENT..."
    # ... actual work here ...

    log_info "Done."
}

main "$@"
```

## Testing With bats-core

[bats-core](https://github.com/bats-core/bats-core) is the standard testing framework for Bash scripts.

### Installation

```bash
# npm (cross-platform)
npm install -g bats

# Homebrew (macOS)
brew install bats-core

# apt (Debian/Ubuntu)
apt-get install bats

# From source
git clone https://github.com/bats-core/bats-core.git
cd bats-core && ./install.sh /usr/local
```

### Test File Structure

```bash
#!/usr/bin/env bats

# bats-core test file for my-script.sh

# setup() runs before each @test
setup() {
    # Load bats helpers if installed
    load 'test_helper/bats-support/load'
    load 'test_helper/bats-assert/load'

    # Create a temp dir for test artifacts
    TEST_DIR="$(mktemp -d)"
    export TEST_DIR

    # Make script available
    SCRIPT="$BATS_TEST_DIRNAME/../my-script.sh"
    chmod +x "$SCRIPT"
}

# teardown() runs after each @test
teardown() {
    rm -rf "$TEST_DIR"
}

@test "shows usage with -h flag" {
    run "$SCRIPT" -h
    [ "$status" -eq 0 ]
    [[ "$output" == *"Usage:"* ]]
}

@test "exits 1 when required argument is missing" {
    run "$SCRIPT"
    [ "$status" -eq 1 ]
    [[ "$output" == *"Missing required argument"* ]]
}

@test "exits 1 on unknown option" {
    run "$SCRIPT" --unknown-flag
    [ "$status" -eq 1 ]
}

@test "processes valid input file" {
    echo "test content" > "$TEST_DIR/input.txt"

    run "$SCRIPT" "$TEST_DIR/input.txt"
    [ "$status" -eq 0 ]
}

@test "creates output file when specified" {
    echo "test content" > "$TEST_DIR/input.txt"

    run "$SCRIPT" -o "$TEST_DIR/output.txt" "$TEST_DIR/input.txt"
    [ "$status" -eq 0 ]
    [ -f "$TEST_DIR/output.txt" ]
}

@test "dry run does not modify files" {
    echo "original" > "$TEST_DIR/input.txt"

    run "$SCRIPT" --dry-run "$TEST_DIR/input.txt"
    [ "$status" -eq 0 ]
    [[ "$(cat "$TEST_DIR/input.txt")" == "original" ]]
}

@test "handles filenames with spaces" {
    echo "content" > "$TEST_DIR/file with spaces.txt"

    run "$SCRIPT" "$TEST_DIR/file with spaces.txt"
    [ "$status" -eq 0 ]
}
```

### Testing Helper Functions

Test internal functions by sourcing the script:

```bash
#!/usr/bin/env bats

setup() {
    # Source the script to access its functions
    # Guard against running main() on source
    SOURCED=true
    source "$BATS_TEST_DIRNAME/../my-script.sh"
}

@test "validate_username accepts valid usernames" {
    run validate_username "alice"
    [ "$status" -eq 0 ]

    run validate_username "bob_123"
    [ "$status" -eq 0 ]
}

@test "validate_username rejects invalid usernames" {
    run validate_username "alice; rm -rf /"
    [ "$status" -eq 1 ]

    run validate_username ""
    [ "$status" -eq 1 ]
}

@test "get_file_size returns correct size" {
    echo -n "hello" > "$BATS_TMPDIR/test.txt"
    run get_file_size "$BATS_TMPDIR/test.txt"
    [ "$status" -eq 0 ]
    [ "$output" -eq 5 ]
}
```

### Running Tests

```bash
# Run all tests
bats tests/

# Run specific test file
bats tests/my-script.bats

# Run with TAP output
bats --formatter tap tests/

# Verbose output
bats --verbose-run tests/

# Run tests matching a pattern
bats --filter "handles filenames" tests/
```

## ShellCheck Integration

ShellCheck catches most common shell scripting bugs automatically.

### Running ShellCheck

```bash
# Lint a single script
shellcheck script.sh

# Lint as POSIX sh
shellcheck --shell=sh script.sh

# Exclude specific warnings
shellcheck --exclude=SC2059,SC2034 script.sh

# Lint all scripts in project
find . -name "*.sh" -o -name "*.bash" | xargs shellcheck

# JSON output for CI integration
shellcheck --format=json script.sh
```

### ShellCheck in CI

```yaml
# .github/workflows/shellcheck.yml
name: ShellCheck
on: [push, pull_request]
jobs:
  shellcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run ShellCheck
        uses: ludeeus/action-shellcheck@master
        with:
          scandir: './scripts'
```

### Common ShellCheck Directives

```bash
# Disable a warning for a single line
# shellcheck disable=SC2086
echo $unquoted_intentionally

# Disable for a block
# shellcheck disable=SC2034
unused_variable="needed for export"

# Source a file shellcheck can't find
# shellcheck source=./lib/helpers.sh
source "$(dirname "$0")/lib/helpers.sh"
```

## Anti-Patterns

| Anti-Pattern | Problem | Correct Pattern |
|---|---|---|
| `ls \| grep pattern` | Breaks on special chars in filenames | `find . -name "pattern"` |
| `for f in $(ls)` | Word splitting on spaces | `for f in *` or `while IFS= read` |
| `` `command` `` | Backticks don't nest cleanly | `$(command)` |
| `[ $var = "val" ]` | Breaks if `$var` is empty | `[ "$var" = "val" ]` |
| `if [ $? -eq 0 ]` | Fragile, checks unrelated previous command | `if command; then` |
| `echo -e "text\n"` | `-e` not portable across shells | `printf "text\n"` |
| `which command` | Not POSIX, varies by system | `command -v command` |
| `rm -rf $dir` | Unquoted: glob expansion; unset: `rm -rf /` | `rm -rf "${dir:?}"` |
| `/tmp/myscript.$$` | Predictable, race condition | `mktemp` |
| `eval "$user_input"` | Command injection | `case`/`if` with validation |
| Nested backticks | Hard to read and escape | `$(outer $(inner))` |
| `chmod 777 file` | Over-permissive | Minimal required permissions |

## Quick Reference

### String Operations

```bash
# Length
echo "${#string}"

# Substring: ${string:offset:length}
echo "${string:0:5}"   # first 5 chars
echo "${string: -3}"   # last 3 chars

# Remove prefix/suffix
echo "${filename%.txt}"   # remove .txt suffix
echo "${path##*/}"        # basename (remove longest prefix up to /)
echo "${path%/*}"         # dirname (remove shortest suffix from /)

# Replace
echo "${string/old/new}"     # replace first occurrence
echo "${string//old/new}"    # replace all occurrences

# Default values
echo "${var:-default}"       # use default if var unset or empty
echo "${var:=default}"       # assign and use default if var unset or empty
echo "${var:?error message}"  # exit with error if var unset or empty
```

### Conditionals

```bash
# File tests
[[ -f "$path" ]]    # regular file exists
[[ -d "$path" ]]    # directory exists
[[ -r "$path" ]]    # file is readable
[[ -w "$path" ]]    # file is writable
[[ -x "$path" ]]    # file is executable
[[ -s "$path" ]]    # file exists and non-empty
[[ -L "$path" ]]    # file is a symlink

# String tests
[[ -z "$str" ]]     # empty string
[[ -n "$str" ]]     # non-empty string
[[ "$a" == "$b" ]]  # string equality
[[ "$a" != "$b" ]]  # string inequality
[[ "$str" =~ ^[0-9]+$ ]]  # regex match (bash only)

# Numeric tests
[[ $a -eq $b ]]     # equal
[[ $a -ne $b ]]     # not equal
[[ $a -lt $b ]]     # less than
[[ $a -le $b ]]     # less than or equal
[[ $a -gt $b ]]     # greater than
[[ $a -ge $b ]]     # greater than or equal

# Logical operators (inside [[ ]])
[[ $a && $b ]]      # and
[[ $a || $b ]]      # or
[[ ! $a ]]          # not
```

### Process Substitution and Pipelines

```bash
# Process substitution — treat command output as a file
diff <(sort file1.txt) <(sort file2.txt)
while IFS= read -r line; do
    process "$line"
done < <(command_that_produces_output)

# Avoid: while loop in subshell (variables don't persist)
command | while IFS= read -r line; do
    # changes to variables here are lost after the loop!
    count=$((count + 1))
done
# Use process substitution instead:
while IFS= read -r line; do
    count=$((count + 1))
done < <(command)
```

__Remember__: Shell scripts should fail loudly and clearly. Silent failures are the enemy of reliable automation.

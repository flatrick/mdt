---
paths:
  - "**/*.ps1"
  - "**/*.psm1"
  - "**/*.psd1"
---
# PowerShell Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with PowerShell specific content.

## Standards

- Follow **PowerShell Practice and Style Guide** conventions
- Use **approved verbs** for all functions (`Get-Verb` to list)
- Use **PascalCase** for functions, parameters, and variables
- Use `[CmdletBinding()]` on all advanced functions

## Formatting

- **PSScriptAnalyzer**: Static analysis and style enforcement
- **PSScriptAnalyzer** with `-Fix` flag for auto-correction
- Indent with 4 spaces (not tabs)
- Opening brace on same line as control structure

```powershell
# Good
if ($condition) {
    Do-Something
}

# Bad
if ($condition)
{
    Do-Something
}
```

## Naming Conventions

```powershell
# Functions: Verb-Noun (PascalCase)
function Get-UserProfile { }
function Set-Configuration { }

# Variables: PascalCase
$UserName = "Alice"
$MaxRetries = 3

# Constants: PascalCase or UPPER_CASE
$MaxConnections = 100

# Private/internal: Prefix with underscore convention is NOT standard
# Instead, place in Private/ folder in modules
```

## Reference

See skill: `powershell-patterns` for comprehensive PowerShell idioms and patterns.

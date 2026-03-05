---
paths:
  - "**/*.ps1"
  - "**/*.psm1"
  - "**/*.psd1"
---
# PowerShell Patterns

> This file extends [common/patterns.md](../common/patterns.md) with PowerShell specific content.

## Repository Pattern

```powershell
# Define interface via class
class UserRepository {
    [PSCustomObject] FindById([string]$Id) { throw "Not implemented" }
    [PSCustomObject] Save([hashtable]$User) { throw "Not implemented" }
    [void] Delete([string]$Id) { throw "Not implemented" }
}

# Concrete implementation
class SqlUserRepository : UserRepository {
    [string]$ConnectionString

    SqlUserRepository([string]$connectionString) {
        $this.ConnectionString = $connectionString
    }

    [PSCustomObject] FindById([string]$Id) {
        # SQL query implementation
    }
}
```

## Pipeline Pattern

Design functions to compose naturally in the pipeline — output objects that can feed into the next command.

## Configuration Pattern

```powershell
# Load configuration from environment with defaults
function Get-AppConfig {
    [PSCustomObject]@{
        ApiUrl     = $env:API_URL ?? "https://api.example.com"
        Timeout    = [int]($env:TIMEOUT ?? 30)
        MaxRetries = [int]($env:MAX_RETRIES ?? 3)
    }
}
```

## Reference

See skill: `powershell-patterns` for comprehensive patterns including modules, pipeline design, and testing.

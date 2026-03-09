---
name: powershell-patterns
description: PowerShell best practices, idiomatic patterns, module design, error handling, security hardening, and cross-platform scripting for modern PowerShell 5.1 and PowerShell 7+.
---

# PowerShell Development Patterns

Idiomatic PowerShell patterns and best practices for building robust, maintainable, and cross-platform scripts and modules.

## When to Activate

- Writing new PowerShell scripts or modules
- Reviewing PowerShell code
- Refactoring existing scripts
- Designing PowerShell modules and cmdlets
- Implementing automation pipelines

## Core Principles

### 1. Use CmdletBinding and Advanced Functions

Always use `[CmdletBinding()]` for functions that will be used like cmdlets.

```powershell
# Good: Full advanced function
function Get-UserReport {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory, ValueFromPipeline)]
        [ValidateNotNullOrEmpty()]
        [string]$UserName,

        [Parameter()]
        [ValidateRange(1, 365)]
        [int]$DaysBack = 30
    )

    process {
        Write-Verbose "Processing user: $UserName"
        if ($PSCmdlet.ShouldProcess($UserName, "Generate report")) {
            # Implementation
        }
    }
}

# Bad: Simple function without metadata
function GetUserReport($UserName) {
    # No parameter validation, no pipeline support
}
```

### 2. Approved Verbs

Always use PowerShell approved verbs. Check with `Get-Verb`.

```powershell
# Good: Approved verbs
function Get-Configuration { }
function Set-Configuration { }
function New-Configuration { }
function Remove-Configuration { }
function Invoke-Build { }
function Test-Connection { }

# Bad: Unapproved verbs
function Fetch-Configuration { }    # Use Get-
function Delete-Configuration { }   # Use Remove-
function Execute-Build { }          # Use Invoke-
function Check-Connection { }       # Use Test-
```

### 3. Error Handling

Set `$ErrorActionPreference` and use `try/catch/finally` properly.

```powershell
# Script-level: fail fast
$ErrorActionPreference = 'Stop'

function Invoke-ApiCall {
    [CmdletBinding()]
    param([string]$Endpoint)

    try {
        $response = Invoke-RestMethod -Uri $Endpoint -ErrorAction Stop
        return $response
    }
    catch [System.Net.WebException] {
        Write-Error "Network error calling $Endpoint`: $_"
        throw
    }
    catch {
        Write-Error "Unexpected error: $_"
        throw
    }
    finally {
        # Cleanup always runs
        Write-Verbose "API call complete"
    }
}

# Check external process exit codes
& git push
if ($LASTEXITCODE -ne 0) {
    throw "git push failed with exit code $LASTEXITCODE"
}
```

### 4. Secure Credential Handling

Never store passwords as plain strings.

```powershell
# Good: Use SecureString and PSCredential
function Connect-Database {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Server,

        [Parameter(Mandatory)]
        [System.Management.Automation.PSCredential]
        [System.Management.Automation.Credential()]
        $Credential
    )

    $connectionString = "Server=$Server;User=$($Credential.UserName)"
    # PSCredential handles SecureString decryption safely
    $plainPassword = $Credential.GetNetworkCredential().Password
    # Use and immediately discard
}

# Read from environment
$apiKey = $env:MY_API_KEY
if (-not $apiKey) { throw "MY_API_KEY environment variable not set" }

# Read securely at runtime
$securePassword = Read-Host -Prompt "Password" -AsSecureString
$credential = [PSCredential]::new("username", $securePassword)

# Bad: Never do these
$password = "MyPlainPassword"           # Hardcoded
$password = $env:PASSWORD               # OK for non-secrets, but be cautious
Write-Host "Password: $password"        # Never log secrets
```

### 5. Cross-Platform Compatibility

Write scripts that work on Windows, macOS, and Linux.

```powershell
# Good: Cross-platform paths
$configPath = Join-Path $HOME ".config" "myapp" "settings.json"
$tempFile = [System.IO.Path]::GetTempFileName()
$separator = [System.IO.Path]::DirectorySeparatorChar

# Good: Platform detection
if ($IsWindows) {
    $programFiles = $env:ProgramFiles
} elseif ($IsMacOS) {
    $programFiles = "/Applications"
} else {
    $programFiles = "/usr/local/bin"
}

# Good: Use Get-CimInstance (works cross-platform in PS 7+)
$os = Get-CimInstance -ClassName Win32_OperatingSystem

# Bad: Windows-only
$path = "C:\Users\$env:USERNAME\Documents"  # Hardcoded Windows path
$wmi = Get-WmiObject -Class Win32_Process    # Deprecated, Windows-only
```

### 6. Pipeline Design

Design functions to work naturally in the pipeline.

```powershell
function Get-ProcessedItem {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory, ValueFromPipeline, ValueFromPipelineByPropertyName)]
        [string]$Path,

        [Parameter()]
        [switch]$Recurse
    )

    begin {
        # Initialize once
        $count = 0
    }

    process {
        # Called once per pipeline input
        $count++
        $item = Get-Item -Path $Path
        # Output to pipeline
        [PSCustomObject]@{
            Index = $count
            Name  = $item.Name
            Size  = $item.Length
        }
    }

    end {
        # Finalize once
        Write-Verbose "Processed $count items"
    }
}

# Usage
Get-ChildItem -Path . -Filter *.log | Get-ProcessedItem | Export-Csv report.csv
```

### 7. Module Structure

Organize PowerShell modules properly.

```
MyModule/
├── MyModule.psd1           # Module manifest
├── MyModule.psm1           # Root module (loads private/public)
├── Public/                 # Exported functions
│   ├── Get-Something.ps1
│   └── Set-Something.ps1
├── Private/                # Internal helper functions
│   └── Invoke-Internal.ps1
└── Tests/
    ├── Public/
    │   └── Get-Something.Tests.ps1
    └── Private/
        └── Invoke-Internal.Tests.ps1
```

```powershell
# MyModule.psm1 — Module loader
$Public = Get-ChildItem -Path "$PSScriptRoot/Public" -Filter "*.ps1"
$Private = Get-ChildItem -Path "$PSScriptRoot/Private" -Filter "*.ps1"

foreach ($file in @($Private + $Public)) {
    . $file.FullName
}

Export-ModuleMember -Function $Public.BaseName
```

### 8. Comment-Based Help

Every exported function needs proper documentation.

```powershell
function Get-WeatherReport {
    <#
    .SYNOPSIS
        Retrieves weather report for a given location.

    .DESCRIPTION
        Calls the weather API and returns a formatted report object
        including temperature, humidity, and forecast.

    .PARAMETER Location
        The city or ZIP code to retrieve weather for.

    .PARAMETER Unit
        Temperature unit. Accepts 'Celsius' or 'Fahrenheit'. Default: 'Celsius'.

    .EXAMPLE
        Get-WeatherReport -Location "London"
        Retrieves weather for London in Celsius.

    .EXAMPLE
        Get-WeatherReport -Location "10001" -Unit Fahrenheit
        Retrieves weather for ZIP 10001 in Fahrenheit.

    .OUTPUTS
        PSCustomObject with properties: Location, Temperature, Humidity, Forecast.

    .NOTES
        Requires WEATHER_API_KEY environment variable to be set.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Location,

        [Parameter()]
        [ValidateSet('Celsius', 'Fahrenheit')]
        [string]$Unit = 'Celsius'
    )
    # Implementation
}
```

### 9. Output and Logging

Use the correct output streams.

```powershell
# Streams:
Write-Output "Data to pipeline"        # Stream 1: success output
Write-Error "Something failed"          # Stream 2: errors
Write-Warning "Be careful"             # Stream 3: warnings
Write-Verbose "Detailed debug info"    # Stream 4: verbose (needs -Verbose)
Write-Debug "Very detailed info"       # Stream 5: debug (needs -Debug)
Write-Information "Status message"     # Stream 6: information

# Never use Write-Host for data — it bypasses the pipeline
# Use Write-Host only for intentional UI output (progress, prompts)

# Structured output
[PSCustomObject]@{
    Name     = "Widget"
    Count    = 42
    Created  = Get-Date
} | Write-Output
```

### 10. String Handling

Avoid string concatenation in loops.

```powershell
# Good: StringBuilder for many appends
$sb = [System.Text.StringBuilder]::new()
foreach ($item in $items) {
    $null = $sb.AppendLine($item.ToString())
}
$result = $sb.ToString()

# Good: Here-string for multiline
$body = @"
Dear $Name,

Your order $OrderId has shipped.

Regards,
The Team
"@

# Good: -f operator for formatting
$message = "User {0} logged in from {1} at {2}" -f $UserName, $IPAddress, (Get-Date)

# Bad: Concatenation in loop
$result = ""
foreach ($item in $items) {
    $result += $item.ToString()  # O(n²) allocations
}
```

## Testing with Pester

```powershell
# Good test structure with Pester 5
BeforeAll {
    . "$PSScriptRoot/../Public/Get-WeatherReport.ps1"
}

Describe "Get-WeatherReport" {
    Context "When location is valid" {
        BeforeEach {
            Mock Invoke-RestMethod { return @{ temp = 20; humidity = 65 } }
        }

        It "returns a weather object" {
            $result = Get-WeatherReport -Location "London"
            $result | Should -Not -BeNullOrEmpty
            $result.Temperature | Should -Be 20
        }

        It "supports Fahrenheit" {
            $result = Get-WeatherReport -Location "London" -Unit Fahrenheit
            $result.Unit | Should -Be "Fahrenheit"
        }
    }

    Context "When location is invalid" {
        It "throws on empty location" {
            { Get-WeatherReport -Location "" } | Should -Throw
        }
    }
}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | Fix |
|---|---|---|
| `Invoke-Expression $userInput` | Command injection | Parse and validate input first |
| `Write-Host` for data | Bypasses pipeline | Use `Write-Output` |
| Aliases in scripts (`ls`, `%`) | Brittle, unreadable | Use full cmdlet names |
| `-ErrorAction SilentlyContinue` everywhere | Hides bugs | Use `Stop` + `try/catch` |
| `$global:` variables | Side effects | Use parameter passing |
| Hardcoded `\` in paths | Windows-only | Use `Join-Path` |
| `Get-WmiObject` | Deprecated | Use `Get-CimInstance` |
| String concatenation in loops | Performance | Use `StringBuilder` |

## Quick Reference

```powershell
# Parameter validation attributes
[ValidateNotNull()]
[ValidateNotNullOrEmpty()]
[ValidateLength(1, 100)]
[ValidateRange(0, 100)]
[ValidateSet('Option1', 'Option2', 'Option3')]
[ValidatePattern('^\d{5}(-\d{4})?$')]
[ValidateScript({ Test-Path $_ })]

# Common parameter patterns
[Parameter(Mandatory)]                          # Required
[Parameter(ValueFromPipeline)]                  # Accept pipeline input
[Parameter(ValueFromPipelineByPropertyName)]    # Match by property name
[Parameter(ParameterSetName = 'ByName')]        # Parameter sets
[Alias('CN', 'MachineName')]                    # Aliases
```

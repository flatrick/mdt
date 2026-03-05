---
paths:
  - "**/*.ps1"
  - "**/*.psm1"
  - "**/*.psd1"
---
# PowerShell Testing

> This file extends [common/testing.md](../common/testing.md) with PowerShell specific content.

## Framework

Use **Pester 5** as the testing framework.

```powershell
# Install Pester 5
Install-Module Pester -MinimumVersion 5.0 -Force
```

## Coverage

```powershell
# Run with coverage
$config = New-PesterConfiguration
$config.Run.Path = "./Tests"
$config.CodeCoverage.Enabled = $true
$config.CodeCoverage.Path = "./Public"
$config.Output.Verbosity = "Detailed"
Invoke-Pester -Configuration $config
```

## Test Organization

```
Tests/
├── Public/
│   └── Get-Something.Tests.ps1
└── Private/
    └── Invoke-Helper.Tests.ps1
```

## Reference

See skill: `powershell-patterns` for detailed Pester patterns, mocking, and fixture strategies.

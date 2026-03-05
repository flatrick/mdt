---
paths:
  - "**/*.ps1"
  - "**/*.psm1"
  - "**/*.psd1"
---
# PowerShell Hooks

> This file extends [common/hooks.md](../common/hooks.md) with PowerShell specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **PSScriptAnalyzer**: Run after editing `.ps1`/`.psm1` files to catch style and security issues
- **Pester**: Run tests after editing PowerShell module files

## Warnings

- Warn about `Invoke-Expression` usage — potential command injection risk
- Warn about `Write-Host` in non-interactive scripts — use `Write-Output` or `Write-Verbose`
- Warn about `Get-WmiObject` — deprecated, use `Get-CimInstance`

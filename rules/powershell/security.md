---
paths:
  - "**/*.ps1"
  - "**/*.psm1"
  - "**/*.psd1"
---
# PowerShell Security

> This file extends [common/security.md](../common/security.md) with PowerShell specific content.

## Secret Management

```powershell
# Use environment variables
$apiKey = $env:API_KEY
if (-not $apiKey) { throw "API_KEY environment variable is not set" }

# Use SecretManagement module (Microsoft.PowerShell.SecretManagement)
$secret = Get-Secret -Name "MyApiKey" -AsPlainText

# Use SecureString for passwords
$securePass = Read-Host -Prompt "Password" -AsSecureString

# Never do this
$password = "hardcoded-password"  # NEVER
```

## Command Injection Prevention

```powershell
# NEVER use Invoke-Expression with user input
# Bad:
Invoke-Expression "Get-Process $userInput"

# Good: Use cmdlets with validated parameters
[ValidatePattern('^[a-zA-Z0-9_-]+$')]
[string]$ProcessName

Get-Process -Name $ProcessName
```

## Security Scanning

- Use **PSScriptAnalyzer** with security rules:
  ```powershell
  Invoke-ScriptAnalyzer -Path . -Recurse -Settings @{ IncludeRules = @('PSAvoidUsingPlainTextForPassword', 'PSAvoidUsingConvertToSecureStringWithPlainText', 'PSUsePSCredentialType') }
  ```

## Reference

See skill: `powershell-patterns` for secure credential handling and input validation patterns.

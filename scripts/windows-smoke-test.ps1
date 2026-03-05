#Requires -Version 5.1
<#
.SYNOPSIS
Runs an end-to-end Windows smoke test for installation and hook execution.

.DESCRIPTION
Automates the Windows validation flow:
1) Windows parity + PowerShell script tests (+ optional npm test)
2) Isolated install.ps1 run into a temporary HOME/USERPROFILE
3) Verification that observe.sh hook commands were rewritten to observe.ps1
4) Direct invocation of installed observe.ps1 and observation-file validation

.PARAMETER Languages
Language list passed to install.ps1. Defaults to "typescript".

.PARAMETER SkipNpmTest
Skips the full "npm test" step for faster iterative smoke checks.

.PARAMETER KeepTempDir
Keeps temporary HOME directory for manual inspection.
#>

[CmdletBinding()]
param(
    [string[]]$Languages = @('typescript'),
    [switch]$SkipNpmTest,
    [switch]$KeepTempDir
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Assert-CommandExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found in PATH: $Name"
    }
}

function Get-PreferredPowerShellExe {
    $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($pwsh) {
        return $pwsh.Source
    }

    $powershell = Get-Command powershell -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($powershell) {
        return $powershell.Source
    }

    throw 'Neither pwsh nor powershell was found in PATH.'
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter()]
        [string[]]$Arguments = @(),
        [Parameter()]
        [string]$WorkingDirectory = $RepoRoot
    )

    $renderedArgs = if ($Arguments.Count -gt 0) { " $($Arguments -join ' ')" } else { '' }
    Write-Host ">> $FilePath$renderedArgs" -ForegroundColor Cyan

    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        $exitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    if ($null -eq $exitCode) {
        $exitCode = 0
    }
    if ($exitCode -ne 0) {
        throw "Command failed with exit code ${exitCode}: $FilePath$renderedArgs"
    }
}

Write-Host "Repo root: $RepoRoot"
Assert-CommandExists -Name node
Assert-CommandExists -Name npm

Write-Host "`nStep 1/4: run Windows parity + script tests" -ForegroundColor Yellow
Invoke-CheckedCommand -FilePath 'node' -Arguments @('scripts/ci/validate-windows-parity.js')
Invoke-CheckedCommand -FilePath 'node' -Arguments @('tests/scripts/powershell-scripts.test.js')
if (-not $SkipNpmTest) {
    Invoke-CheckedCommand -FilePath 'npm' -Arguments @('test')
}
else {
    Write-Host "Skipping npm test due to -SkipNpmTest" -ForegroundColor DarkYellow
}

Write-Host "`nStep 2/4: run install.ps1 in isolated temporary HOME" -ForegroundColor Yellow
$tempHome = Join-Path $env:TEMP ("ecc-smoke-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempHome -Force | Out-Null

$oldHome = $env:HOME
$oldUserProfile = $env:USERPROFILE
$psExe = Get-PreferredPowerShellExe

try {
    $env:HOME = $tempHome
    $env:USERPROFILE = $tempHome

    $installArgs = @(
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        (Join-Path $RepoRoot 'install.ps1')
    ) + $Languages

    Invoke-CheckedCommand -FilePath $psExe -Arguments $installArgs -WorkingDirectory $RepoRoot

    Write-Host "`nStep 3/4: verify observe hook command rewrite (.sh -> .ps1)" -ForegroundColor Yellow
    $settingsPath = Join-Path $tempHome '.claude\settings.json'
    if (-not (Test-Path -LiteralPath $settingsPath)) {
        throw "Expected settings.json was not created: $settingsPath"
    }

    $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
    $hookCommands = foreach ($eventProperty in $settings.hooks.PSObject.Properties) {
        foreach ($matcher in $eventProperty.Value) {
            if ($null -eq $matcher.hooks) {
                continue
            }
            foreach ($hook in $matcher.hooks) {
                if ($hook.command -is [string]) {
                    $hook.command
                }
            }
        }
    }

    $observeShCommands = @($hookCommands | Where-Object { $_ -match 'observe\.sh' })
    $observePs1Commands = @($hookCommands | Where-Object { $_ -match 'observe\.ps1' })

    if ($observeShCommands.Count -gt 0) {
        throw "Found .sh observe hook command(s) after Windows install: $($observeShCommands -join ' | ')"
    }
    if ($observePs1Commands.Count -lt 1) {
        throw 'No observe.ps1 hook command found after Windows install.'
    }

    Write-Host "`nStep 4/4: invoke installed observe.ps1 and validate output file" -ForegroundColor Yellow
    $observeScript = Join-Path $tempHome '.claude\skills\continuous-learning-v2\hooks\observe.ps1'
    if (-not (Test-Path -LiteralPath $observeScript)) {
        throw "Expected observe.ps1 was not installed: $observeScript"
    }

    $payload = @{
        session_id = 'windows-smoke'
        tool_name  = 'Read'
        tool_input = @{ file_path = 'README.md' }
        cwd        = $RepoRoot
    } | ConvertTo-Json -Compress

    $payload | & $psExe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $observeScript pre
    $observeExit = $LASTEXITCODE
    if ($observeExit -ne 0) {
        throw "observe.ps1 failed with exit code $observeExit"
    }

    $observationsRoot = Join-Path $tempHome '.claude\homunculus\projects'
    $observationFiles = @(Get-ChildItem -Path $observationsRoot -Recurse -File -Filter 'observations.jsonl' -ErrorAction SilentlyContinue)
    if ($observationFiles.Count -lt 1) {
        throw "No observations.jsonl files found under: $observationsRoot"
    }

    $latestObservation = $observationFiles | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    $lastLine = Get-Content -LiteralPath $latestObservation.FullName -Tail 1
    if ([string]::IsNullOrWhiteSpace($lastLine)) {
        throw "Latest observation file has no content: $($latestObservation.FullName)"
    }

    $parsedLine = $lastLine | ConvertFrom-Json
    if ($parsedLine.event -ne 'tool_start') {
        throw "Unexpected event in latest observation line. Expected 'tool_start', got '$($parsedLine.event)'"
    }

    Write-Host "Observation file verified: $($latestObservation.FullName)" -ForegroundColor Green
    Write-Host "`nWindows smoke test passed." -ForegroundColor Green
    if ($KeepTempDir) {
        Write-Host "Temp HOME kept for inspection: $tempHome" -ForegroundColor DarkYellow
    }
}
finally {
    $env:HOME = $oldHome
    $env:USERPROFILE = $oldUserProfile

    if ((-not $KeepTempDir) -and (Test-Path -LiteralPath $tempHome)) {
        Remove-Item -LiteralPath $tempHome -Recurse -Force -ErrorAction SilentlyContinue
    }
}

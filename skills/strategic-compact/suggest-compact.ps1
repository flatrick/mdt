#Requires -Version 5.1
# Strategic Compact Suggester (Windows PowerShell)
#
# Windows-compatible version of suggest-compact.sh.

$ErrorActionPreference = 'Stop'

function Get-IntOrDefault {
    param(
        [string]$Value,
        [int]$DefaultValue
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $DefaultValue
    }

    $parsed = 0
    if ([int]::TryParse($Value, [ref]$parsed) -and $parsed -gt 0) {
        return $parsed
    }

    return $DefaultValue
}

$sessionId = if (-not [string]::IsNullOrWhiteSpace([string]$env:CLAUDE_SESSION_ID)) {
    [string]$env:CLAUDE_SESSION_ID
} elseif (-not [string]::IsNullOrWhiteSpace([string]$env:PPID)) {
    [string]$env:PPID
} else {
    'default'
}

$counterFile = Join-Path ([System.IO.Path]::GetTempPath()) "claude-tool-count-$sessionId"
$threshold = Get-IntOrDefault -Value ([string]$env:COMPACT_THRESHOLD) -DefaultValue 50

$count = 1
if (Test-Path -LiteralPath $counterFile -PathType Leaf) {
    $existing = Get-Content -LiteralPath $counterFile -Raw -ErrorAction SilentlyContinue
    $parsed = 0
    if ([int]::TryParse(($existing | ForEach-Object { $_.Trim() }), [ref]$parsed) -and $parsed -ge 0) {
        $count = $parsed + 1
    }
}

[System.IO.File]::WriteAllText($counterFile, [string]$count, [System.Text.Encoding]::UTF8)

if ($count -eq $threshold) {
    [Console]::Error.WriteLine("[StrategicCompact] $threshold tool calls reached - consider /compact if transitioning phases")
}

if ($count -gt $threshold -and ($count % 25 -eq 0)) {
    [Console]::Error.WriteLine("[StrategicCompact] $count tool calls - good checkpoint for /compact if context is stale")
}

exit 0

#Requires -Version 5.1
# Continuous Learning - Session Evaluator (Windows PowerShell)
#
# Windows-compatible version of evaluate-session.sh.

$ErrorActionPreference = 'Stop'

function Resolve-UserPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PathValue
    )

    if ($PathValue -match '^~([\\/]|$)') {
        $suffix = $PathValue.Substring(1).TrimStart('\', '/')
        if ([string]::IsNullOrEmpty($suffix)) {
            return $HOME
        }
        return Join-Path $HOME $suffix
    }

    return $PathValue
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configFile = Join-Path $scriptDir 'config.json'
$learnedSkillsPath = Join-Path $HOME '.claude\skills\learned'
$minSessionLength = 10

if (Test-Path -LiteralPath $configFile) {
    try {
        $cfg = Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json

        if ($null -ne $cfg.min_session_length) {
            $parsed = 0
            if ([int]::TryParse([string]$cfg.min_session_length, [ref]$parsed) -and $parsed -gt 0) {
                $minSessionLength = $parsed
            }
        }

        if (-not [string]::IsNullOrWhiteSpace([string]$cfg.learned_skills_path)) {
            $learnedSkillsPath = Resolve-UserPath -PathValue ([string]$cfg.learned_skills_path)
        }
    } catch {
        [Console]::Error.WriteLine("[ContinuousLearning] Failed to parse config.json, using defaults")
    }
}

New-Item -ItemType Directory -Force -Path $learnedSkillsPath | Out-Null

$stdinData = [Console]::In.ReadToEnd()
$transcriptPath = ''

if (-not [string]::IsNullOrWhiteSpace($stdinData)) {
    try {
        $input = $stdinData | ConvertFrom-Json
        if ($input.PSObject.Properties.Name -contains 'transcript_path') {
            $transcriptPath = [string]$input.transcript_path
        }
    } catch {
        # Fall back to environment variable for malformed stdin payloads.
    }
}

if ([string]::IsNullOrWhiteSpace($transcriptPath)) {
    $transcriptPath = [string]$env:CLAUDE_TRANSCRIPT_PATH
}

if ([string]::IsNullOrWhiteSpace($transcriptPath) -or -not (Test-Path -LiteralPath $transcriptPath -PathType Leaf)) {
    exit 0
}

$messageCount = 0
try {
    $content = Get-Content -LiteralPath $transcriptPath -Raw -ErrorAction Stop
    $messageCount = [regex]::Matches($content, '"type"\s*:\s*"user"').Count
} catch {
    $messageCount = 0
}

if ($messageCount -lt $minSessionLength) {
    [Console]::Error.WriteLine("[ContinuousLearning] Session too short ($messageCount messages), skipping")
    exit 0
}

[Console]::Error.WriteLine("[ContinuousLearning] Session has $messageCount messages - evaluate for extractable patterns")
[Console]::Error.WriteLine("[ContinuousLearning] Save learned skills to: $learnedSkillsPath")
exit 0

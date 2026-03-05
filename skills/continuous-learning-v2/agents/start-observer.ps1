#Requires -Version 5.1
# Continuous Learning v2 - Observer Agent Launcher (Windows PowerShell)
#
# Windows-compatible version of start-observer.sh.

[CmdletBinding()]
param(
    [ValidateSet('start', 'stop', 'status')]
    [string]$Action = 'start',

    [switch]$RunLoop,

    [string]$ConfigDir,
    [string]$PidFile,
    [string]$LogFile,
    [string]$ObservationsFile,
    [string]$InstinctsDir,
    [string]$ProjectDir,
    [string]$ProjectName,
    [string]$ProjectId,
    [int]$MinObservations = 20,
    [int]$ObserverIntervalSeconds = 300
)

$ErrorActionPreference = 'Stop'

function Write-ObserverLog {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -LiteralPath $FilePath -Value "[$stamp] $Message" -Encoding UTF8
}

function Test-ObserverProcess {
    param(
        [int]$ProcessId
    )

    if ($ProcessId -le 0) {
        return $false
    }

    try {
        Get-Process -Id $ProcessId -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Get-ObserverObservationCount {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath
    )

    if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
        return 0
    }

    try {
        return (Get-Content -LiteralPath $FilePath -ErrorAction Stop | Measure-Object -Line).Lines
    } catch {
        return 0
    }
}

function Invoke-ObserverAnalysis {
    param(
        [string]$LogPath,
        [string]$ObservationsPath,
        [string]$InstinctsPath,
        [string]$ProjDir,
        [string]$ProjName,
        [string]$ProjId,
        [int]$MinimumObservations
    )

    if (-not (Test-Path -LiteralPath $ObservationsPath -PathType Leaf)) {
        return
    }

    $obsCount = Get-ObserverObservationCount -FilePath $ObservationsPath
    if ($obsCount -lt $MinimumObservations) {
        return
    }

    Write-ObserverLog -FilePath $LogPath -Message "Analyzing $obsCount observations for project $ProjName..."

    $claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
    if ($claudeCmd) {
        $prompt = @"
Read $ObservationsPath and identify patterns for the project '$ProjName' (user corrections, error resolutions, repeated workflows, tool preferences).
If you find 3+ occurrences of the same pattern, create an instinct file in $InstinctsPath/<id>.md.

CRITICAL: Every instinct file MUST use this exact format:

---
id: kebab-case-name
trigger: "when <specific condition>"
confidence: <0.3-0.85 based on frequency: 3-5 times=0.5, 6-10=0.7, 11+=0.85>
domain: <one of: code-style, testing, git, debugging, workflow, file-patterns>
source: session-observation
scope: project
project_id: $ProjId
project_name: $ProjName
---

# Title

## Action
<what to do, one clear sentence>

## Evidence
- Observed N times in session <id>
- Pattern: <description>
- Last observed: <date>

Rules:
- Be conservative, only clear patterns with 3+ observations
- Use narrow, specific triggers
- Never include actual code snippets, only describe patterns
- If a similar instinct already exists in $InstinctsPath/, update it instead of creating a duplicate
- The YAML frontmatter (between --- markers) with id field is MANDATORY
- If a pattern seems universal (not project-specific), set scope to 'global' instead of 'project'
- Examples of global patterns: 'always validate user input', 'prefer explicit error handling'
- Examples of project patterns: 'use React functional components', 'follow Django REST framework conventions'
"@

        try {
            $output = & claude --model haiku --max-turns 3 --print $prompt 2>&1
            if ($output) {
                Add-Content -LiteralPath $LogPath -Value $output -Encoding UTF8
            }
            if ($LASTEXITCODE -ne 0) {
                Write-ObserverLog -FilePath $LogPath -Message "Claude analysis failed (exit $LASTEXITCODE)"
            }
        } catch {
            Write-ObserverLog -FilePath $LogPath -Message "Claude analysis failed: $($_.Exception.Message)"
        }
    } else {
        Write-ObserverLog -FilePath $LogPath -Message 'claude CLI not found, skipping analysis'
    }

    if (Test-Path -LiteralPath $ObservationsPath -PathType Leaf) {
        $archiveDir = Join-Path $ProjDir 'observations.archive'
        New-Item -ItemType Directory -Force -Path $archiveDir | Out-Null
        $archiveName = 'processed-{0}-{1}.jsonl' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $PID
        $archivePath = Join-Path $archiveDir $archiveName
        Move-Item -LiteralPath $ObservationsPath -Destination $archivePath -Force -ErrorAction SilentlyContinue
    }
}

if ($RunLoop) {
    New-Item -ItemType Directory -Force -Path (Split-Path $PidFile -Parent) | Out-Null
    New-Item -ItemType Directory -Force -Path (Split-Path $LogFile -Parent) | Out-Null
    New-Item -ItemType Directory -Force -Path $InstinctsDir | Out-Null

    Set-Content -LiteralPath $PidFile -Value $PID -Encoding UTF8
    Write-ObserverLog -FilePath $LogFile -Message "Observer started for $ProjectName (PID: $PID)"

    while ($true) {
        try {
            Invoke-ObserverAnalysis `
                -LogPath $LogFile `
                -ObservationsPath $ObservationsFile `
                -InstinctsPath $InstinctsDir `
                -ProjDir $ProjectDir `
                -ProjName $ProjectName `
                -ProjId $ProjectId `
                -MinimumObservations $MinObservations
        } catch {
            Write-ObserverLog -FilePath $LogFile -Message "Observer loop error: $($_.Exception.Message)"
        }

        Start-Sleep -Seconds ([Math]::Max(5, $ObserverIntervalSeconds))
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillRoot = Resolve-Path (Join-Path $scriptDir '..')
$detectScript = Join-Path $skillRoot 'scripts\detect-project.ps1'
$configFile = Join-Path $skillRoot 'config.json'

$projectContext = [ordered]@{
    id          = 'global'
    name        = 'global'
    root        = ''
    project_dir = Join-Path $HOME '.claude\homunculus'
}

if (Test-Path -LiteralPath $detectScript -PathType Leaf) {
    try {
        $json = & $detectScript -AsJson
        if (-not [string]::IsNullOrWhiteSpace([string]$json)) {
            $projectContext = $json | ConvertFrom-Json
        }
    } catch {
        # Fall back to global defaults.
    }
}

$configDir = Join-Path $HOME '.claude\homunculus'
$pidFile = Join-Path $projectContext.project_dir '.observer.pid'
$logFile = Join-Path $projectContext.project_dir 'observer.log'
$observationsFile = Join-Path $projectContext.project_dir 'observations.jsonl'
$instinctsDir = Join-Path $projectContext.project_dir 'instincts\personal'
$observerIntervalMinutes = 5
$minObservationsToAnalyze = 20
$observerEnabled = $false

if (Test-Path -LiteralPath $configFile -PathType Leaf) {
    try {
        $cfg = Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json
        if ($cfg.observer) {
            $intVal = 0
            if ([int]::TryParse([string]$cfg.observer.run_interval_minutes, [ref]$intVal) -and $intVal -gt 0) {
                $observerIntervalMinutes = $intVal
            }
            if ([int]::TryParse([string]$cfg.observer.min_observations_to_analyze, [ref]$intVal) -and $intVal -gt 0) {
                $minObservationsToAnalyze = $intVal
            }
            $observerEnabled = [bool]$cfg.observer.enabled
        }
    } catch {
        # Keep defaults when config is malformed.
    }
}

$observerIntervalSeconds = $observerIntervalMinutes * 60

Write-Output ("Project: {0} ({1})" -f $projectContext.name, $projectContext.id)
Write-Output ("Storage: {0}" -f $projectContext.project_dir)

switch ($Action) {
    'stop' {
        if (Test-Path -LiteralPath $pidFile -PathType Leaf) {
            $pidText = Get-Content -LiteralPath $pidFile -Raw
            $pidValue = 0
            if ([int]::TryParse(($pidText | ForEach-Object { $_.Trim() }), [ref]$pidValue) -and (Test-ObserverProcess -ProcessId $pidValue)) {
                Write-Output ("Stopping observer for {0} (PID: {1})..." -f $projectContext.name, $pidValue)
                Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
                Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
                Write-Output 'Observer stopped.'
            } else {
                Write-Output 'Observer not running (stale PID file).'
                Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
            }
        } else {
            Write-Output 'Observer not running.'
        }
        exit 0
    }

    'status' {
        if (Test-Path -LiteralPath $pidFile -PathType Leaf) {
            $pidText = Get-Content -LiteralPath $pidFile -Raw
            $pidValue = 0
            if ([int]::TryParse(($pidText | ForEach-Object { $_.Trim() }), [ref]$pidValue) -and (Test-ObserverProcess -ProcessId $pidValue)) {
                $obsLines = Get-ObserverObservationCount -FilePath $observationsFile
                $instinctCount = if (Test-Path -LiteralPath $instinctsDir -PathType Container) {
                    (Get-ChildItem -LiteralPath $instinctsDir -Filter '*.yaml' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
                } else { 0 }

                Write-Output ("Observer is running (PID: {0})" -f $pidValue)
                Write-Output ("Log: {0}" -f $logFile)
                Write-Output ("Observations: {0} lines" -f $obsLines)
                Write-Output ("Instincts: {0}" -f $instinctCount)
                exit 0
            }

            Write-Output 'Observer not running (stale PID file)'
            Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
            exit 1
        }

        Write-Output 'Observer not running'
        exit 1
    }

    'start' {
        if (-not $observerEnabled) {
            Write-Output 'Observer is disabled in config.json (observer.enabled: false).'
            Write-Output 'Set observer.enabled to true in config.json to enable.'
            exit 1
        }

        if (Test-Path -LiteralPath $pidFile -PathType Leaf) {
            $pidText = Get-Content -LiteralPath $pidFile -Raw
            $pidValue = 0
            if ([int]::TryParse(($pidText | ForEach-Object { $_.Trim() }), [ref]$pidValue) -and (Test-ObserverProcess -ProcessId $pidValue)) {
                Write-Output ("Observer already running for {0} (PID: {1})" -f $projectContext.name, $pidValue)
                exit 0
            }
            Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
        }

        Write-Output ("Starting observer agent for {0}..." -f $projectContext.name)

        $psExe = (Get-Command pwsh -ErrorAction SilentlyContinue | Select-Object -First 1).Source
        if ([string]::IsNullOrWhiteSpace($psExe)) {
            $psExe = 'powershell.exe'
        }

        $argumentList = @(
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy', 'Bypass',
            '-File', $MyInvocation.MyCommand.Path,
            '-RunLoop',
            '-ConfigDir', $configDir,
            '-PidFile', $pidFile,
            '-LogFile', $logFile,
            '-ObservationsFile', $observationsFile,
            '-InstinctsDir', $instinctsDir,
            '-ProjectDir', $projectContext.project_dir,
            '-ProjectName', $projectContext.name,
            '-ProjectId', $projectContext.id,
            '-MinObservations', [string]$minObservationsToAnalyze,
            '-ObserverIntervalSeconds', [string]$observerIntervalSeconds
        )

        Start-Process -FilePath $psExe -ArgumentList $argumentList | Out-Null
        Start-Sleep -Seconds 2

        if (Test-Path -LiteralPath $pidFile -PathType Leaf) {
            $pidText = Get-Content -LiteralPath $pidFile -Raw
            $pidValue = 0
            if ([int]::TryParse(($pidText | ForEach-Object { $_.Trim() }), [ref]$pidValue) -and (Test-ObserverProcess -ProcessId $pidValue)) {
                Write-Output ("Observer started (PID: {0})" -f $pidValue)
                Write-Output ("Log: {0}" -f $logFile)
                exit 0
            }
        }

        Write-Output ("Failed to start observer (check {0})" -f $logFile)
        exit 1
    }
}

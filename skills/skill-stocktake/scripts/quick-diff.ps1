#Requires -Version 5.1
# quick-diff.ps1 — compare skill file mtimes against results.json evaluated_at
# Usage: quick-diff.ps1 RESULTS_JSON [CWD_SKILLS_DIR]
# Output: JSON array of changed/new files to stdout (empty [] if no changes)

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ResultsJson,
    [Parameter(Position = 1)]
    [string]$CwdSkillsDir
)

$ErrorActionPreference = 'Stop'

function Convert-ToTildePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PathValue
    )

    $homePrefix = [regex]::Escape(([IO.Path]::GetFullPath($HOME)).TrimEnd('\'))
    return ($PathValue -replace "^$homePrefix", '~')
}

function Get-KnownSkillPaths {
    param(
        $SkillsNode
    )

    $paths = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
    if ($null -eq $SkillsNode) {
        return ,$paths
    }

    if ($SkillsNode -is [System.Collections.IEnumerable] -and -not ($SkillsNode -is [string])) {
        # Arrays of entries
        foreach ($entry in $SkillsNode) {
            if ($entry -and $entry.PSObject.Properties.Name -contains 'path' -and -not [string]::IsNullOrWhiteSpace([string]$entry.path)) {
                [void]$paths.Add([string]$entry.path)
            }
        }
        return ,$paths
    }

    # Object map: each property value is a skill record
    if ($SkillsNode.PSObject -and $SkillsNode.PSObject.Properties) {
        foreach ($prop in $SkillsNode.PSObject.Properties) {
            $value = $prop.Value
            if ($value -and $value.PSObject.Properties.Name -contains 'path' -and -not [string]::IsNullOrWhiteSpace([string]$value.path)) {
                [void]$paths.Add([string]$value.path)
            }
        }
    }

    return ,$paths
}

if (-not (Test-Path -LiteralPath $ResultsJson -PathType Leaf)) {
    [Console]::Error.WriteLine("Error: RESULTS_JSON not found: $ResultsJson")
    exit 1
}

if ([string]::IsNullOrWhiteSpace($CwdSkillsDir)) {
    $CwdSkillsDir = if (-not [string]::IsNullOrWhiteSpace([string]$env:SKILL_STOCKTAKE_PROJECT_DIR)) {
        [string]$env:SKILL_STOCKTAKE_PROJECT_DIR
    } else {
        Join-Path (Get-Location).Path '.claude\skills'
    }
}

$globalDir = if (-not [string]::IsNullOrWhiteSpace([string]$env:SKILL_STOCKTAKE_GLOBAL_DIR)) {
    [string]$env:SKILL_STOCKTAKE_GLOBAL_DIR
} else {
    Join-Path $HOME '.claude\skills'
}

if (-not [string]::IsNullOrWhiteSpace($CwdSkillsDir) -and
    (Test-Path -LiteralPath $CwdSkillsDir -PathType Container) -and
    ($CwdSkillsDir -notmatch '[\\/]\.claude[\\/]skills')) {
    [Console]::Error.WriteLine("Warning: CWD_SKILLS_DIR does not look like a .claude/skills path: $CwdSkillsDir")
}

$results = Get-Content -LiteralPath $ResultsJson -Raw | ConvertFrom-Json
$evaluatedAtValue = $results.evaluated_at
$evaluatedAt = if ($evaluatedAtValue -is [datetime]) {
    # ConvertFrom-Json in Windows PowerShell can coerce ISO timestamps to DateTime.
    $evaluatedAtValue.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
} else {
    [string]$evaluatedAtValue
}
if ($evaluatedAt -notmatch '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$') {
    [Console]::Error.WriteLine("Error: invalid or missing evaluated_at in ${ResultsJson}: $evaluatedAt")
    exit 1
}

$knownPaths = Get-KnownSkillPaths -SkillsNode $results.skills
$changed = New-Object System.Collections.ArrayList

function Add-ChangedSkillsFromDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DirectoryPath
    )

    if (-not (Test-Path -LiteralPath $DirectoryPath -PathType Container)) {
        return
    }

    $files = Get-ChildItem -LiteralPath $DirectoryPath -Recurse -File -Filter '*.md' -ErrorAction SilentlyContinue |
        Sort-Object FullName

    foreach ($file in $files) {
        $mtime = $file.LastWriteTimeUtc.ToString('yyyy-MM-ddTHH:mm:ssZ')
        $displayPath = Convert-ToTildePath -PathValue $file.FullName
        $isNew = -not $knownPaths.Contains($displayPath)

        if (-not $isNew -and $mtime -le $evaluatedAt) {
            continue
        }

        [void]$changed.Add([ordered]@{
                path   = $displayPath
                mtime  = $mtime
                is_new = [bool]$isNew
            })
    }
}

Add-ChangedSkillsFromDirectory -DirectoryPath $globalDir
if (-not [string]::IsNullOrWhiteSpace($CwdSkillsDir)) {
    Add-ChangedSkillsFromDirectory -DirectoryPath $CwdSkillsDir
}

ConvertTo-Json -InputObject $changed -Depth 10

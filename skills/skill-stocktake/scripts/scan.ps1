#Requires -Version 5.1
# scan.ps1 — enumerate skill files, extract frontmatter and UTC mtime
# Usage: scan.ps1 [CWD_SKILLS_DIR]
# Output: JSON to stdout

[CmdletBinding()]
param(
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

function Get-FrontmatterField {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [string]$Field
    )

    $inFrontmatter = $false
    $seenDelimiters = 0

    foreach ($line in Get-Content -LiteralPath $FilePath -ErrorAction SilentlyContinue) {
        if ($line -eq '---') {
            $seenDelimiters++
            if ($seenDelimiters -eq 1) {
                $inFrontmatter = $true
            } else {
                break
            }
            continue
        }

        if (-not $inFrontmatter) {
            continue
        }

        if ($line -match ('^{0}:\s*(.*)$' -f [regex]::Escape($Field))) {
            $value = [string]$matches[1]
            return $value.Trim().Trim('"')
        }
    }

    return ''
}

function Get-ObservationCounts {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ObservationsPath,
        [Parameter(Mandatory = $true)]
        [string]$CutoffIso
    )

    $counts = @{}
    if (-not (Test-Path -LiteralPath $ObservationsPath -PathType Leaf)) {
        return $counts
    }

    foreach ($line in Get-Content -LiteralPath $ObservationsPath -ErrorAction SilentlyContinue) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        try {
            $entry = $line | ConvertFrom-Json
            if ($entry.tool -ne 'Read') {
                continue
            }
            if ([string]::IsNullOrWhiteSpace([string]$entry.path)) {
                continue
            }
            if ([string]::IsNullOrWhiteSpace([string]$entry.timestamp) -or ([string]$entry.timestamp -lt $CutoffIso)) {
                continue
            }

            $key = [string]$entry.path
            if (-not $counts.ContainsKey($key)) {
                $counts[$key] = 0
            }
            $counts[$key]++
        } catch {
            # Skip malformed observation lines.
        }
    }

    return $counts
}

function Scan-DirectorySkills {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DirectoryPath,
        [hashtable]$Counts7d,
        [hashtable]$Counts30d
    )

    $skills = @()
    if (-not (Test-Path -LiteralPath $DirectoryPath -PathType Container)) {
        return $skills
    }

    $files = Get-ChildItem -LiteralPath $DirectoryPath -Recurse -File -Filter '*.md' -ErrorAction SilentlyContinue |
        Sort-Object FullName

    foreach ($file in $files) {
        $fullPath = $file.FullName
        $displayPath = Convert-ToTildePath -PathValue $fullPath
        $mtime = $file.LastWriteTimeUtc.ToString('yyyy-MM-ddTHH:mm:ssZ')
        $use7d = if ($Counts7d.ContainsKey($fullPath)) { [int]$Counts7d[$fullPath] } else { 0 }
        $use30d = if ($Counts30d.ContainsKey($fullPath)) { [int]$Counts30d[$fullPath] } else { 0 }

        $skills += [ordered]@{
            path        = $displayPath
            name        = Get-FrontmatterField -FilePath $fullPath -Field 'name'
            description = Get-FrontmatterField -FilePath $fullPath -Field 'description'
            use_7d      = $use7d
            use_30d     = $use30d
            mtime       = $mtime
        }
    }

    return $skills
}

$globalDir = if (-not [string]::IsNullOrWhiteSpace([string]$env:SKILL_STOCKTAKE_GLOBAL_DIR)) {
    [string]$env:SKILL_STOCKTAKE_GLOBAL_DIR
} else {
    Join-Path $HOME '.claude\skills'
}

if ([string]::IsNullOrWhiteSpace($CwdSkillsDir)) {
    $CwdSkillsDir = if (-not [string]::IsNullOrWhiteSpace([string]$env:SKILL_STOCKTAKE_PROJECT_DIR)) {
        [string]$env:SKILL_STOCKTAKE_PROJECT_DIR
    } else {
        Join-Path (Get-Location).Path '.claude\skills'
    }
}

$observationsPath = if (-not [string]::IsNullOrWhiteSpace([string]$env:SKILL_STOCKTAKE_OBSERVATIONS)) {
    [string]$env:SKILL_STOCKTAKE_OBSERVATIONS
} else {
    Join-Path $HOME '.claude\observations.jsonl'
}

if (-not [string]::IsNullOrWhiteSpace($CwdSkillsDir) -and
    (Test-Path -LiteralPath $CwdSkillsDir -PathType Container) -and
    ($CwdSkillsDir -notmatch '[\\/]\.claude[\\/]skills')) {
    [Console]::Error.WriteLine("Warning: CWD_SKILLS_DIR does not look like a .claude/skills path: $CwdSkillsDir")
}

$cutoff7d = (Get-Date).ToUniversalTime().AddDays(-7).ToString('yyyy-MM-ddTHH:mm:ssZ')
$cutoff30d = (Get-Date).ToUniversalTime().AddDays(-30).ToString('yyyy-MM-ddTHH:mm:ssZ')
$counts7d = Get-ObservationCounts -ObservationsPath $observationsPath -CutoffIso $cutoff7d
$counts30d = Get-ObservationCounts -ObservationsPath $observationsPath -CutoffIso $cutoff30d

$globalFound = Test-Path -LiteralPath $globalDir -PathType Container
$globalSkills = if ($globalFound) {
    Scan-DirectorySkills -DirectoryPath $globalDir -Counts7d $counts7d -Counts30d $counts30d
} else {
    @()
}

$projectFound = -not [string]::IsNullOrWhiteSpace($CwdSkillsDir) -and (Test-Path -LiteralPath $CwdSkillsDir -PathType Container)
$projectSkills = if ($projectFound) {
    Scan-DirectorySkills -DirectoryPath $CwdSkillsDir -Counts7d $counts7d -Counts30d $counts30d
} else {
    @()
}

$allSkills = @($globalSkills + $projectSkills)

$result = [ordered]@{
    scan_summary = [ordered]@{
        global  = [ordered]@{
            found = [bool]$globalFound
            count = [int]$globalSkills.Count
        }
        project = [ordered]@{
            found = [bool]$projectFound
            path  = if ($projectFound) { $CwdSkillsDir } else { '' }
            count = [int]$projectSkills.Count
        }
    }
    skills       = $allSkills
}

$result | ConvertTo-Json -Depth 20

#Requires -Version 5.1
# Continuous Learning v2 - Observation Hook (Windows PowerShell)
# Windows-compatible replacement for observe.sh
#
# Reads Claude Code hook JSON from stdin and appends an observation
# entry to the project-scoped observations.jsonl file.
#
# Usage (matches observe.sh interface):
#   powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass `
#     -File observe.ps1 [pre|post]
#
# Default phase is "post" (tool_complete) when no argument is supplied,
# matching the behaviour of the original bash script.

param(
    [string]$HookPhase = "post"
)

# ── Read stdin ───────────────────────────────────────────────────────────────
$inputJson = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($inputJson)) { exit 0 }

try {
    $data = $inputJson | ConvertFrom-Json
} catch {
    # Log parse failure as a raw entry then exit cleanly (mirrors observe.sh fallback)
    $fallbackDir  = "$env:USERPROFILE\.claude\homunculus"
    $fallbackFile = "$fallbackDir\observations.jsonl"
    $raw          = if ($inputJson.Length -gt 2000) { $inputJson.Substring(0, 2000) } else { $inputJson }
    $ts           = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $entry        = [ordered]@{ timestamp = $ts; event = "parse_error"; raw = $raw } | ConvertTo-Json -Compress
    New-Item -ItemType Directory -Force -Path $fallbackDir -ErrorAction SilentlyContinue | Out-Null
    [System.IO.File]::AppendAllText($fallbackFile, "$entry`n", [System.Text.Encoding]::UTF8)
    exit 0
}

# ── Config ───────────────────────────────────────────────────────────────────
$homunculusDir = "$env:USERPROFILE\.claude\homunculus"
$projectsDir   = "$homunculusDir\projects"
$registryFile  = "$homunculusDir\projects.json"

# Skip if disabled
if (Test-Path "$homunculusDir\disabled") { exit 0 }

# ── Project detection ────────────────────────────────────────────────────────
# Use cwd from hook JSON for project detection (avoids spawning extra git calls)
$stdinCwd = if ($data.cwd) { [string]$data.cwd } else { "" }
if ($stdinCwd -and (Test-Path $stdinCwd -PathType Container)) {
    $env:CLAUDE_PROJECT_DIR = $stdinCwd
}

$projectRoot = ""
$remoteUrl   = ""

# Priority 1: CLAUDE_PROJECT_DIR env var
if ($env:CLAUDE_PROJECT_DIR -and (Test-Path $env:CLAUDE_PROJECT_DIR -PathType Container)) {
    $projectRoot = $env:CLAUDE_PROJECT_DIR
}

# Priority 2: git repo root from CWD
if (-not $projectRoot) {
    $gitOut = & git rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -eq 0 -and $gitOut) {
        $projectRoot = $gitOut.Trim()
    }
}

# Priority 3: fall back to global scope
if (-not $projectRoot) {
    $projectId   = "global"
    $projectName = "global"
    $projectDir  = $homunculusDir
} else {
    $projectName = Split-Path $projectRoot -Leaf

    # Prefer git remote URL as hash input (portable across machines)
    $gitRemote = & git -C $projectRoot remote get-url origin 2>$null
    if ($LASTEXITCODE -eq 0 -and $gitRemote) {
        $remoteUrl = $gitRemote.Trim()
    }

    $hashInput = if ($remoteUrl) { $remoteUrl } else { $projectRoot }
    $sha256    = [System.Security.Cryptography.SHA256]::Create()
    $hashBytes = $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($hashInput))
    $projectId = ([System.BitConverter]::ToString($hashBytes) -replace '-', '').ToLower().Substring(0, 12)

    $projectDir = "$projectsDir\$projectId"

    # Ensure required directory structure exists
    foreach ($dir in @(
        "$projectDir\instincts\personal",
        "$projectDir\instincts\inherited",
        "$projectDir\observations.archive",
        "$projectDir\evolved\skills",
        "$projectDir\evolved\commands",
        "$projectDir\evolved\agents"
    )) {
        New-Item -ItemType Directory -Force -Path $dir -ErrorAction SilentlyContinue | Out-Null
    }

    # Update project registry (lightweight JSON map of known projects)
    $registry = @{}
    if (Test-Path $registryFile) {
        try {
            $existing = Get-Content $registryFile -Raw | ConvertFrom-Json
            foreach ($prop in $existing.PSObject.Properties) {
                $registry[$prop.Name] = $prop.Value
            }
        } catch {}
    }
    $now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $registry[$projectId] = [ordered]@{
        name      = $projectName
        root      = $projectRoot
        remote    = $remoteUrl
        last_seen = $now
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $registryFile) -ErrorAction SilentlyContinue | Out-Null
    $registry | ConvertTo-Json -Depth 5 | Set-Content $registryFile -Encoding UTF8
}

# ── Parse event fields ───────────────────────────────────────────────────────
$event      = if ($HookPhase -eq "pre") { "tool_start" } else { "tool_complete" }
$toolName   = if ($data.tool_name) { [string]$data.tool_name } `
              elseif ($data.tool)  { [string]$data.tool } `
              else                 { "unknown" }
$toolInput  = if ($null -ne $data.tool_input) { $data.tool_input } `
              elseif ($null -ne $data.input)  { $data.input } `
              else                            { $null }
$toolOutput = if ($null -ne $data.tool_output) { $data.tool_output } `
              elseif ($null -ne $data.output)  { $data.output } `
              else                             { "" }
$sessionId  = if ($data.session_id) { [string]$data.session_id } else { "unknown" }

# Truncate large payloads to 5000 chars (mirrors original python truncation)
function Truncate-Json {
    param($value, [int]$max = 5000)
    if ($null -eq $value) { return $null }
    $s = if ($value -is [string]) { $value } else { $value | ConvertTo-Json -Compress -Depth 10 }
    if ($s.Length -gt $max) { $s.Substring(0, $max) } else { $s }
}

$toolInputStr  = Truncate-Json $toolInput
$toolOutputStr = Truncate-Json $toolOutput

# ── Archive if observations file is too large (>10 MB) ──────────────────────
$observationsFile = "$projectDir\observations.jsonl"
if (Test-Path $observationsFile) {
    if ((Get-Item $observationsFile).Length / 1MB -ge 10) {
        $archiveDir  = "$projectDir\observations.archive"
        New-Item -ItemType Directory -Force -Path $archiveDir -ErrorAction SilentlyContinue | Out-Null
        $archiveName = "observations-$(Get-Date -Format 'yyyyMMdd-HHmmss').jsonl"
        Move-Item $observationsFile "$archiveDir\$archiveName" -Force -ErrorAction SilentlyContinue
    }
}

# ── Build and write observation ──────────────────────────────────────────────
$timestamp   = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$observation = [ordered]@{
    timestamp    = $timestamp
    event        = $event
    tool         = $toolName
    session      = $sessionId
    project_id   = $projectId
    project_name = $projectName
}
if ($event -eq "tool_start" -and $toolInputStr) {
    $observation.input = $toolInputStr
}
if ($event -eq "tool_complete") {
    $observation.output = $toolOutputStr
}

$observationJson = $observation | ConvertTo-Json -Compress -Depth 10

# Append without BOM — PS 5.1's Add-Content -Encoding UTF8 writes a BOM on new files
# which breaks JSON parsing of the first line. AppendAllText with UTF8 (no-BOM) is safe.
[System.IO.File]::AppendAllText(
    $observationsFile,
    "$observationJson`n",
    [System.Text.Encoding]::UTF8
)

# Note: Unix observer signaling (kill -USR1) has no direct Windows equivalent.
# Any observer process would need to poll observations.jsonl for new entries.

exit 0

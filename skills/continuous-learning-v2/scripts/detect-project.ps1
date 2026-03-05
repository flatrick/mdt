#Requires -Version 5.1
# Continuous Learning v2 - Project Detection Helper (Windows PowerShell)
#
# Windows-compatible version of detect-project.sh.
#
# Exports (when dot-sourced):
#   _CLV2_PROJECT_ID, _CLV2_PROJECT_NAME, _CLV2_PROJECT_ROOT, _CLV2_PROJECT_DIR
#   PROJECT_ID, PROJECT_NAME, PROJECT_ROOT, PROJECT_DIR

[CmdletBinding()]
param(
    [switch]$AsJson
)

$ErrorActionPreference = 'Stop'

$script:_CLV2_HOMUNCULUS_DIR = Join-Path $HOME '.claude\homunculus'
$script:_CLV2_PROJECTS_DIR = Join-Path $script:_CLV2_HOMUNCULUS_DIR 'projects'
$script:_CLV2_REGISTRY_FILE = Join-Path $script:_CLV2_HOMUNCULUS_DIR 'projects.json'

function Get-Clv2ShortHash {
    param(
        [Parameter(Mandatory = $true)]
        [string]$InputText
    )

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($InputText)
        $hash = $sha256.ComputeHash($bytes)
        return ([System.BitConverter]::ToString($hash) -replace '-', '').ToLower().Substring(0, 12)
    } finally {
        $sha256.Dispose()
    }
}

function Initialize-Clv2ProjectDirectories {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectDir
    )

    foreach ($dir in @(
            (Join-Path $ProjectDir 'instincts\personal'),
            (Join-Path $ProjectDir 'instincts\inherited'),
            (Join-Path $ProjectDir 'observations.archive'),
            (Join-Path $ProjectDir 'evolved\skills'),
            (Join-Path $ProjectDir 'evolved\commands'),
            (Join-Path $ProjectDir 'evolved\agents')
        )) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

function Update-Clv2ProjectRegistry {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectId,
        [Parameter(Mandatory = $true)]
        [string]$ProjectName,
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,
        [string]$RemoteUrl = ''
    )

    try {
        New-Item -ItemType Directory -Force -Path (Split-Path $script:_CLV2_REGISTRY_FILE -Parent) | Out-Null

        $registry = @{}
        if (Test-Path -LiteralPath $script:_CLV2_REGISTRY_FILE -PathType Leaf) {
            try {
                $existing = Get-Content -LiteralPath $script:_CLV2_REGISTRY_FILE -Raw | ConvertFrom-Json
                foreach ($prop in $existing.PSObject.Properties) {
                    $registry[$prop.Name] = $prop.Value
                }
            } catch {
                $registry = @{}
            }
        }

        $registry[$ProjectId] = [ordered]@{
            name      = $ProjectName
            root      = $ProjectRoot
            remote    = $RemoteUrl
            last_seen = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        }

        $registry | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $script:_CLV2_REGISTRY_FILE -Encoding UTF8
    } catch {
        # Registry update failures should not block project detection.
    }
}

function Invoke-Clv2ProjectDetection {
    $projectRoot = ''
    $projectName = ''
    $projectId = ''
    $remoteUrl = ''
    $projectDir = ''

    if (-not [string]::IsNullOrWhiteSpace([string]$env:CLAUDE_PROJECT_DIR) -and (Test-Path -LiteralPath $env:CLAUDE_PROJECT_DIR -PathType Container)) {
        $projectRoot = [string]$env:CLAUDE_PROJECT_DIR
    }

    if ([string]::IsNullOrWhiteSpace($projectRoot) -and (Get-Command git -ErrorAction SilentlyContinue)) {
        $gitRoot = (& git rev-parse --show-toplevel 2>$null)
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace([string]$gitRoot)) {
            $projectRoot = [string]$gitRoot.Trim()
        }
    }

    if ([string]::IsNullOrWhiteSpace($projectRoot)) {
        $script:_CLV2_PROJECT_ID = 'global'
        $script:_CLV2_PROJECT_NAME = 'global'
        $script:_CLV2_PROJECT_ROOT = ''
        $script:_CLV2_PROJECT_DIR = $script:_CLV2_HOMUNCULUS_DIR
    } else {
        $projectName = Split-Path -Leaf $projectRoot

        if (Get-Command git -ErrorAction SilentlyContinue) {
            $remote = (& git -C $projectRoot remote get-url origin 2>$null)
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace([string]$remote)) {
                $remoteUrl = [string]$remote.Trim()
            }
        }

        $hashInput = if (-not [string]::IsNullOrWhiteSpace($remoteUrl)) { $remoteUrl } else { $projectRoot }
        $projectId = Get-Clv2ShortHash -InputText $hashInput
        $projectDir = Join-Path $script:_CLV2_PROJECTS_DIR $projectId

        Initialize-Clv2ProjectDirectories -ProjectDir $projectDir
        Update-Clv2ProjectRegistry -ProjectId $projectId -ProjectName $projectName -ProjectRoot $projectRoot -RemoteUrl $remoteUrl

        $script:_CLV2_PROJECT_ID = $projectId
        $script:_CLV2_PROJECT_NAME = $projectName
        $script:_CLV2_PROJECT_ROOT = $projectRoot
        $script:_CLV2_PROJECT_DIR = $projectDir
    }

    $script:PROJECT_ID = $script:_CLV2_PROJECT_ID
    $script:PROJECT_NAME = $script:_CLV2_PROJECT_NAME
    $script:PROJECT_ROOT = $script:_CLV2_PROJECT_ROOT
    $script:PROJECT_DIR = $script:_CLV2_PROJECT_DIR

    return [ordered]@{
        id          = $script:_CLV2_PROJECT_ID
        name        = $script:_CLV2_PROJECT_NAME
        root        = $script:_CLV2_PROJECT_ROOT
        remote      = $remoteUrl
        project_dir = $script:_CLV2_PROJECT_DIR
    }
}

$context = Invoke-Clv2ProjectDetection

if ($AsJson) {
    $context | ConvertTo-Json -Compress
}

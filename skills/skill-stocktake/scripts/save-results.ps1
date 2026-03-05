#Requires -Version 5.1
# save-results.ps1 — merge evaluated skills into results.json with correct UTC timestamp
# Usage: save-results.ps1 RESULTS_JSON <<< "$EVAL_JSON"

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ResultsJson
)

$ErrorActionPreference = 'Stop'

function ConvertTo-HashtableRecursive {
    param(
        $Value
    )

    if ($null -eq $Value) {
        return $null
    }

    if ($Value -is [System.Collections.IDictionary]) {
        $ht = @{}
        foreach ($k in $Value.Keys) {
            $ht[$k] = ConvertTo-HashtableRecursive -Value $Value[$k]
        }
        return $ht
    }

    if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
        $items = @()
        foreach ($item in $Value) {
            $items += ConvertTo-HashtableRecursive -Value $item
        }
        return $items
    }

    if ($Value.PSObject -and $Value.PSObject.Properties.Count -gt 0) {
        $ht = @{}
        foreach ($prop in $Value.PSObject.Properties) {
            $ht[$prop.Name] = ConvertTo-HashtableRecursive -Value $prop.Value
        }
        return $ht
    }

    return $Value
}

if ([string]::IsNullOrWhiteSpace($ResultsJson)) {
    [Console]::Error.WriteLine('Error: RESULTS_JSON argument required')
    [Console]::Error.WriteLine('Usage: save-results.ps1 RESULTS_JSON <<< "$EVAL_JSON"')
    exit 1
}

$evaluatedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$inputJson = [Console]::In.ReadToEnd()

if ([string]::IsNullOrWhiteSpace($inputJson)) {
    [Console]::Error.WriteLine('Error: stdin is not valid JSON')
    exit 1
}

try {
    $newData = $inputJson | ConvertFrom-Json
} catch {
    [Console]::Error.WriteLine('Error: stdin is not valid JSON')
    exit 1
}

$newHash = ConvertTo-HashtableRecursive -Value $newData

if (-not (Test-Path -LiteralPath $ResultsJson -PathType Leaf)) {
    $bootstrap = @{}
    foreach ($key in $newHash.Keys) {
        $bootstrap[$key] = $newHash[$key]
    }
    $bootstrap['evaluated_at'] = $evaluatedAt
    $bootstrap | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $ResultsJson -Encoding UTF8
    exit 0
}

$existing = Get-Content -LiteralPath $ResultsJson -Raw | ConvertFrom-Json
$existingHash = ConvertTo-HashtableRecursive -Value $existing

$merged = @{}
foreach ($key in $existingHash.Keys) {
    $merged[$key] = $existingHash[$key]
}
$merged['evaluated_at'] = $evaluatedAt

$existingSkills = if ($existingHash.ContainsKey('skills') -and $existingHash['skills'] -is [System.Collections.IDictionary]) {
    $existingHash['skills']
} else {
    @{}
}
$newSkills = if ($newHash.ContainsKey('skills') -and $newHash['skills'] -is [System.Collections.IDictionary]) {
    $newHash['skills']
} else {
    @{}
}

$mergedSkills = @{}
foreach ($k in $existingSkills.Keys) {
    $mergedSkills[$k] = $existingSkills[$k]
}
foreach ($k in $newSkills.Keys) {
    $mergedSkills[$k] = $newSkills[$k]
}
$merged['skills'] = $mergedSkills

if ($newHash.ContainsKey('mode')) {
    $merged['mode'] = $newHash['mode']
}
if ($newHash.ContainsKey('batch_progress')) {
    $merged['batch_progress'] = $newHash['batch_progress']
}

$tmpPath = '{0}.{1}.tmp' -f $ResultsJson, ([Guid]::NewGuid().ToString('N'))
try {
    $merged | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $tmpPath -Encoding UTF8
    Move-Item -LiteralPath $tmpPath -Destination $ResultsJson -Force
} finally {
    if (Test-Path -LiteralPath $tmpPath -PathType Leaf) {
        Remove-Item -LiteralPath $tmpPath -Force -ErrorAction SilentlyContinue
    }
}

exit 0

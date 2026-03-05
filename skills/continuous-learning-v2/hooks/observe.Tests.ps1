#Requires -Version 5.1
# Pester test suite for observe.ps1
#
# Run with coverage:
#   pwsh -File observe.Tests.ps1
# or from a pwsh session:
#   Import-Module Pester -MinimumVersion 5.0
#   $cfg = New-PesterConfiguration
#   $cfg.Run.Path = '.\observe.Tests.ps1'
#   $cfg.CodeCoverage.Enabled = $true
#   $cfg.CodeCoverage.Path    = '.\observe.ps1'
#   $cfg.Output.Verbosity     = 'Detailed'
#   Invoke-Pester -Configuration $cfg

BeforeAll {
    $script:ScriptPath = "$PSScriptRoot\observe.ps1"
    $script:TempRoot   = Join-Path $env:TEMP "observe-pester-$(New-Guid)"
    New-Item -ItemType Directory -Force -Path $script:TempRoot | Out-Null

    # Override USERPROFILE so the script writes under our temp sandbox, not ~/.claude
    $script:OriginalUserProfile  = $env:USERPROFILE
    $script:OriginalProjectDir   = $env:CLAUDE_PROJECT_DIR
    $env:USERPROFILE             = $script:TempRoot
    $env:CLAUDE_PROJECT_DIR      = $null   # remove so tests start clean

    # Global observations file (written when no git project is detected)
    $script:GlobalObsFile = "$script:TempRoot\.claude\homunculus\observations.jsonl"

    # Minimal valid hook payload WITHOUT 'cwd', so the child process falls back
    # to global scope (its CWD is not a git repo → no project dir → global path).
    $script:MinimalPayload = [ordered]@{
        tool_name   = "Read"
        tool_input  = @{ file_path = "C:/foo/bar.txt" }
        tool_output = "file contents here"
        session_id  = "sess-abc123"
        tool_use_id = "use-001"
    } | ConvertTo-Json -Compress

    # ── Invoke observe.ps1 via proper stdin redirection ───────────────────────
    # Uses System.Diagnostics.Process so stdin is a real OS pipe, not a PS
    # pipeline.  The child powershell.exe inherits the current process's
    # environment (including the overridden USERPROFILE).
    function Invoke-ObserveScript {
        param([string]$Json, [string]$Phase = "post")

        $psi                      = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName             = "powershell.exe"
        $psi.Arguments            = "-NonInteractive -NoProfile -ExecutionPolicy Bypass -File `"$($script:ScriptPath)`" $Phase"
        $psi.UseShellExecute      = $false
        $psi.RedirectStandardInput  = $true
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError  = $true
        $psi.StandardInputEncoding  = [System.Text.Encoding]::UTF8

        $proc          = New-Object System.Diagnostics.Process
        $proc.StartInfo = $psi
        $proc.Start()  | Out-Null

        $proc.StandardInput.Write($Json)
        $proc.StandardInput.Close()

        $stdout = $proc.StandardOutput.ReadToEnd()
        $proc.WaitForExit()

        return @{ ExitCode = $proc.ExitCode; Output = $stdout }
    }

    # Clear the homunculus sandbox between tests that need a clean slate
    function Reset-Homunculus {
        $hDir = "$script:TempRoot\.claude\homunculus"
        Remove-Item $hDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

AfterAll {
    $env:USERPROFILE        = $script:OriginalUserProfile
    $env:CLAUDE_PROJECT_DIR = $script:OriginalProjectDir
    Remove-Item $script:TempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

# ── 1. SHA256 hash compatibility with Python ──────────────────────────────────
# Reference values computed by: hashlib.sha256(v.encode('utf-8')).hexdigest()[:12]
# NOTE: $HashInput — NOT $Input, which is a reserved PowerShell automatic variable.
Describe "SHA256 hash compatibility with Python" {

    $hashCases = @(
        @{ HashInput = "https://github.com/example/my-repo.git";       Expected = "27ec0d81328a" }
        @{ HashInput = "C:/Users/patri/projects/my-app";                Expected = "962fb3ede8a8" }
        @{ HashInput = "";                                               Expected = "e3b0c44298fc" }
        @{ HashInput = "global";                                         Expected = "8001c2743965" }
        @{ HashInput = "https://github.com/anthropics/claude-code.git"; Expected = "c5067023edc5" }
    )

    It "matches Python hashlib.sha256 for: <HashInput>" -TestCases $hashCases {
        param($HashInput, $Expected)
        $sha256    = [System.Security.Cryptography.SHA256]::Create()
        $hashBytes = $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($HashInput))
        $actual    = ([System.BitConverter]::ToString($hashBytes) -replace '-', '').ToLower().Substring(0, 12)
        $actual | Should -Be $Expected
    }
}

# ── 2. File output: UTF-8 no BOM, valid JSONL, appends ───────────────────────
Describe "File output format" {
    BeforeEach { Reset-Homunculus }

    It "writes a valid JSON line" {
        Invoke-ObserveScript -Json $script:MinimalPayload
        Test-Path $script:GlobalObsFile | Should -Be $true
        $lines = Get-Content $script:GlobalObsFile | Where-Object { $_.Trim() -ne '' }
        $lines | Should -Not -BeNullOrEmpty
        { $lines[0] | ConvertFrom-Json } | Should -Not -Throw
    }

    It "writes UTF-8 without BOM" {
        Invoke-ObserveScript -Json $script:MinimalPayload
        $bytes  = [System.IO.File]::ReadAllBytes($script:GlobalObsFile)
        $hasBom = ($bytes.Length -ge 3 -and
                   $bytes[0] -eq 0xEF -and
                   $bytes[1] -eq 0xBB -and
                   $bytes[2] -eq 0xBF)
        $hasBom | Should -Be $false
    }

    It "appends on subsequent calls without overwriting" {
        Invoke-ObserveScript -Json $script:MinimalPayload
        Invoke-ObserveScript -Json $script:MinimalPayload
        $lines = Get-Content $script:GlobalObsFile | Where-Object { $_.Trim() -ne '' }
        $lines.Count | Should -BeGreaterOrEqual 2
    }
}

# ── 3. Observation record fields ──────────────────────────────────────────────
Describe "Observation record fields" {
    BeforeAll {
        Reset-Homunculus
        Invoke-ObserveScript -Json $script:MinimalPayload -Phase "post"
        $script:Obs = Get-Content $script:GlobalObsFile | Select-Object -First 1 | ConvertFrom-Json
    }

    It "has 'timestamp' in ISO 8601 UTC format" {
        $script:Obs.timestamp | Should -Match '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$'
    }
    It "has 'event' field" {
        $script:Obs.event | Should -Not -BeNullOrEmpty
    }
    It "has 'tool' matching the payload" {
        $script:Obs.tool | Should -Be "Read"
    }
    It "has 'session' matching the payload" {
        $script:Obs.session | Should -Be "sess-abc123"
    }
    It "has 'project_id'" {
        $script:Obs.project_id | Should -Not -BeNullOrEmpty
    }
    It "has 'project_name'" {
        $script:Obs.project_name | Should -Not -BeNullOrEmpty
    }
    It "post phase sets event = tool_complete" {
        $script:Obs.event | Should -Be "tool_complete"
    }
    It "pre phase sets event = tool_start" {
        Reset-Homunculus
        Invoke-ObserveScript -Json $script:MinimalPayload -Phase "pre"
        $obs = Get-Content $script:GlobalObsFile | Select-Object -First 1 | ConvertFrom-Json
        $obs.event | Should -Be "tool_start"
    }
}

# ── 4. Input / output field inclusion rules ───────────────────────────────────
Describe "Input/output field inclusion" {
    It "pre phase includes 'input', omits 'output'" {
        Reset-Homunculus
        Invoke-ObserveScript -Json $script:MinimalPayload -Phase "pre"
        $obs   = Get-Content $script:GlobalObsFile | Select-Object -First 1 | ConvertFrom-Json
        $names = $obs.PSObject.Properties.Name
        $names | Should -Contain    "input"
        $names | Should -Not -Contain "output"
    }

    It "post phase includes 'output'" {
        Reset-Homunculus
        Invoke-ObserveScript -Json $script:MinimalPayload -Phase "post"
        $obs   = Get-Content $script:GlobalObsFile | Select-Object -First 1 | ConvertFrom-Json
        $obs.PSObject.Properties.Name | Should -Contain "output"
    }
}

# ── 5. Truncation at 5000 chars ───────────────────────────────────────────────
Describe "Payload truncation" {
    It "truncates tool_output longer than 5000 chars" {
        $payload = [ordered]@{
            tool_name   = "Bash"
            tool_input  = @{ command = "echo hi" }
            tool_output = ("x" * 6000)
            session_id  = "sess-trunc"
        } | ConvertTo-Json -Compress
        Reset-Homunculus
        Invoke-ObserveScript -Json $payload -Phase "post"
        $obs = Get-Content $script:GlobalObsFile | Select-Object -First 1 | ConvertFrom-Json
        $obs.output.Length | Should -BeLessOrEqual 5000
    }

    It "does not truncate tool_output shorter than 5000 chars" {
        $payload = [ordered]@{
            tool_name   = "Bash"
            tool_input  = @{ command = "echo hi" }
            tool_output = ("y" * 100)
            session_id  = "sess-short"
        } | ConvertTo-Json -Compress
        Reset-Homunculus
        Invoke-ObserveScript -Json $payload -Phase "post"
        $obs = Get-Content $script:GlobalObsFile | Select-Object -First 1 | ConvertFrom-Json
        $obs.output | Should -Not -BeNullOrEmpty
    }
}

# ── 6. Disabled flag ──────────────────────────────────────────────────────────
Describe "Disabled flag" {
    It "writes nothing when homunculus/disabled file exists" {
        Reset-Homunculus
        $hDir = "$script:TempRoot\.claude\homunculus"
        New-Item -ItemType Directory -Force -Path $hDir    | Out-Null
        New-Item -ItemType File      -Force -Path "$hDir\disabled" | Out-Null
        Invoke-ObserveScript -Json $script:MinimalPayload
        Test-Path $script:GlobalObsFile | Should -Be $false
    }
}

# ── 7. Parse-error fallback ───────────────────────────────────────────────────
Describe "Parse-error fallback" {
    It "logs a parse_error entry for invalid JSON" {
        Reset-Homunculus
        Invoke-ObserveScript -Json "this is not json at all"
        Test-Path $script:GlobalObsFile | Should -Be $true
        $obs = Get-Content $script:GlobalObsFile | Select-Object -First 1 | ConvertFrom-Json
        $obs.event | Should -Be "parse_error"
    }

    It "exits 0 for invalid JSON (does not crash)" {
        Reset-Homunculus
        $result = Invoke-ObserveScript -Json "{broken json..."
        $result.ExitCode | Should -Be 0
    }
}

# ── 8. Empty stdin ────────────────────────────────────────────────────────────
Describe "Empty stdin" {
    It "exits 0 and writes nothing" {
        Reset-Homunculus
        $result = Invoke-ObserveScript -Json ""
        $result.ExitCode | Should -Be 0
        Test-Path $script:GlobalObsFile | Should -Be $false
    }
}

# ── 9. File archiving when > 10 MB ────────────────────────────────────────────
Describe "File archiving over 10 MB" {
    It "moves the old file to archive and starts fresh" {
        Reset-Homunculus
        $hDir = "$script:TempRoot\.claude\homunculus"
        New-Item -ItemType Directory -Force -Path $hDir | Out-Null

        # Pad the file to just over 10 MB
        $stream = [System.IO.StreamWriter]::new($script:GlobalObsFile, $false, [System.Text.Encoding]::UTF8)
        $line   = "x" * 1024  # 1 KB per line
        1..10500 | ForEach-Object { $stream.WriteLine($line) }
        $stream.Close()

        (Get-Item $script:GlobalObsFile).Length / 1MB | Should -BeGreaterThan 10

        Invoke-ObserveScript -Json $script:MinimalPayload

        $archiveDir = "$hDir\observations.archive"
        Test-Path $archiveDir | Should -Be $true
        (Get-ChildItem $archiveDir -Filter "*.jsonl").Count | Should -BeGreaterOrEqual 1

        # New file should have only the fresh entry, not the old padded content
        $newLines = Get-Content $script:GlobalObsFile | Where-Object { $_.Trim() -ne '' }
        $newLines.Count | Should -BeLessThan 10500
    }
}

# ── 10. Project registry (projects.json) ─────────────────────────────────────
Describe "Project registry" {
    It "creates projects.json when a git repo is detected via cwd" {
        Reset-Homunculus

        # Create a real (empty) git repo inside the sandbox
        $repoDir = "$script:TempRoot\fake-repo"
        New-Item -ItemType Directory -Force -Path $repoDir | Out-Null
        & git -C $repoDir init --quiet 2>$null

        $payload = [ordered]@{
            tool_name   = "Read"
            tool_input  = @{ file_path = "x" }
            tool_output = "y"
            session_id  = "sess-reg"
            cwd         = $repoDir          # triggers project-scoped detection
        } | ConvertTo-Json -Compress

        Invoke-ObserveScript -Json $payload

        $registryFile = "$script:TempRoot\.claude\homunculus\projects.json"
        Test-Path $registryFile | Should -Be $true
        $reg = Get-Content $registryFile | ConvertFrom-Json
        $reg.PSObject.Properties.Count | Should -BeGreaterThan 0
    }
}

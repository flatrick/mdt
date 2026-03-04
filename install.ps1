#!/usr/bin/env pwsh
# install.ps1 — Install claude rules, agents, commands, and other configs.
#
# Usage:
#   .\install.ps1 [-Target <claude|cursor|codex>] [-Global] [<language> ...]
#
# Examples:
#   .\install.ps1 typescript
#   .\install.ps1 typescript python golang
#   .\install.ps1 -Target cursor typescript
#   .\install.ps1 -Target cursor -Global typescript
#   .\install.ps1 -Target codex
#
# Targets:
#   claude  (default) — Install rules, agents, commands, and hooks to ~/.claude/
#   cursor            — Install rules, agents, skills, commands, hooks, and MCP to ./.cursor/
#                       Use -Global to install to ~/.cursor/ instead
#   codex             — Install Codex CLI config to ~/.codex/

[CmdletBinding(PositionalBinding = $false)]
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('claude', 'cursor', 'codex')]
    [string]$Target = 'claude',

    [Parameter(Mandatory = $false)]
    [switch]$Global,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Languages
)

$ErrorActionPreference = 'Stop'

# Resolve Script Directory
$SCRIPT_DIR = $PSScriptRoot
if (-not $SCRIPT_DIR) {
    $SCRIPT_DIR = (Get-Item .).FullName
}
$RULES_DIR = Join-Path $SCRIPT_DIR "rules"

# Detect if running on Windows
$IsWindowsPlatform = $IsWindows -or ($env:OS -eq 'Windows_NT')

# --- Usage (only required for claude/cursor) ---
if ($Target -ne 'codex' -and (-not $Languages -or $Languages.Count -eq 0)) {
    Write-Host "Usage: .\install.ps1 [-Target <claude|cursor|codex>] [-Global] [<language> ...]"
    Write-Host ""
    Write-Host "Targets:"
    Write-Host "  claude  (default) — Install rules, agents, commands, and hooks to ~/.claude/"
    Write-Host "  cursor            — Install rules, agents, skills, and hooks to ./.cursor/"
    Write-Host "  codex             — Install Codex CLI config to ~/.codex/ (no language needed)"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Global           — For 'cursor' target, install to ~/.cursor/ instead of current directory."
    Write-Host ""
    Write-Host "Available languages:"
    if (Test-Path $RULES_DIR) {
        Get-ChildItem -Path $RULES_DIR -Directory | ForEach-Object {
            if ($_.Name -ne 'common') {
                Write-Host "  - $($_.Name)"
            }
        }
    }
    exit 1
}

# --- Initial Validation ---
if ($Global -and $Target -ne 'cursor') {
    Write-Host "Warning: The -Global flag is currently only supported for the 'cursor' target. It will be ignored for '$Target'." -ForegroundColor Yellow
}

# ============================================================
# --- Claude target ---
# ============================================================
if ($Target -eq 'claude') {
    $CLAUDE_BASE_DIR = Join-Path $HOME ".claude"
    $RULES_DEST_DIR = if ($env:CLAUDE_RULES_DIR) { $env:CLAUDE_RULES_DIR } else { Join-Path $CLAUDE_BASE_DIR "rules" }

    # Resolve paths for self-copy guards
    $CLAUDE_BASE_DIR_FULL = (Resolve-Path $CLAUDE_BASE_DIR -ErrorAction SilentlyContinue).Path
    $RULES_DEST_DIR_FULL = (Resolve-Path $RULES_DEST_DIR -ErrorAction SilentlyContinue).Path

    # Warn if rules destination already exists
    if (Test-Path $RULES_DEST_DIR) {
        if (Get-ChildItem -Path $RULES_DEST_DIR -ErrorAction SilentlyContinue) {
            Write-Host "Note: $RULES_DEST_DIR/ already exists. Existing files will be overwritten."
            Write-Host "      Back up any local customizations before proceeding."
        }
    }

    # --- Rules: common ---
    $commonDest = Join-Path $RULES_DEST_DIR "common"
    Write-Host "Installing common rules -> $commonDest/"
    if ($SCRIPT_DIR -ne $RULES_DEST_DIR_FULL) {
        $null = New-Item -ItemType Directory -Path $commonDest -Force
        Copy-Item -Path (Join-Path $RULES_DIR "common/*") -Destination $commonDest -Recurse -Force
    }

    # --- Rules: language-specific ---
    foreach ($lang in $Languages) {
        if ($lang -notmatch '^[a-zA-Z0-9_-]+$') {
            Write-Host "Error: invalid language name '$lang'. Only alphanumeric, dash, and underscore allowed." -ForegroundColor Red
            continue
        }
        $langDir = Join-Path $RULES_DIR $lang
        if (-not (Test-Path $langDir)) {
            Write-Host "Warning: rules/$lang/ does not exist, skipping." -ForegroundColor Yellow
            continue
        }

        $langDest = Join-Path $RULES_DEST_DIR $lang
        Write-Host "Installing $lang rules -> $langDest/"
        if ($SCRIPT_DIR -ne $RULES_DEST_DIR_FULL) {
            $null = New-Item -ItemType Directory -Path $langDest -Force
            Copy-Item -Path (Join-Path $langDir "*") -Destination $langDest -Recurse -Force
        }
    }

    # --- Agents ---
    $agentsSrc = Join-Path $SCRIPT_DIR "agents"
    if (Test-Path $agentsSrc) {
        $agentsDest = Join-Path $CLAUDE_BASE_DIR "agents"
        Write-Host "Installing agents -> $agentsDest/"
        if ($agentsSrc -ne (Resolve-Path $agentsDest -ErrorAction SilentlyContinue).Path) {
            $null = New-Item -ItemType Directory -Path $agentsDest -Force
            Copy-Item -Path (Join-Path $agentsSrc "*.md") -Destination $agentsDest -Force
        }
    }

    # --- Commands ---
    $commandsSrc = Join-Path $SCRIPT_DIR "commands"
    if (Test-Path $commandsSrc) {
        $commandsDest = Join-Path $CLAUDE_BASE_DIR "commands"
        Write-Host "Installing commands -> $commandsDest/"
        if ($commandsSrc -ne (Resolve-Path $commandsDest -ErrorAction SilentlyContinue).Path) {
            $null = New-Item -ItemType Directory -Path $commandsDest -Force
            Copy-Item -Path (Join-Path $commandsSrc "*.md") -Destination $commandsDest -Force
        }
    }

    # --- Skills ---
    $skillsSrc = Join-Path $SCRIPT_DIR "skills"
    if (Test-Path $skillsSrc) {
        $skillsDest = Join-Path $CLAUDE_BASE_DIR "skills"
        Write-Host "Installing skills -> $skillsDest/"
        if ($skillsSrc -ne (Resolve-Path $skillsDest -ErrorAction SilentlyContinue).Path) {
            $null = New-Item -ItemType Directory -Path $skillsDest -Force
            Copy-Item -Path (Join-Path $skillsSrc "*") -Destination $skillsDest -Recurse -Force
        }
    }

    # --- Hooks: merge into settings.json ---
    $hooksJsonSrc = Join-Path $SCRIPT_DIR "hooks/hooks.json"
    if (Test-Path $hooksJsonSrc) {
        $settingsJsonPath = Join-Path $CLAUDE_BASE_DIR "settings.json"
        $hooksSource = Get-Content $hooksJsonSrc -Raw | ConvertFrom-Json

        # Replace ${CLAUDE_PLUGIN_ROOT} with the absolute install path
        $absoluteBase = $CLAUDE_BASE_DIR.Replace('\', '/')
        $hooksJson = ($hooksSource | ConvertTo-Json -Depth 20) -replace [regex]::Escape('${CLAUDE_PLUGIN_ROOT}'), $absoluteBase
        $hooksBlock = ($hooksJson | ConvertFrom-Json).hooks

        if (Test-Path $settingsJsonPath) {
            $backupPath = "$settingsJsonPath.bkp"
            Copy-Item -Path $settingsJsonPath -Destination $backupPath -Force
            Write-Host "Backed up existing settings.json -> $backupPath"
            $settings = Get-Content $settingsJsonPath -Raw | ConvertFrom-Json
        } else {
            $settings = [PSCustomObject]@{}
        }
        $settings | Add-Member -NotePropertyName 'hooks' -NotePropertyValue $hooksBlock -Force

        Write-Host "Installing hooks -> $settingsJsonPath (merged into settings.json)"
        $settings | ConvertTo-Json -Depth 20 | Set-Content $settingsJsonPath -Encoding UTF8
    }

    # --- Scripts (required by hooks) ---
    $scriptsSrc = Join-Path $SCRIPT_DIR "scripts"
    if (Test-Path $scriptsSrc) {
        $scriptsDest = Join-Path $CLAUDE_BASE_DIR "scripts"
        Write-Host "Installing scripts -> $scriptsDest/"
        if ($scriptsSrc -ne (Resolve-Path $scriptsDest -ErrorAction SilentlyContinue).Path) {
            $null = New-Item -ItemType Directory -Path $scriptsDest -Force
            Copy-Item -Path (Join-Path $scriptsSrc "*") -Destination $scriptsDest -Recurse -Force
        }
    }

    # Windows warning: hook scripts use Node.js + Unix-specific tooling
    if ($IsWindowsPlatform) {
        Write-Host ""
        Write-Host "NOTE: Windows Hook Script Warning" -ForegroundColor Yellow
        Write-Host "The hook scripts in scripts/hooks/*.js reference Unix-specific tools"
        Write-Host "(e.g., tmux) that are not available on Windows. The hooks will run"
        Write-Host "via Node.js, but tmux-dependent functionality will be silently skipped"
        Write-Host "(they already guard with: if (process.platform !== 'win32'))."
        Write-Host "Hooks that do NOT use tmux (formatting, TypeScript checks, git review,"
        Write-Host "session persistence, MCP audit) work fine on Windows."
        Write-Host ""
    }

    Write-Host "Done. Claude configs installed to $CLAUDE_BASE_DIR/"
}

# ============================================================
# --- Cursor target ---
# ============================================================
if ($Target -eq 'cursor') {
    $DEST_DIR = if ($Global) { Join-Path $HOME ".cursor" } else { ".cursor" }
    $CURSOR_SRC = Join-Path $SCRIPT_DIR ".cursor"

    Write-Host "Installing Cursor configs to $DEST_DIR/"

    if ($Global) {
        Write-Host ""
        Write-Host "NOTE: Global Cursor Rules Warning" -ForegroundColor Yellow
        Write-Host "Cursor does not currently support file-based rules in the global ~/.cursor/rules folder."
        Write-Host "To have global rules, you must add them in the Cursor UI under:"
        Write-Host "Settings > Cursor Settings > General > Rules for AI"
        Write-Host ""
    }

    # --- Rules ---
    $rulesDest = Join-Path $DEST_DIR "rules"
    if (-not $Global) {
        $null = New-Item -ItemType Directory -Path $rulesDest -Force

        Write-Host "Installing common rules -> $rulesDest/"
        if (Test-Path (Join-Path $CURSOR_SRC "rules")) {
            Get-ChildItem -Path (Join-Path $CURSOR_SRC "rules/common-*.md") -ErrorAction SilentlyContinue | ForEach-Object {
                $destFile = Join-Path $rulesDest $_.Name
                if ($_.FullName -ne (Resolve-Path $destFile -ErrorAction SilentlyContinue).Path) {
                    Copy-Item -Path $_.FullName -Destination $rulesDest -Force
                }
            }
        }

        # Language-specific rules
        foreach ($lang in $Languages) {
            if ($lang -notmatch '^[a-zA-Z0-9_-]+$') {
                Write-Host "Error: invalid language name '$lang'. Only alphanumeric, dash, and underscore allowed." -ForegroundColor Red
                continue
            }
            if (Test-Path (Join-Path $CURSOR_SRC "rules")) {
                $found = $false
                $foundFiles = Get-ChildItem -Path (Join-Path $CURSOR_SRC "rules/${lang}-*.md") -ErrorAction SilentlyContinue
                foreach ($file in $foundFiles) {
                    $destFile = Join-Path $rulesDest $file.Name
                    if ($file.FullName -ne (Resolve-Path $destFile -ErrorAction SilentlyContinue).Path) {
                        Copy-Item -Path $file.FullName -Destination $rulesDest -Force
                    }
                    $found = $true
                }
                if ($found) {
                    Write-Host "Installing $lang rules -> $rulesDest/"
                }
                else {
                    Write-Host "Warning: no Cursor rules for '$lang' found, skipping." -ForegroundColor Yellow
                }
            }
        }
    }
    else {
        Write-Host "Skipping rules installation (not supported globally by Cursor)." -ForegroundColor Gray
    }

    # --- Agents (from top-level agents/) ---
    $agentsSrc = Join-Path $SCRIPT_DIR "agents"
    if (Test-Path $agentsSrc) {
        $agentsDest = Join-Path $DEST_DIR "agents"
        Write-Host "Installing agents -> $agentsDest/"
        if ($agentsSrc -ne (Resolve-Path $agentsDest -ErrorAction SilentlyContinue).Path) {
            $null = New-Item -ItemType Directory -Path $agentsDest -Force
            Copy-Item -Path (Join-Path $agentsSrc "*.md") -Destination $agentsDest -Force
        }
    }

    # --- Skills ---
    $skillsSrc = Join-Path $CURSOR_SRC "skills"
    if (Test-Path $skillsSrc) {
        $skillsDest = Join-Path $DEST_DIR "skills"
        Write-Host "Installing skills -> $skillsDest/"
        if ($skillsSrc -ne (Resolve-Path $skillsDest -ErrorAction SilentlyContinue).Path) {
            $null = New-Item -ItemType Directory -Path $skillsDest -Force
            Copy-Item -Path (Join-Path $skillsSrc "*") -Destination $skillsDest -Recurse -Force
        }
    }

    # --- Commands ---
    $commandsSrc = Join-Path $CURSOR_SRC "commands"
    if (Test-Path $commandsSrc) {
        $commandsDest = Join-Path $DEST_DIR "commands"
        Write-Host "Installing commands -> $commandsDest/"
        if ($commandsSrc -ne (Resolve-Path $commandsDest -ErrorAction SilentlyContinue).Path) {
            $null = New-Item -ItemType Directory -Path $commandsDest -Force
            Copy-Item -Path (Join-Path $commandsSrc "*") -Destination $commandsDest -Recurse -Force
        }
    }

    # --- Hooks ---
    $hooksJson = Join-Path $CURSOR_SRC "hooks.json"
    if (Test-Path $hooksJson) {
        $hooksJsonDest = Join-Path $DEST_DIR "hooks.json"
        if ($hooksJson -ne (Resolve-Path $hooksJsonDest -ErrorAction SilentlyContinue).Path) {
            Write-Host "Installing hooks config -> $hooksJsonDest"
            if ($Global) {
                $hooksContent = Get-Content $hooksJson -Raw
                $absoluteHooksDir = (Join-Path $DEST_DIR "hooks").Replace('\', '/')
                $hooksContent = $hooksContent -replace 'node \.cursor/hooks/', "node $absoluteHooksDir/"
                $hooksContent | Set-Content $hooksJsonDest -Encoding UTF8
            } else {
                Copy-Item -Path $hooksJson -Destination $DEST_DIR -Force
            }
        }
    }

    $hooksSrc = Join-Path $CURSOR_SRC "hooks"
    if (Test-Path $hooksSrc) {
        $hooksDest = Join-Path $DEST_DIR "hooks"
        Write-Host "Installing hook scripts -> $hooksDest/"
        if ($hooksSrc -ne (Resolve-Path $hooksDest -ErrorAction SilentlyContinue).Path) {
            $null = New-Item -ItemType Directory -Path $hooksDest -Force
            Copy-Item -Path (Join-Path $hooksSrc "*") -Destination $hooksDest -Recurse -Force
        }
    }

    # --- MCP Config ---
    $mcpJson = Join-Path $CURSOR_SRC "mcp.json"
    if (Test-Path $mcpJson) {
        $mcpJsonDest = Join-Path $DEST_DIR "mcp.json"
        if ($mcpJson -ne (Resolve-Path $mcpJsonDest -ErrorAction SilentlyContinue).Path) {
            Write-Host "Installing MCP config -> $mcpJsonDest"
            Copy-Item -Path $mcpJson -Destination $DEST_DIR -Force
        }
    }

    # Windows hooks warning
    if ($IsWindowsPlatform) {
        Write-Host ""
        Write-Host "NOTE: Windows Hook Script Warning" -ForegroundColor Yellow
        Write-Host "The Cursor hook scripts reference Unix-specific tools (e.g., tmux)."
        Write-Host "Hooks guard against this with platform checks, so they will run safely"
        Write-Host "on Windows — but tmux-dependent features will be skipped."
        Write-Host ""
    }

    Write-Host "Done. Cursor configs installed to $DEST_DIR/"
}

# ============================================================
# --- Codex target ---
# ============================================================
if ($Target -eq 'codex') {
    $DEST_DIR = Join-Path $HOME ".codex"
    $CODEX_SRC = Join-Path $SCRIPT_DIR ".codex"

    if (-not (Test-Path $CODEX_SRC)) {
        Write-Host "Error: .codex/ source directory not found at $CODEX_SRC" -ForegroundColor Red
        exit 1
    }

    Write-Host "Installing Codex CLI configs to $DEST_DIR/"
    $null = New-Item -ItemType Directory -Path $DEST_DIR -Force

    # --- config.toml ---
    $configSrc = Join-Path $CODEX_SRC "config.toml"
    if (Test-Path $configSrc) {
        $configDest = Join-Path $DEST_DIR "config.toml"
        if (Test-Path $configDest) {
            Write-Host "Note: $configDest already exists. It will be overwritten." -ForegroundColor Yellow
            Write-Host "      Back up any local customizations before proceeding."
        }
        Write-Host "Installing Codex config -> $configDest"
        Copy-Item -Path $configSrc -Destination $configDest -Force
    }

    # --- AGENTS.md ---
    $agentsMdSrc = Join-Path $CODEX_SRC "AGENTS.md"
    if (Test-Path $agentsMdSrc) {
        $agentsMdDest = Join-Path $DEST_DIR "AGENTS.md"
        Write-Host "Installing Codex AGENTS.md -> $agentsMdDest"
        Copy-Item -Path $agentsMdSrc -Destination $agentsMdDest -Force
    }

    # Windows-specific note for config.toml
    if ($IsWindowsPlatform) {
        Write-Host ""
        Write-Host "NOTE: Windows Codex Config" -ForegroundColor Yellow
        Write-Host "The installed config.toml contains a notify command using 'terminal-notifier'"
        Write-Host "which is a macOS-only tool. On Windows you can remove or replace the"
        Write-Host "[notify] section in $DEST_DIR\config.toml."
        Write-Host ""
    }

    Write-Host "Done. Codex configs installed to $DEST_DIR/"
}

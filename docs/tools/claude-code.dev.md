# Claude Code — MDT Developer Setup

This document covers how to configure Claude Code specifically for working on
the MDT codebase itself. It is separate from `claude-code.md`, which documents
MDT's Claude Code integration for end-users.

---

## Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| `claude` CLI | Claude Code | `npm install -g @anthropic-ai/claude-code` |
| `uvx` | Runs Serena without a global install | `pip install uv` or `brew install uv` |
| `rg` (ripgrep) | Fast content search | `winget install BurntSushi.ripgrep`, `brew install ripgrep`, or `apt install ripgrep` |
| `fd` | Fast file-name search | `winget install sharkdp.fd`, `brew install fd`, or `apt install fd-find` |

Verify:

```bash
claude --version
uvx --version
rg --version
fd --version
```

---

## Serena MCP — Shared Instance Setup

By default, the Serena plugin spawns a new process per Claude Code session.
Running a single shared instance instead saves startup time, shares the LSP
cache across sessions, and lets multiple concurrent sessions (e.g. across
projects) share one server.

### Step 1 — Start the shared server

Both scripts start Serena on `127.0.0.1:8000` using the SSE transport and
log to `~/.claude/logs/`. Copy the script for your platform to a convenient
location (e.g. `~/.claude/scripts/`) and run it.

**Windows (PowerShell) — `start-serena.ps1`:**

```powershell
$port = 8000
$host_ = "127.0.0.1"
$logFile = "$env:USERPROFILE\.claude\logs\serena.log"

$logDir = Split-Path $logFile
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

$existing = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Serena already running on port $port — stopping existing instance..."
    $existing | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}

Write-Host "Starting Serena MCP server on $host_`:$port (SSE transport)..."

$proc = Start-Process -FilePath "uvx" `
    -ArgumentList @(
        "--from", "git+https://github.com/oraios/serena",
        "serena", "start-mcp-server",
        "--transport", "sse",
        "--host", $host_,
        "--port", $port,
        "--context", "desktop-app",
        "--open-web-dashboard", "False"
    ) `
    -NoNewWindow `
    -RedirectStandardOutput $logFile `
    -RedirectStandardError "$logDir\serena-err.log" `
    -PassThru

Write-Host "Serena started (PID $($proc.Id)). SSE endpoint: http://$host_`:$port/sse"
Write-Host "Logs: $logFile"
```

**Linux / macOS (bash) — `start-serena.sh`:**

```bash
#!/usr/bin/env bash
PORT=8000
HOST="127.0.0.1"
LOG_DIR="$HOME/.claude/logs"
LOG_FILE="$LOG_DIR/serena.log"
ERR_FILE="$LOG_DIR/serena-err.log"

mkdir -p "$LOG_DIR"

existing_pid=$(lsof -ti tcp:$PORT 2>/dev/null)
if [ -n "$existing_pid" ]; then
    echo "Serena already running on port $PORT (PID $existing_pid) — stopping..."
    kill "$existing_pid" 2>/dev/null
    sleep 1
fi

echo "Starting Serena MCP server on $HOST:$PORT (SSE transport)..."

nohup uvx \
    --from "git+https://github.com/oraios/serena" \
    serena start-mcp-server \
    --transport sse \
    --host "$HOST" \
    --port "$PORT" \
    --context desktop-app \
    --open-web-dashboard False \
    >"$LOG_FILE" 2>"$ERR_FILE" &

echo "Serena started (PID $!). SSE endpoint: http://$HOST:$PORT/sse"
echo "Logs: $LOG_FILE"
```

### Step 2 — Register the SSE endpoint with Claude Code

Run once (after the server is started):

```bash
claude mcp add serena --transport sse http://127.0.0.1:8000/sse --scope user
```

This registers a user-scoped SSE entry that overrides the plugin's stdio entry.
Verify with:

```bash
claude mcp list
```

You should see `serena` listed with the SSE URL.

### Step 3 — Run at login (optional)

**Windows — Task Scheduler:**

```powershell
schtasks /create `
  /tn "Serena MCP Server" `
  /tr "powershell -WindowStyle Hidden -File `"$env:USERPROFILE\.claude\scripts\start-serena.ps1`"" `
  /sc onlogon `
  /ru "$env:USERNAME"
```

**macOS — LaunchAgent:**

Create `~/Library/LaunchAgents/com.user.serena-mcp.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>             <string>com.user.serena-mcp</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-l</string>
    <string>-c</string>
    <string>~/.claude/scripts/start-serena.sh</string>
  </array>
  <key>RunAtLoad</key>         <true/>
  <key>KeepAlive</key>         <false/>
  <key>StandardOutPath</key>   <string>/tmp/serena-mcp-launch.log</string>
  <key>StandardErrorPath</key> <string>/tmp/serena-mcp-launch-err.log</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.user.serena-mcp.plist
```

**Linux — systemd user service:**

Create `~/.config/systemd/user/serena-mcp.service`:

```ini
[Unit]
Description=Serena MCP Server
After=network.target

[Service]
Type=forking
ExecStart=%h/.claude/scripts/start-serena.sh
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=default.target
```

```bash
systemctl --user enable --now serena-mcp
```

---

## Project-Local Claude Config (`.claude/`)

This repo ships project-local Claude config under `.claude/`. It is
**separate from the installable MDT content** in `rules/`, `skills/`,
`agents/`, and `commands/` at the repo root.

| Path | Purpose |
|------|---------|
| `.claude/rules/context-mode.md` | MDT-specific guidance on when to use ctx_execute / ctx_execute_file |
| `.claude/rules/serena.md` | Serena symbol-navigation patterns for this repo |
| `.claude/skills/context-mode/` | context-mode SKILL.md + reference files |
| `.claude/skills/serena-mcp/` | Serena MCP SKILL.md |

These files are loaded automatically by Claude Code when you open this repo.
You do not need to install them.

---

## Recommended Shell Tools for MDT Development

Both `rg` and `fd` are faster than their stdlib equivalents and are the
preferred tools for non-LSP searches in this repo.

| Tool | Use instead of | When |
|------|---------------|------|
| `rg` | `grep`, `search_for_pattern` | Raw text/regex search across code or docs |
| `fd` | `find`, `find_file` | Locating files by name or extension |

Quick reference:

```bash
rg "resolveInstallPlan" scripts/          # literal search in a directory
rg -t md "context-mode" docs/             # Markdown files only
fd SKILL.md                               # find all SKILL.md files in repo
fd -e js scripts/ci/                      # .js files under scripts/ci/
```

---

## Verification

After setup, confirm everything is connected:

```bash
# Serena is running
curl -s http://127.0.0.1:8000/sse | head -1   # should return SSE event stream

# Claude Code sees the SSE server
claude mcp list                                # serena should appear with SSE URL

# Repo lint and tests pass
npm run lint
npm test
```

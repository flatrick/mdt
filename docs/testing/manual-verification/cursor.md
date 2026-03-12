# Cursor Manual Verification

Use this page to confirm MDT behavior inside Cursor desktop after installing
into a fresh global `~/.cursor/` directory and, when needed, materializing the
repo-local `.cursor/rules/` bridge that Cursor IDE reads.

## Preconditions

1. Start from a clean repo checkout or remove the existing MDT files under `~/.cursor/`.
2. Install MDT into Cursor:

```bash
node scripts/install-mdt.js --target cursor typescript continuous-learning
```

If you want Cursor IDE to read repo-local MDT rules in the current repository,
also materialize the local rules bridge:

```bash
/install-rules
```

Equivalent shell command:

```bash
node ~/.cursor/mdt/scripts/materialize-mdt-local.js --target cursor --surface rules
```

3. Confirm the install exists (full MDT baseline with experimental hooks enabled):

```bash
node -e "const fs=require('fs');const path=require('path');const root=path.join(process.env.HOME||process.env.USERPROFILE,'.cursor'); console.log(fs.existsSync(path.join(root,'hooks.json')));"
```

Expected:
- `~/.cursor/hooks.json` exists (experimental adapter, not a vendor-documented surface)
- `~/.cursor/mdt/hooks/` exists
- `~/.cursor/skills/continuous-learning-manual/` exists
- if the local rules bridge was materialized, repo `.cursor/rules/` exists for
  the opened repo

## Quick Smoke

Run the installed Cursor `smoke` command from Agent chat when you want a fast
sanity check before doing deeper runtime verification.

Expected:
- it reports whether `~/.cursor/` is installed
- it checks for rules, skills, commands, and `AGENTS.md`
- it distinguishes runtime `OK`, `PARTIAL`, `SKIPPED`, and `FAIL`
- it should treat a missing `~/.cursor/mdt/homunculus/` as `PARTIAL` if install paths
  exist but no continuous-learning activity has happened yet
- it tells you what to test next if runtime behavior is not yet proven

## Command Cache Troubleshooting

If Cursor keeps behaving as though an old custom command definition still exists
even after you update or remove files under:

- explicit local bridge `.cursor/commands/`
- user/global `~/.cursor/commands/`

then check Cursor's workspace cache before assuming the installer is still wrong.

Observed local evidence:
- Cursor can retain stale command/retrieval state under
  `C:\Users\<user>\AppData\Roaming\Cursor\User\workspaceStorage\...`
- that cache may continue to surface older command behavior even when the live
  command file on disk is already correct

Recommended reset flow:
1. Fully quit Cursor.
2. Inspect or clear the relevant workspace directory under:
   `C:\Users\<user>\AppData\Roaming\Cursor\User\workspaceStorage\`
3. Reopen the repo in Cursor.
4. Retry the command in a fresh Agent session.

Use this when:
- the on-disk `~/.cursor/commands/*.md` file is correct
- `~/.cursor/commands/` no longer contains the old command
- Cursor still behaves as if an older command definition exists

## Path-Fidelity Troubleshooting

Cursor Agent may sometimes improvise and look in other tool directories such as:

- `.claude/`
- `.codex/`
- repo `skills/`

even when the correct installed Cursor path is already on disk.

If that happens:
1. Confirm the live command file contains the correct `~/.cursor/...` or `~/.cursor/mdt/...` path.
2. Confirm the referenced `~/.cursor/skills/...` or `~/.cursor/mdt/scripts/...` file really exists.
3. Check for stale detached `node.exe` observer/helper processes from older `.cursor/` installs.
4. Clear the relevant `workspaceStorage` cache and retry in a fresh Cursor session.

Do not assume that Cursor searching `.claude/` or `.codex/` proves the MDT
install is still wrong. It can be a cache or agent-path-selection problem even
when the on-disk Cursor install files are correct.

Observer lifecycle note:
- the observer lease file remains
  `~/.cursor/mdt/homunculus/<project-id>/.observer.pid`
- newer installs store JSON lease metadata there, not just a raw PID
- stopping or replacing the observer should now invalidate that lease so stale
  detached helpers self-terminate more reliably

## Continuous Learning

### Observation Capture

Run this inside Cursor desktop with an Agent session:

1. Ask the agent to edit a file.
2. Ask the agent to run a shell command such as `node -v`.

Expected after the edit and shell command:
- `~/.cursor/mdt/homunculus/projects.json` exists
- `~/.cursor/mdt/homunculus/<project-id>/observations.jsonl` exists
- the observations file contains:
  - `"event":"tool_complete"`
  - `"tool":"Edit"` for file edits
  - `"tool":"Bash"` for shell commands

Helpful local check:

```bash
node -e "const fs=require('fs');const path=require('path');const root=path.join(process.env.HOME||process.env.USERPROFILE,'.cursor','mdt','homunculus');const projects=JSON.parse(fs.readFileSync(path.join(root,'projects.json'),'utf8'));const id=Object.keys(projects)[0];console.log(fs.readFileSync(path.join(root,id,'observations.jsonl'),'utf8'));"
```

### Observer Tool Selection

Check observer status from the repo root:

```bash
node ~/.cursor/skills/continuous-learning-manual/agents/start-observer.js status
```

Expected:
- output includes `Observer tool: cursor`
- `Storage:` points into `~/.cursor/mdt/homunculus/...`, not `~/.claude/...`

If you are testing an older install that predates the self-anchoring fix, use this fallback:

```powershell
$env:MDT_OBSERVER_TOOL='cursor'
$env:CURSOR_AGENT='1'
$env:CONFIG_DIR=(Resolve-Path ~\.cursor).Path
node ~\.cursor\skills\continuous-learning-manual\agents\start-observer.js status
```

### Observer Runtime

1. Edit `~/.cursor/skills/continuous-learning-manual/config.json`
2. Set:

```json
{
  "observer": {
    "enabled": true
  }
}
```

3. Start the observer:

```bash
node ~/.cursor/skills/continuous-learning-manual/agents/start-observer.js start
```

Expected:
- output includes `Observer tool: cursor`
- output includes `Observer started`
- output includes `Lease: .../.observer.pid`

4. After enough observations accumulate, inspect:

```bash
node ~/.cursor/skills/continuous-learning-manual/agents/start-observer.js status
```

Expected:
- `Observations:` shows a non-zero line count before analysis
- `Lease:` points at `~/.cursor/mdt/homunculus/<project-id>/.observer.pid`
- `~/.cursor/mdt/homunculus/<project-id>/observations.archive/` is created after analysis runs
- `~/.cursor/mdt/homunculus/<project-id>/observer.log` includes `with cursor (auto)` by default

5. Stop the observer when done:

```bash
node ~/.cursor/skills/continuous-learning-manual/agents/start-observer.js stop
```

## Session Lifecycle

Run a normal Cursor Agent session and then end it cleanly.

Expected:
- `~/.cursor/mdt/sessions/` contains a new session file
- the newest session file includes:
  - `## Session Summary`
  - your user requests
  - modified files
  - `Total user messages:`

## Pass Criteria

- Cursor hooks create continuous-learning observations under `~/.cursor/mdt/homunculus/`
- continuous-learning resolves Cursor-native storage instead of `~/.claude`
- observer status reports `cursor`
- observer uses Cursor CLI defaults, with model `auto` unless overridden
- session summaries still persist correctly under `~/.cursor/mdt/sessions/`

## Behavior Without Hooks

If a future Cursor build stops loading `.cursor/hooks.json` or you install MDT
with `MDT_SKIP_CURSOR_HOOKS=1` set in the environment:

- Rules in `.cursor/rules/` continue to apply as project guidance.
- Skills in `.cursor/skills/` (including `continuous-learning-manual` plus the
  installed coding/testing/security workflow skills) remain available via `/`
  in Agent chat.
- `AGENTS.md` at the project root still participates in Cursor’s agent system.
- Cursor’s custom commands, memories, background agents, and MCP features
  remain available as documented in [docs/tools/cursor.md](../../tools/cursor.md).

In that configuration you will not see hook-driven behaviors (e.g. dev-server
blocking, automatic console.log audits, or automatic observation capture), but
the main MDT workflows remain usable through rules, skills, and agents.

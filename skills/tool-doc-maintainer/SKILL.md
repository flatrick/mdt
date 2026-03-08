---
name: tool-doc-maintainer
description: Keep MDT's tool capability docs under docs/tools/ correct, sourced, and locally verified without guessing.
---

# Tool Doc Maintainer

Use this skill when updating MDT's cross-tool documentation for Claude Code, Cursor, Codex, or OpenCode.

## When to Use

- Updating `docs/tools/` pages after local verification or official-doc review
- Checking whether a cross-tool capability claim is still current
- Reconciling differences between MDT adapters and vendor-native features
- Refreshing audit dates, local version notes, and verification status labels

## Goal

Maintain `docs/tools/` as the authoritative source for:
- what each tool can and cannot do
- what the native surface is called
- whether MDT is using an official surface, an experimental path, or a repo adapter
- how to verify claims locally

## Never Do This

- Never guess from memory when the docs pack or local CLI can answer it.
- Never upgrade a claim to `official` without a vendor-doc source.
- Never treat a repo file as proof of vendor support.
- Never silently copy stale claims from files outside `docs/`.

## Source Of Truth Order

1. `docs/tools/`
2. Local installed CLI output
3. Repo adapter/config files
4. Official vendor docs

Files outside `docs/tools/` may be stale. Treat them as evidence to check, not as truth.

## Required Workflow

### 1. Start in `docs/tools/`

Read:
- `docs/tools/capability-matrix.md`
- the relevant per-tool page
- `docs/tools/local-verification.md`

If the answer is already there and still verified, use it.

### 2. Check local installation

Use the shell already available in the environment. Do not assume Windows or PowerShell.

PowerShell example:

```powershell
$tools = 'claude','cursor','codex','opencode'
foreach ($t in $tools) {
  $cmd = Get-Command $t -ErrorAction SilentlyContinue
  if ($cmd) { "$t => $($cmd.Source)" } else { "$t => MISSING" }
}
```

POSIX shell example:

```bash
for t in claude cursor codex opencode; do
  if command -v "$t" >/dev/null 2>&1; then
    printf '%s => %s\n' "$t" "$(command -v "$t")"
  else
    printf '%s => MISSING\n' "$t"
  fi
done
```

If a tool is missing, mark it `not-locally-verified`.

### 3. Run local probes

For installed tools, use the playbook commands in whatever shell is available:

```bash
claude --version
claude --help
claude agents --help
claude mcp --help

cursor --version
cursor --help
agent --help
cursor agent --help
cursor-agent --help

codex --version
codex --help
codex exec --help
codex features list

opencode --version
opencode --help
```

Record the exact version you saw.

### 4. Check what MDT actually ships

Inspect the relevant repo files before making claims:

- Claude: `claude-template/hooks.json`, `commands/`, `agents/`, `skills/`
- Cursor: `cursor-template/rules/`, `cursor-template/hooks.json`, `cursor-template/hooks/`
- Codex: `codex-template/config.toml`, `codex-template/AGENTS.md`
- OpenCode: `opencode-template/opencode.json`, `opencode-template/plugins/`, `opencode-template/commands/`

This tells you what MDT is doing, not what the vendor guarantees.

### 5. Browse official docs only when needed

Browse if:
- the page has no current audit date
- the local version changed
- a claim conflicts with local output
- a claim is currently `experimental` or `repo-adapter`

Use only official vendor docs for support-level decisions.

### 6. Update statuses carefully

Use these labels:
- `official`
- `locally-verified`
- `experimental`
- `repo-adapter`
- `unsupported`
- `not-locally-verified`

Rules:
- `official` requires vendor docs
- `locally-verified` requires local CLI evidence
- `experimental` is valid when the repo or tool exposes something unstable or undocumented
- `repo-adapter` means MDT can emulate the workflow, but the tool does not expose the same named primitive

### 7. Keep page footers current

Every updated page must include:
- audit date
- local version or `not installed locally`
- status labels in use
- source links

## What To Do When Docs Conflict

If `docs/tools/` conflicts with files outside `docs/`:
1. Trust local verification plus vendor docs.
2. Update `docs/tools/` first.
3. Note the conflict plainly in the relevant page.
4. Do not silently inherit the stale claim.

## Good Outcomes

A good update lets another agent answer these without browsing first:
- Can this tool do `hooks`?
- What is the nearest native equivalent?
- Is MDT using an official feature or an adapter?
- What file/path/config shape should I edit?
- How can I verify the answer locally?

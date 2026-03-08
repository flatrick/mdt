# Local Verification Playbook

Use this when you need to refresh or challenge any claim in the MDT tool docs.

## Verification Order

1. Read the relevant page in `docs/tools/`.
2. Check whether the tool is installed locally.
3. Run local CLI probes first.
4. Run the local setup verification scripts.
5. Inspect MDT's repo adapter/config files.
6. Only then open vendor docs if:
   - the local version changed,
   - the page is stale,
   - local behavior conflicts with current docs,
   - or a claim is still `experimental` / `repo-adapter`.

## Status Update Rules

- Upgrade to `official` only with vendor docs.
- Upgrade to `locally-verified` only with local command output or successful local behavior.
- Leave as `experimental` if the repo supports it but vendor docs do not clearly document it.
- Leave as `repo-adapter` if MDT can emulate the outcome but the vendor does not name/support the concept directly.
- Use `not-locally-verified` if the tool is missing on this machine.

## Local Commands

### Workflow Contract

```bash
node scripts/verify-tool-setups.js
node scripts/smoke-tool-setups.js
node scripts/smoke-codex-workflows.js
```

Use `verify-tool-setups.js` as the deterministic local check for the core MDT workflows:
- `plan`
- `tdd`
- `code-review`
- `verify`
- `security`
- `e2e`

Use `smoke-tool-setups.js` as an optional local CLI probe. Missing tools should be recorded as `SKIP`, not guessed as passing or failing.

Use `smoke-codex-workflows.js` when you want a deeper Codex-specific check for MDT's current `plan`, `tdd`, and `verify` workflows without requiring a live model session.

### Claude Code

```bash
claude --version
claude --help
claude agents --help
claude mcp --help
```

### Cursor

```bash
cursor --version
cursor --help
agent --help
cursor agent --help
cursor-agent --help
```

Cursor desktop should currently be treated as a manual verification surface.
Prefer `agent` or `cursor-agent` for automated local smoke checks, and use the
desktop app only for manual workflow confirmation inside Cursor itself.

### Codex

```bash
codex --version
codex --help
codex exec --help
codex features list
```

### OpenCode

```bash
opencode --version
opencode --help
```

If `opencode` is not installed:
- inspect `opencode-template/opencode.json`
- inspect `opencode-template/plugins/`
- keep status as `not-locally-verified`

## Repo Adapter Checks

Use these files to confirm what MDT actually ships:

- Claude: `claude-template/hooks.json`, `commands/`, `agents/`, `skills/`
- Cursor: `cursor-template/rules/`, `cursor-template/hooks.json`, `cursor-template/hooks/`
- Codex: `codex-template/config.toml`, `codex-template/AGENTS.md`
- OpenCode: `opencode-template/opencode.json`, `opencode-template/plugins/`, `opencode-template/commands/`, `opencode-template/prompts/agents/`

## Minimum Evidence Required Per Claim

| Claim type | Required evidence |
|---|---|
| Official feature exists | vendor docs link |
| Locally installed tool exists | `--version` or `--help` output |
| MDT ships an adapter | repo file path |
| Feature is experimental | vendor docs say experimental, local feature flags, or no vendor docs but repo adapter exists |
| Feature is unsupported | no vendor docs found in current audit and no reliable local surface |

## Required Page Footer Data

Every page in `docs/tools/` should keep:
- audit date
- tool version or `not installed locally`
- status labels used on the page
- source links

## Current Machine Baseline

- Claude Code installed: yes
- Cursor installed: yes
- Cursor terminal agent installed: yes
- Codex installed: yes
- OpenCode installed: no

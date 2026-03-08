# Local Verification Playbook

Use this when you need to refresh or challenge any claim in the MDT tool docs.

## Verification Order

1. Read the relevant page in `docs/tools/`.
2. Check whether the tool is installed locally.
3. Run local CLI probes first.
4. Inspect MDT's repo adapter/config files.
5. Only then open vendor docs if:
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
- inspect `.opencode/opencode.json`
- inspect `.opencode/plugins/`
- keep status as `not-locally-verified`

## Repo Adapter Checks

Use these files to confirm what MDT actually ships:

- Claude: `hooks/claude/hooks.json`, `commands/`, `agents/`, `skills/`
- Cursor: `.cursor/rules/`, `.cursor/hooks.json`, `.cursor/hooks/`
- Codex: `.codex/config.toml`, `.codex/AGENTS.md`
- OpenCode: `.opencode/opencode.json`, `.opencode/plugins/`, `.opencode/commands/`, `.opencode/prompts/agents/`

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

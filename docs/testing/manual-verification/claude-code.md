# Claude Code Manual Verification

Use this page for quick Claude Code sanity checks and deeper runtime verification
when MDT is installed into `~/.claude/`.

## Preconditions

1. Start from a clean repo checkout or remove the existing MDT files under `~/.claude/`.
2. Install MDT into Claude Code:

```bash
node scripts/install-mdt.js typescript continuous-learning
```

3. Confirm the install exists:

```bash
node -e "const fs=require('fs');const path=require('path');const root=path.join(process.env.HOME||process.env.USERPROFILE,'.claude'); console.log(fs.existsSync(path.join(root,'settings.json')));"
```

Expected:
- `~/.claude/settings.json` exists
- `~/.claude/commands/smoke.md` exists
- `~/.claude/skills/continuous-learning-manual/` exists

## Quick Smoke

Run the shared `smoke` command from a Claude Code session when you want a fast
check before doing deeper validation.

Expected:
- it reports whether the active `~/.claude/` install is present
- it checks for commands, agents, skills, and hook/runtime assets
- it distinguishes runtime `OK`, `PARTIAL`, `SKIPPED`, and `FAIL`
- it should treat a missing continuous-learning storage path as `PARTIAL` if the
  install exists but no relevant runtime activity has happened yet
- it points you at the next manual step if runtime behavior still needs proof

Use the deterministic workflow smoke companion when you want a local
non-session check of the Claude workflow surfaces:

```bash
node scripts/smoke-claude-workflows.js
```

If you are validating the installed Claude home rather than the MDT source repo:

```bash
node ~/.claude/mdt/scripts/smoke-claude-workflows.js
```

Expected:
- repo-source mode reports the 7 core Claude workflows
- installed-home mode verifies the materialized `~/.claude/` commands, agents,
  skills, settings, and workflow smoke script
- `smoke` may report `SKIP` when local Claude CLI probes are blocked by the
  environment, but required files still exist

## Likely Deeper Checks

- fresh install verification under `~/.claude/`
- hook execution and hook side effects
- session summary persistence
- continuous-learning observation capture
- continuous-learning observer runtime
- manual checks for Claude-native commands, agents, and memory behavior

## Notes

- Keep this page focused on behavior that must be verified inside a real Claude Code session.
- Keep CLI-first checks in [docs/tools/local-verification.md](../../tools/local-verification.md).

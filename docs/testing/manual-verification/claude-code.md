# Claude Code Manual Verification

Use this page for quick Claude Code sanity checks and deeper runtime verification
when MDT is installed into `.claude/`.

## Quick Smoke

Run the shared `smoke` command from a Claude Code session when you want a fast
check before doing deeper validation.

Expected:
- it reports whether the active `.claude/` install is present
- it checks for commands, agents, skills, and hook/runtime assets
- it distinguishes runtime `OK`, `SKIPPED`, and `FAIL`
- it points you at the next manual step if runtime behavior still needs proof

## Likely Deeper Checks

- fresh install verification under `.claude/`
- hook execution and hook side effects
- session summary persistence
- continuous-learning observation capture
- continuous-learning observer runtime
- manual checks for Claude-native commands, agents, and memory behavior

## Notes

- Keep this page focused on behavior that must be verified inside a real Claude Code session.
- Keep CLI-first checks in [docs/tools/local-verification.md](../../tools/local-verification.md).

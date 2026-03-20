# Environment Detection Contract (Tests)

This contract is the source of truth for test profiles that rely on environment detection behavior in `scripts/lib/detect-env.js`.

## Recognized detection variables

Tool detection only considers these variables:

- `CURSOR_AGENT`
- `CLAUDE_SESSION_ID`
- `CLAUDE_CODE`
- `CODEX_AGENT`

Variables outside this list are **neutral** for tool detection.

## Precedence rules

Detection order is strict and intentional:

1. `CURSOR_AGENT === "1"` → tool is `cursor`
2. else if `CLAUDE_SESSION_ID` is a non-empty string → tool is `claude`
3. else if `CLAUDE_CODE === "1"` → tool is `claude`
4. else if `CODEX_AGENT === "1"` → tool is `codex`
5. otherwise → tool is `unknown`

Implications:

- If both Cursor and Claude signals are present, Cursor wins.
- `CLAUDE_SESSION_ID` and `CLAUDE_CODE` both map to `claude`, but session ID check runs first.
- `CODEX_AGENT` only applies when no higher-precedence Cursor or Claude signal matched first.

## What `neutral` means

A variable/value is **neutral** when it does not influence tool detection and cannot force `cursor`, `claude`, or `codex`.

Examples:

- Unrecognized vars (`NODE_ENV`, `CI`, etc.)
- Recognized vars with non-matching values (`CURSOR_AGENT="0"`, `CLAUDE_CODE="0"`, `CODEX_AGENT="0"`)
- Empty Claude session IDs (`CLAUDE_SESSION_ID=""`)

When all available signals are neutral, detection must resolve to `unknown`.

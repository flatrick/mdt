# Hooks

This page documents MDT hook-capable integrations.

Current state:
- Claude Code has native hook support
- Cursor uses an experimental MDT adapter
- Codex is not a Claude-style hook target

## Source Layout

MDT keeps tool-specific hook sources under explicit directories:

- **`scripts/hooks/`** — **Shared hook logic** (tool-agnostic). The current shared runtime shape is normalized around the existing hook payload contract used by MDT's hook-capable integrations. Used by:
  - **Claude Code**: invoked directly from `claude-template/hooks.json` and `hooks/hooks.json` via paths like `scripts/hooks/session-start.js`, `scripts/hooks/session-end.js`, etc.
  - **Cursor**: not invoked directly by Cursor; the Cursor wrappers in `hooks/scripts/` call into these via the adapter’s `runExistingHook()`.
- **`hooks/scripts/`** — **Shared hook script entry points**. Scripts that Cursor runs (session-start.js, session-end.js, etc.). They receive Cursor’s event payload, normalize it into MDT's shared hook payload shape, and delegate to `scripts/hooks/*.js`. Config lives in `cursor-template/hooks.json`.

Config sources:

- `claude-template/hooks.json` - source of truth for Claude hook config
- `cursor-template/hooks.json` - source of truth for Cursor hook config (scripts are in `hooks/scripts/`)

Native tool-facing mirrors remain checked in so the repo self-hosts cleanly when opened in supported tools:

- `hooks/hooks.json` - Claude-facing mirror
- Cursor: installer copies `cursor-template/hooks.json` and `hooks/scripts/` into `.cursor/` at install time

Update the platform-scoped source files first, then run:

```bash
node scripts/sync-hook-mirrors.js
```

## Cursor Hook Adapter

Treat the Cursor hook layer as an MDT adapter, not as vendor-native truth.

Rules:
- keep wrappers small and event-specific
- prefer shared logic in `scripts/hooks/` and `scripts/lib/`
- fail open when the adapter cannot safely enforce behavior
- do not describe Cursor hooks as if they are a documented vendor surface

## Operational Rule

Current-state docs should describe hooks as vendor-specific behavior, not as the base MDT contract.

# Backlog

Deferred work items that are documented but not yet scheduled.

---

## Replace hardcoded `~/.claude/` with tool-aware paths

**Status:** Completed for generic docs, commands, skills, and JSDoc/comments. Remaining `~/.claude/` mentions are intentional Claude-specific examples, upstream-reference guides, validator/test text, or explicit compatibility notes.

**Why it mattered:** MDT supports multiple tools (Claude Code, Cursor, Codex, OpenCode). Generic documentation now uses config-dir/data-dir wording unless a tool-specific path is required.

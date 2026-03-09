# Backlog

Deferred work items that are documented but not yet scheduled.

---

## Replace hardcoded `~/.claude/` with tool-aware paths

**Status:** Completed for generic docs, commands, skills, and JSDoc/comments. Remaining `~/.claude/` mentions are intentional Claude-specific examples, upstream-reference guides, validator/test text, or explicit compatibility notes.

**Why it mattered:** MDT supports multiple tools (Claude Code, Cursor, Codex, OpenCode). Generic documentation now uses config-dir/data-dir wording unless a tool-specific path is required.

---

## Local-first tool setup and workflow verification

**Status:** Core local verification now exists.

Implemented:

- `docs/tools/workflow-matrix.md` for intended MDT workflow behavior by tool
- `scripts/verify-tool-setups.js` for deterministic local contract checks
- `scripts/smoke-tool-setups.js` for local CLI smoke probes
- `scripts/smoke-codex-workflows.js` for deeper Codex workflow smoke on `plan`, `tdd`, and `verify`
- `skills/tool-setup-verifier/SKILL.md` and `harness-audit setup` guidance

Remaining follow-up:

- Add deeper workflow smoke coverage for Claude
- Decide whether Cursor desktop verification should remain manual or get a documented assisted workflow
- Add OpenCode local smoke coverage once OpenCode is installed locally

---

## Cursor install copies non-requested skills

**Status:** Open.

**Repro:**

```text
node scripts/install-mdt.js --target cursor typescript
```

**Current behavior:** Cursor install copies skills for unrelated languages as
well, including items such as Rust and SQL-oriented skills.

**Expected behavior:** A language-scoped Cursor install should only copy the
skills intended for the requested install scope, or otherwise follow an explicit
tool-level rule for which skills are global versus language-specific. It should
not silently install unrelated language skills when only `typescript` was
requested.

---

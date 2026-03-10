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

## Split continuous-learning into manual and hook-driven skills

**Status:** Open.

The current `continuous-learning-v2` skill conflates two distinct workflows that
should be separate:

**1. `continuous-learning` (manual / operator-triggered)**
- Operator explicitly asks the tool to review the current session and extract
  useful patterns, repeated workflows, or automation candidates
- No hooks required — works in any tool including Codex
- Entry points: `codex-learn.js capture`, `/learn`, session-end prompts
- Target: all tools (Claude, Cursor, Codex, OpenCode)

**2. `continuous-learning-hooks` (automatic / hook-driven)**
- Observation fires automatically on file edit and shell execution via hooks
- Higher fidelity but requires hook infrastructure (Claude, Cursor only)
- Falls back to manual CLI if hooks are unavailable
- Target: Claude Code, Cursor (hook-capable tools only)

**Why do this together with the rename:**
The skill directory and `SKILL.md` frontmatter are still named
`continuous-learning-v2`. The package is already `continuous-learning`.
A rename touches ~50 files. Doing the rename and the split at the same time
avoids two large refactors.

**Scope of work:**
1. Create `skills/continuous-learning/` for the manual skill (rename + trim)
2. Create `skills/continuous-learning-hooks/` for the hook-driven skill (extract)
3. Update `packages/continuous-learning/package.json` to list both skills
   with `requires.hooks` on the hook-driven one
4. Update `codex-template/skills/`, `cursor-template/`, `claude-template/`
   references
5. Update `hooks/hooks.json` and Cursor hook scripts to reference the new path
6. Update all ~50 other file references (commands, docs, tests, installed copies)
7. Update installed copies under `.claude/`, `.cursor/` if present

**Constraint:** Do not do the rename without the split — a rename-only pass just
creates a second large refactor shortly after.

---

## Harden tool home directories for all supported tools

**Status:** Open — Codex only.

`codex-template/hardening/` contains an optional hardening bundle for Codex:

- `apply-codex-home-hardening.mjs` — restricts `auth.json` to owner-only permissions
  (Windows: removes sandbox-user ACL entries via `icacls`; POSIX: `chmod 600`)
- `verify-codex-home-hardening.mjs` — checks that the hardening is in place
- `PROMPT.md` — an adaptive Codex prompt for hardening on another machine or as
  another user, without requiring the scripts to be present

This is **opt-in** — the installer does not apply hardening automatically.
Users run it manually: `node codex-template/hardening/apply-codex-home-hardening.mjs`.

**What to replicate for other tools:**

Each tool stores sensitive local state (auth tokens, session history, API keys)
in its home directory. The specific files differ per tool:

| Tool | Sensitive files | Home path |
|---|---|---|
| Codex | `auth.json`, `history.jsonl`, `sessions/`, `state_*.sqlite*` | `~/.codex/` |
| Claude Code | `credentials`, session data | `~/.claude/` |
| Cursor | auth state, telemetry | `~/.cursor/` |
| OpenCode | auth, session state | tool-specific |

**Proposed approach:**

- Add a `<tool>-template/hardening/` bundle for each tool following the Codex pattern
- Each bundle: `apply-<tool>-home-hardening.mjs`, `verify-<tool>-home-hardening.mjs`, `PROMPT.md`
- Keep them opt-in — never run from `install-mdt.js` automatically
- Consider a future `scripts/harden.js --target <tool>` unified entry point once
  multiple bundles exist

**Constraint:** Do not implement until the tool is installed and locally verified,
so that actual sensitive file paths can be confirmed rather than guessed.

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

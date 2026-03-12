# Backlog

Deferred work items that are documented but not yet scheduled.

Completed backlog items have been moved to:

- [History: 2026-03-11 global-install stabilization](docs/history/2026-03-11.global-install-stabilization.md)

---

## Homunculus .self/ scope for MDT meta-learnings (dev installs only)

**Status:** Open — not yet implemented.

When MDT is installed with `--dev`, create a reserved `~/.{tool}/mdt/homunculus/.self/` scope for instincts and observations that are *about MDT itself* — its conventions, install layout, skill structure, and design decisions — rather than about the user's projects.

This prevents MDT meta-learnings from contaminating project-scoped instincts in `mdt-git/` when the active project happens to be MDT.

Scope of work:
- Only created/activated when `--dev` was used at install time
- Same internal structure as any project scope (`instincts/`, `evolved/`, `observations.jsonl`, etc.)
- Detection: check for a `--dev` install marker (e.g. a flag in `~/.{tool}/mdt/install.json`)
- `detect-project.js` should route to `.self/` when cwd is the MDT repo and dev mode is active
- Document the `.self/` scope in the continuous-learning SKILL.md and NEXT-STEPS.md when implemented

---

## Homunculus project detection: non-git VCS support

**Status:** Open — git only is implemented.

Project IDs for VCS-tracked projects use a `<repo-name>-<VCS>` suffix (e.g., `mdt-git`). Only git remote URL detection is implemented today.

When support for other VCS systems is added, extend `detect-project.js` to detect and emit the appropriate suffix:

- Mercurial: detect `.hg/` → suffix `-hg`
- SVN: detect `.svn/` → suffix `-svn`
- Fossil: detect `.fossil` / `_FOSSIL_` → suffix `-fossil`
- Jujutsu: detect `.jj/` → suffix `-jj`

Projects without any detectable git repository should stay in the global homunculus scope rather than creating a project-specific folder. Local git repos without a remote can still use a repo-root-anchored fallback project ID.

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

**Proposed approach:**

- Add a `<tool>-template/hardening/` bundle for each tool following the Codex pattern
- Each bundle: `apply-<tool>-home-hardening.mjs`, `verify-<tool>-home-hardening.mjs`, `PROMPT.md`
- Keep them opt-in — never run from `install-mdt.js` automatically
- Consider a future `scripts/harden.js --target <tool>` unified entry point once
  multiple bundles exist

**Constraint:** Do not implement until the tool is installed and locally verified,
so that actual sensitive file paths can be confirmed rather than guessed.

---

## Cursor duplicate command-name precedence between `~/.cursor/` and explicit local bridges

**Status:** Open.

**Observed behavior:**

When the same command name exists in both:

- `~/.cursor/commands/`
- project `.cursor/commands/`

Cursor slash-command selection appears to prefer the user/global copy, even when
the project-local copy also exists and is visible when listing commands or
opening files manually.

**Why it matters:**

MDT now installs Cursor globally by default, but this can still matter when an
explicit local bridge creates a repo-local Cursor surface. If command names
collide across those scopes, Cursor may hide the intended local behavior in the
picker even though the project copy is present.

**Potential follow-up options:**

- avoid installing duplicate command names in both scopes
- document Cursor precedence if it proves stable and unavoidable
- introduce a naming convention such as `u-<name>` and `p-<name>` for
  user/global vs project-local commands if Cursor cannot distinguish scopes
  cleanly

**Related troubleshooting note:**

Cursor may also retain stale command/retrieval state under
`AppData\Roaming\Cursor\User\workspaceStorage\...`, so command bugs should not
be diagnosed from `.cursor/commands/` alone. If the on-disk command file is
correct but Cursor still behaves as if an older command exists, clear the
relevant workspace cache and retry in a fresh session before changing MDT.

Cursor Agent may also improvise across tool boundaries when uncertain and look
in `.claude/`, `.codex/`, or repo `skills/` even when the correct `.cursor/...`
path exists. Future hardening work should keep Cursor prompts single-path and
tool-local wherever possible.

Local verification also shows `cursor-agent` accepts user-global rule files
under `~/.cursor/rules/*.mdc`. Keep this classified as `cursor-agent` /
locally verified behavior until vendor docs clarify whether the IDE and CLI are
meant to behave the same way.

---

## Migrate Node runtime scripts to `.mjs` after v1.0.0 stabilization

**Status:** Deferred until MDT is considered "gold" / ready for `v1.0.0`.

Current MDT runtime scripts intentionally stay on `.js` because the repo still
has a large CommonJS-based Node script surface shared across source, tests,
installer mirrors, and installed tool runtime paths.

**Planned timing:**

- do not start a repo-wide `.mjs` migration before `v1.0.0`
- only begin once MDT is stable enough that broad runtime churn will not hide
  higher-priority product/workflow issues

**Why defer it:**

- the current benefit is mostly module-format explicitness, not urgent product value
- the migration would touch source scripts, tests, installer behavior, docs, and
  per-tool installed runtime copies
- doing it too early would create avoidable churn while MDT is still stabilizing

**When the time comes:**

- treat it as a deliberate runtime policy change
- plan it repo-wide rather than file-by-file
- verify Claude, Cursor, Codex, and Gemini installed script behavior after the change

---

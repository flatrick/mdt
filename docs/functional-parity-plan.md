# Functional Parity Plan

This document captures the analysis of where MDT's currently supported tools differ
in what they can achieve, what can be brought to functional parity, and what
requires external processes or manual steps due to vendor limitations.

Audit base: the [capability matrix](tools/capability-matrix.md),
[workflow matrix](tools/workflow-matrix.md), per-tool pages under
[docs/tools/](tools/), and the actual template contents under
`claude-template/`, `cursor-template/`, and `codex-template/`.

---

## Current State Summary

Claude Code is the reference implementation. The other tools diverge in specific
ways due to differences in their native surface areas.

### Capability Comparison

| Capability | Claude Code | Cursor | Codex |
|---|---|---|---|
| Project guidance | `CLAUDE.md` + settings | `.cursor/rules/` + `AGENTS.md` | `AGENTS.md` + `.rules` |
| Rules (file-based) | `~/.claude/rules/` (user+project) | `.cursor/rules/` (project only; user=DB) | `.rules` files in config layers |
| Skills | native `SKILL.md` | native `SKILL.md` | native `.codex/skills/` |
| Slash commands | native markdown commands | native custom commands | built-in session commands only |
| Subagents | native | custom modes + background agents | `AGENTS.md`; multi-agent=experimental |
| Event hooks | native (6 lifecycle types) | **experimental** (MDT adapter) | **unsupported** |
| MCP | native | native | native via `config.toml` |
| Continuous learning | hook-driven auto-observe | hook-driven auto-observe (experimental) | **manual CLI only** |
| Session persistence | hook-driven | hook-driven (experimental) | **unsupported** |
| Cost tracking | hook-driven | hook-driven (experimental) | **unsupported** |

### What Each Template Actually Ships

| Asset Type | claude-template | cursor-template | codex-template |
|---|---|---|---|
| Hook definitions | 1 file (hooks.json) | 17 files (hooks.json + scripts) | 0 |
| Rules | 0 (installed from `rules/`) | 19 files | 1 (README only) |
| Commands | 0 (installed from `commands/`) | 8 files | 0 (uses skills) |
| Skills | 0 (installed from `skills/`) | 1 (frontend-slides) | 24 full skills |
| Agents | 0 (installed from `agents/`) | 0 (referenced in rules) | AGENTS.md |
| Tools/Scripts | 0 | 0 | scripts in skills |

Note: Claude, Cursor, and Codex all receive additional content via
`install-mdt.js` package-driven installs. The numbers above reflect the
template directories only — what ships as the tool-specific baseline before
packages are applied.

---

## Gap Analysis

### Cursor Gaps (vs Claude Code)

| Gap | Impact | Fixable? | How |
|---|---|---|---|
| **Skills**: only 1 Cursor-specific skill in template; shared skills arrive via package install | Users who install without packages get almost nothing | Yes | Add more skills to `cursor-template/skills/` or rely fully on package-driven install (current direction) |
| **User-level rules**: Cursor IDE appears to keep user-global rules in Cursor-managed app storage, while local `cursor-agent` accepts file-installed `~/.cursor/rules/*.mdc` (last locally true `2026-03-12`) | Install behavior differs by Cursor surface | Partially | Use `~/.cursor/rules/*.mdc` only for `cursor-agent`-style global installs, and treat repo-local rules only as an explicit bridge |
| **Hooks**: experimental adapter, not vendor-documented | Could break in any Cursor update | Partially | Keep hooks optional; core workflows must work without them |
| **Commands**: 8 shipped vs Claude's full 33-command catalog | Missing: e2e, build-fix, security, refactor-clean, eval, loop, checkpoint, instinct-\*, etc. | Yes | Add to `cursor-template/commands/` and package manifests |
| **Continuous learning**: depends on experimental hooks | If hooks break, learning stops silently | Partially | Add a manual CLI fallback like Codex has |

### Codex Gaps (vs Claude Code)

| Gap | Impact | Fixable? | How |
|---|---|---|---|
| **No hooks** | No automatic session-start/end, no auto-observe, no auto-format, no pre-tool validation | **No** (vendor limitation) | External process or manual steps required (see plan below) |
| **No markdown commands** | Can't invoke `/plan`, `/tdd` etc. as slash commands | By design | Use skills + AGENTS.md guidance instead (current approach) |
| **Session persistence** | No automatic session save/resume | No native way | **Manual**: user runs `codex-learn.js capture` after sessions |
| **Cost tracking** | No automatic cost logging | No native way | **Manual**: user checks Codex billing dashboard or API billing |
| **Auto-formatting** | No post-edit auto-format hook | No native way | **External**: run formatter in pre-commit git hook or editor config |
| **TypeScript checking** | No post-edit type-check hook | No native way | **External**: run in pre-commit git hook or CI |
| **Console.log detection** | No pre-commit console.log warning | No native way | **External**: run in pre-commit git hook or linter rule |
| **Continuous learning**: manual-only observation capture | Lower fidelity than Claude/Cursor auto-observe | Partially | **External process**: optional Node watcher outside Codex session |
| **Rules**: minimal (README only in template) | No actual rule files installed | Yes | Add package-selected rules to `codex-template/rules/` |
| **Multi-agent**: experimental feature flag | Cannot reliably delegate to subagents | Not yet | Wait for Codex to stabilize multi-agent |

## Why Some Gaps Cannot Be Closed

### Codex: No Hooks (Fundamental Vendor Limitation)

Codex does not expose an event hook surface. This is the single largest parity
gap and affects multiple MDT workflows:

| Capability | Claude/Cursor (hooks) | Codex alternative | Trade-off |
|---|---|---|---|
| Auto-format on edit | Instant, every edit | Git pre-commit hook | Delayed to commit time |
| Auto-typecheck on edit | Instant, every edit | Git pre-commit hook | Delayed to commit time |
| Session start/end tracking | Automatic | Manual `capture` CLI | Requires user discipline |
| Continuous learning observe | Automatic on file edit + shell exec | Manual or external watcher | Lower fidelity or extra process |
| Cost tracking | Automatic per-tool-use | External billing dashboard | No per-session granularity |
| Pre-tool validation | Before each tool use | AGENTS.md guidance only | Advisory, not enforced |

**Conclusion**: Accept these as documented limitations. The git hook bridge
(Phase 1a below) covers the most important quality gates. For continuous
learning, offer both the manual CLI (zero-infra) and the optional external
watcher (higher fidelity, requires a second terminal).

### Cursor: User-Level Rules (Surface Split)

Local verification last true on `2026-03-12` shows a real split between Cursor
surfaces:

- Cursor IDE reads project rules from the opened repo's `.cursor/rules/`
- Cursor IDE user-global rules appear to live in Cursor-managed app storage
  rather than `~/.cursor/rules/*.mdc`
- `cursor-agent` accepts file-installed user-global rules under
  `~/.cursor/rules/*.mdc`

MDT should therefore treat:

- repo-local `.cursor/rules/` as the project-rule surface used by Cursor IDE
- `~/.cursor/rules/*.mdc` as a `cursor-agent` global-rule surface

These should not be described as interchangeable.

## Implementation Plan

### Phase 1: Codex Parity — External Process Strategy (P1)

#### 1a. Git Hook Bridge for Codex

Create a `scripts/codex-git-hooks.js` installer that sets up git hooks
(`pre-commit`, `post-commit`) to cover what Claude's event hooks do
automatically:

| Claude Hook | Git Hook Equivalent | What to run |
|---|---|---|
| PostToolUse: auto-format | `pre-commit` | Run prettier/eslint --fix on staged files |
| PostToolUse: typecheck | `pre-commit` | Run `tsc --noEmit` on changed files |
| Stop: console.log check | `pre-commit` | Grep staged files for console.log |
| Stop: session-end persist | `post-commit` | Optionally log commit metadata |

Why external: Codex has no event hook surface. Git hooks are the natural
alternative — they trigger on the same developer actions (editing, committing)
but at the git boundary rather than the AI tool boundary. This is more
tool-agnostic and works even when Codex is not running.

Limitation: Git hooks only fire at commit time, not on every file edit. Issues
are caught later in the cycle compared to Claude's immediate feedback.

**Effort**: Medium

#### 1b. Codex Rule Files in Template

Add package-selected rule files to `codex-template/rules/` so that
`install-mdt.js --target codex` materializes them alongside skills.

Current state: `codex-template/rules/README.md` only — no actual rules.

**Effort**: Small

#### 1c. Cursor Command Expansion

Add high-value commands to `cursor-template/commands/` for workflows currently
missing:

Priority additions:
- `e2e.md` — E2E testing workflow
- `security.md` — Security review workflow
- `build-fix.md` — Build error resolution
- `refactor-clean.md` — Refactoring workflow

Add these to package manifests under `tools.cursor.commands`.

**Effort**: Small-Medium

### Phase 2: Resilience and Consistency (P2)

#### 2a. Codex External Observer

Create an optional `scripts/codex-observer.js` that runs as a background Node
process outside the Codex session, watching `~/.codex/mdt/homunculus/` for changes
and triggering analysis.

Why external: Codex's sandboxed shell blocks subprocess spawning
(`EPERM`/`EACCES`), so the observer cannot run inside a Codex session. A
separate terminal running `node scripts/codex-observer.js --watch` sidesteps
this.

Manual fallback (already exists):
```bash
node ~/.codex/skills/continuous-learning-manual/scripts/codex-learn.js status
node ~/.codex/skills/continuous-learning-manual/scripts/codex-learn.js capture < summary.txt
node ~/.codex/skills/continuous-learning-manual/scripts/codex-learn.js analyze
node ~/.codex/skills/continuous-learning-manual/scripts/codex-learn.js weekly --week YYYY-Www
```

**Effort**: Medium

#### 2b. Cursor Continuous Learning CLI Fallback

Add a manual CLI path for Cursor continuous learning that mirrors Codex's
`codex-learn.js`, so learning continues if the experimental hooks break.

Why: The current Cursor hook adapter is experimental. If Cursor drops or
changes the hooks surface, continuous learning silently stops. A manual CLI
path (`cursor-learn.js status/capture/analyze`) provides a safety net.

**Effort**: Small

#### 2c. Skill Dependency Declarations

Add `requires:` frontmatter to all `SKILL.md` files (from
[NEXT-STEPS.md item 4](../NEXT-STEPS.md)). This enables the installer to warn
when installing to a tool that cannot satisfy dependencies.

Example: `tdd-workflow/SKILL.md` requires `common/testing` rule + hooks. When
installing to Codex (no hooks), the installer warns that auto-observation will
not work and suggests the manual path.

```yaml
---
name: tdd-workflow
description: ...
requires:
  rules:
    - common/testing
    - common/coding-style
  hooks: true
  skills: []
---
```

**Effort**: Medium

#### 2d. Unified Smoke Surface

Ensure each tool has a working smoke path:

| Tool | Current Smoke | Gap |
|---|---|---|
| Claude | `/smoke` command | Missing deeper workflow smoke (plan, tdd, verify, security) |
| Cursor | `/smoke` command | Works but depends on experimental hooks for full check |
| Codex | `tool-setup-verifier` skill + local scripts | Working |

**Effort**: Small

#### 2e. Document Hook Experimental Status Prominently

Ensure every MDT doc that mentions Cursor hooks clearly states:
- The hooks adapter is experimental
- Core workflows work without hooks
- If hooks stop working, use the manual CLI fallback

**Effort**: Small

### Phase 3: Cost Tracking Parity (P2)

| Tool | Current | Parity Path |
|---|---|---|
| Claude | Hook-driven auto-track | Reference implementation |
| Cursor | Hook-driven (experimental) | Add manual fallback |
| Codex | None | **Manual**: Check Codex billing dashboard. No in-tool hook possible. Document as known limitation. |

**Effort**: Small (documentation) to Medium (Cursor fallback)

## Priority Summary

| Priority | Item | Effort | Impact |
|---|---|---|---|
| P1 | 1a. Codex git hook bridge | Medium | Closes biggest quality gap for Codex |
| P1 | 1b. Codex rule files in template | Small | Consistency with other tools |
| P1 | 1c. Cursor command expansion | Small-Medium | Feature coverage |
| P2 | 2a. Codex external observer | Medium | Better learning fidelity |
| P2 | 2b. Cursor learning CLI fallback | Small | Resilience against experimental hooks |
| P2 | 2c. Skill dependency declarations | Medium | Install-time safety |
| P2 | 2d. Unified smoke surface | Small | Verification confidence |
| P2 | 2e. Document hook experimental status | Small | Clarity for users |
| P2 | Phase 3. Cost tracking parity | Small-Medium | Observability |

---

## Related Documents

- [Capability Matrix](tools/capability-matrix.md) — native surface audit
- [Workflow Matrix](tools/workflow-matrix.md) — how MDT workflows map per tool
- [V1 Target State](V1-TARGET-STATE.md) — intended end state
- [NEXT-STEPS.md](../NEXT-STEPS.md) — active roadmap
- Per-tool pages: [Claude Code](tools/claude-code.md),
  [Cursor](tools/cursor.md), [Codex](tools/codex.md)

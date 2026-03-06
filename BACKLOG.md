# Backlog

Deferred work items that are documented but not yet scheduled.

---

## Rename `CLAUDE_PLUGIN_ROOT` to a tool-agnostic name

**Why:** `CLAUDE_PLUGIN_ROOT` is a Claude-specific name, but this repo supports Claude Code, Cursor, Codex, and OpenCode. The variable name should reflect that.

**Candidate names:**
- `ECC_ROOT` — already used in `skills/configure-ecc/SKILL.md` for the install wizard
- `LLM_PLUGIN_ROOT` — more descriptive of intent but a new name everywhere

**Scope of change (all files must be updated in one coordinated pass):**

| File(s) | Usage | Notes |
|---------|-------|-------|
| `hooks/hooks.json` | Template token replaced at install time | 17 occurrences |
| `scripts/install-ecc.js:241` | Regex replace of the token during install | Must match new name |
| `commands/*.md` (5 files) | Runtime env var in example commands | instinct-status, instinct-import, evolve, promote, projects |
| `.opencode/commands/*.md` (4 files) | Same | |
| `skills/continuous-learning-v2/SKILL.md` | Runtime env var in examples | |
| `tests/hooks/hooks.test.js:943-955` | Test asserts the literal string exists | Test must be updated |
| `tests/integration/hooks.test.js` | Passes `CLAUDE_PLUGIN_ROOT` as env to hook runner | |
| `tests/helpers/hook-integration-test-utils.js` | Replaces token in test harness | |

**Key behaviour to preserve:**
- `hooks/hooks.json` tokens are replaced with an absolute path at install time — after install the literal token must NOT remain (asserted by `tests/scripts/install-ecc.test.js:116`)
- Commands show `${NEW_NAME}` as the preferred path with `~/.claude/skills/...` as a fallback

**Estimated effort:** Low — pure find-and-replace, no logic changes. Run tests after to verify.

---

## Replace hardcoded `~/.claude/` with tool-aware paths

**Why:** ECC supports multiple tools (Claude Code, Cursor, Codex, OpenCode). Config and data dirs are resolved by `scripts/lib/detect-env.js`: Cursor → `~/.cursor/`, Claude Code → `~/.claude/`, overridable via `CONFIG_DIR`/`DATA_DIR`. Documentation and examples that state `~/.claude/` only are incorrect for Cursor users and should say "config dir" / "data dir" or list both (e.g. `~/.cursor/` or `~/.claude/`).

**Excluded from this list:** README.md and install-ecc.js (explicit "Claude target" wording); detect-env.test.js (tests for Claude-specific behavior); validate-no-hardcoded-paths.js and validators-rounds-2 (validator rule text); docs/MIGRATION.md (tool list); skills/skill-stocktake/SKILL.md (already says `<config>` = ~/.cursor or ~/.claude).

**Scope — update or add note so paths are tool-aware:**

| File(s) | Lines / context | Note |
|---------|-----------------|------|
| **skills/configure-ecc/SKILL.md** | 22, 48, 54, 56, 213, 218–220, 228, 237, 314, 322–323 | Manual install path, TARGET examples, verification steps, continuous-learning-v2 homunculus note — use config dir or "~/.cursor or ~/.claude" |
| **rules/README.md** | 48, 51–52 | `cp` examples — use config dir or both paths |
| **BACKLOG.md** | 30 | Fallback path in "Key behaviour" — already in rename scope; use config-dir fallback |
| **skills/continuous-learning-v2/SKILL.md** | 29, 135, 141, 166, 175, 182, 195, 250, 312, 350–351 | Storage table, registry path, settings.json, manual install, mkdir, file structure, promote fallback, backward compat — use getDataDir/getConfigDir wording or "config/data dir" |
| **skills/continuous-learning-v2/agents/observer.md** | 20–21, 69–70 | Observation and instinct paths — use data dir (homunculus under it) |
| **commands/learn-eval.md** | 26 | Global learned path — config dir–relative |
| **.opencode/commands/projects.md** | 21 | Fallback node path — config dir or both |
| **.opencode/commands/promote.md** | 21 | Same |
| **.opencode/commands/evolve.md** | 21, 35–36 | Same + evolved dir paths |
| **.opencode/commands/instinct-status.md** | 21 | Fallback node path |
| **commands/projects.md** | 22, 33 | Fallback path + projects.json path |
| **commands/promote.md** | 22, 41 | Fallback path + instincts/personal path |
| **commands/evolve.md** | 20, 88–89 | Fallback path + evolved paths |
| **commands/instinct-import.md** | 20, 41–42, 111 | Fallback path + inherited paths + output example |
| **commands/instinct-status.md** | 22, 34–35 | Fallback path + instinct read paths |
| **the-shortform-guide.md** | 24–25, 29, 84, 107, 152, 377, 391 | Skills, commands, agents, rules, .claude.json, MCP — config dir or both |
| **the-security-guide.md** | 154, 157, 179, 216, 433, 464 | grep/scan paths, example path, audit.log — config dir or both |
| **the-longform-guide.md** | 68, 71, 74 | Alias examples (contexts under config) — config dir |
| **tests/scripts/node-runtime-scripts.test.js** | 88 | Fixture path in stdin — test-only; could use config dir or leave as Claude example with comment |
| **tests/lib/session-aliases*.js** | 5 (all three files) | Comment "the real ~/.claude/session-aliases.json" — clarify "config dir (e.g. ~/.claude or ~/.cursor)" |
| **skills/strategic-compact/SKILL.md** | 41, 49, 53, 86 | settings.json, hook command path, memory path — config dir |
| **skills/search-first/SKILL.md** | 70–71 | settings.json, skills path — config dir |
| **skills/iterative-retrieval/SKILL.md** | 211 | agents path — config dir |
| **skills/continuous-learning/config.json** | 5 | learned_skills_path default — config dir or document override |
| **skills/continuous-learning/SKILL.md** | 15, 25, 36, 64, 73 | learned path, settings, hook command — config dir |
| **skills/autonomous-loops/SKILL.md** | 118 | claw path — data dir (claw is under data in detect-env) |
| **scripts/setup-package-manager.js** | 18, 133 | --global message and saved path — getConfigDir() in code; doc/log only |
| **scripts/lib/package-manager.d.ts** | 63, 70 | JSDoc paths — "config dir (e.g. ~/.claude or ~/.cursor)" |
| **scripts/lib/session-manager.d.ts** | 3 | JSDoc — config dir |
| **scripts/lib/session-aliases.d.ts** | 3 | JSDoc — config dir |
| **scripts/lib/utils.d.ts** | 18, 21, 24 | getConfigDir / sessions / learned JSDoc — "config dir" or both |
| **scripts/lib/package-manager.js** | 156, 367 | JSDoc and error message — config dir |
| **scripts/lib/session-manager.js** | 5 | JSDoc — config dir |
| **rules/typescript/hooks.md** | 14 | Configure in settings — config dir |
| **rules/sql/hooks.md** | 12 | Same |
| **rules/rust/hooks.md** | 12 | Same |
| **rules/python/hooks.md** | 12 | Same |
| **rules/powershell/hooks.md** | 13 | Same |
| **rules/dotnet/hooks.md** | 14 | Same |
| **rules/common/performance.md** | 39 | settings path — config dir |
| **rules/common/hooks.md** | 15 | .claude.json — config file (tool-specific name) |
| **rules/common/git-workflow.md** | 12 | settings path — config dir |
| **rules/common/agents.md** | 5 | agents path — config dir |
| **rules/bash/hooks.md** | 12 | settings — config dir |
| **mcp-configs/mcp-servers.json** | 94 | usage string — config file (e.g. ~/.claude.json or Cursor equivalent) |
| **plugins/README.md** | 80 | plugins path — config dir |
| **hooks/README.md** | 53 | settings override — config dir |
| **examples/user-CLAUDE.md** | 3, 27, 44 | CLAUDE.md, rules, agents — config dir |
| **examples/statusline.json** | 17 | usage — config dir |
| **docs/token-optimization.md** | 13, 131 | settings paths — config dir |
| **commands/plan.md** | 113 | agents path — config dir |
| **commands/sessions.md** | 3, 84, 302–303 | sessions/aliases paths — config dir |
| **commands/setup-pm.md** | 34, 41 | package-manager.json — config dir |
| **commands/tdd.md** | 323, 326 | agents/skills paths — config dir |
| **commands/multi-workflow.md** | 39, 54, 75–77 | codeagent-wrapper path, .ccg prompts — Codex/Claude-specific; note or use config dir |
| **commands/multi-plan.md** | 25, 46–47, 123, 128, 148, 152 | Same |
| **commands/multi-frontend.md** | 35, 50, 68–70, 102, 116, 136 | Same |
| **commands/multi-execute.md** | 26 | codeagent-wrapper path — same |

**Suggested approach:** Prefer phrasing like "config directory (e.g. `~/.claude/` for Claude Code, `~/.cursor/` for Cursor)" or "`<config>/homunculus/` where `<config>` is from ECC's detect-env". For code that already uses `getConfigDir()`/`getDataDir()`, update only comments/JSDoc and user-facing messages.

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

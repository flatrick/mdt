# AI/LLM agent setup

**This is a fork of [Everything Claude Code](https://github.com/affaan-m/everything-claude-code).** It has been modified to use a Node-only runtime and installer; the original repo (plugin, guides, community) remains the upstream source.

Not just configs. A complete system: skills, agents, hooks, rules, and MCP configurations. Works with **Claude Code**, **Cursor**, **Codex**, and other AI agent harnesses.

---

## This fork

- **Node-only:** No Bash or PowerShell scripts. All install and hook logic is JavaScript run with Node.js.
- **Single installer:** `node scripts/install-ecc.js` installs to Claude Code, Cursor, or Codex (see Installation).
- **Per-tool installs:** Each tool gets its own directory — Claude → `~/.claude/`, Codex → `~/.codex/`, Cursor → project `.cursor/` or `~/.cursor/` with `--global`. Nothing points Cursor or Codex at `~/.claude/`.
- **Cursor:** Default is project-local (full rules, agents, skills, commands, hooks, MCP). Use `--global` to install to `~/.cursor/` (rules skipped there; Cursor does not support file-based rules globally).
- **Fork v1 direction:** Backwards compatibility with legacy passthrough behavior is not a goal; this fork prioritizes explicit, security-first defaults.

Reset or reinstall: [docs/MIGRATION.md](docs/MIGRATION.md).

---

## Guides (by original author)

Guides refer to the upstream project; this fork may differ. For this fork, prefer local docs first: [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md), and `docs/`.

| Topic | What you'll learn |
|-------|--------------------|
| Token Optimization | Model selection, system prompt slimming, background processes |
| Memory Persistence | Hooks that save/load context across sessions |
| Continuous Learning | Auto-extract patterns from sessions into reusable skills |
| Verification Loops | Checkpoint vs continuous evals, grader types, pass@k metrics |
| Parallelization | Git worktrees, cascade method, when to scale instances |
| Subagent Orchestration | The context problem, iterative retrieval pattern |

- **Shorthand Guide (start here):** [The Shorthand Guide to Everything Claude Code](https://x.com/affaanmustafa/status/2012378465664745795)
- **Longform Guide (advanced):** [The Longform Guide to Everything Claude Code](https://x.com/affaanmustafa/status/2014040193557471352)

---

## Quick Start

1. **Clone this repo**
   ```bash
   git clone https://github.com/flatrick/everything-claude-code.git
   cd everything-claude-code
   ```

2. **Install** (pick target and language)
   ```bash
   # Claude Code (default) — installs to ~/.claude/
   node scripts/install-ecc.js typescript

   # Cursor — project .cursor/ (or ~/.cursor/ with --global)
   node scripts/install-ecc.js --target cursor typescript

   # Codex — installs to ~/.codex/
   node scripts/install-ecc.js --target codex

   # Discover available targets/languages
   node scripts/install-ecc.js --list

   # Preview install without writing files
   node scripts/install-ecc.js --target cursor --global --dry-run typescript
   ```

3. **Use** commands and agents in your tool (e.g. `/plan`, `/tdd`, `/code-review`). Full layout: [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md).

For the official Claude Code plugin (marketplace install), use the [original repo](https://github.com/affaan-m/everything-claude-code).

---

## Installation

One installer for all targets:

```bash
node scripts/install-ecc.js [--target claude|cursor|codex] [--global] [--list] [--dry-run] [language ...]
```

| Target | Destination | Notes |
|--------|-------------|--------|
| `claude` (default) | `~/.claude/` | Rules, agents, commands, skills, hooks, scripts |
| `cursor` | `./.cursor/` or `~/.cursor/` | Use `--global` for user-level; then rules are skipped |
| `codex` | `~/.codex/` | config.toml + AGENTS.md (no language args) |

Examples:

```bash
node scripts/install-ecc.js typescript
node scripts/install-ecc.js --target cursor typescript python
node scripts/install-ecc.js --target cursor --global typescript
node scripts/install-ecc.js --target codex
node scripts/install-ecc.js --list
node scripts/install-ecc.js --target claude --dry-run typescript
```

- **Reset/reinstall:** [docs/MIGRATION.md](docs/MIGRATION.md)
- **Manual copy (rules only):** [rules/README.md](rules/README.md)

---

## What's inside

- `agents/` — Subagents (planner, code-reviewer, tdd-guide, security-reviewer, etc.)
- `skills/` — Workflow definitions (TDD, security-review, continuous-learning, etc.)
- `commands/` — Slash commands (/plan, /tdd, /e2e, /code-review, …)
- `rules/` — Common + language-specific rules (TypeScript, Python, …)
- `hooks/` — Hook config (hooks.json); implementations in `scripts/`
- `scripts/` — Node.js only (install-ecc.js, hooks, lib, detect-env)
- `.cursor/` — Cursor-ready config (rules, hooks, commands, mcp.json)
- `.codex/` — Codex config (config.toml, AGENTS.md)
- `tests/` — Test suite

Full layout and details: [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md).

---

## Cursor / Codex / OpenCode

**Cursor:** Configs in `.cursor/`. Quick start: `node scripts/install-ecc.js --target cursor typescript`. Local install gets rules, agents, skills, commands, hooks, and MCP. Use `--global` for `~/.cursor/` (rules not supported there by Cursor).

**Codex:** Config in `.codex/`. Quick start: `node scripts/install-ecc.js --target codex`. Installs config.toml and AGENTS.md to `~/.codex/`.

**OpenCode:** Config in `.opencode/`. See [.opencode/README.md](.opencode/README.md) for plugin install and feature parity in this fork.

---

## Key concepts

**Agents** are subagents (planner, code-reviewer, tdd-guide, …). **Skills** are workflow definitions. **Hooks** are Node scripts that run on tool events. **Rules** are common + language-specific guidelines. See [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md).

---

## Which agent to use

| I want to… | Command | Agent |
|------------|---------|--------|
| Plan a feature | `/plan "Add auth"` | planner |
| System architecture | `/plan` + architect | architect |
| Tests first | `/tdd` | tdd-guide |
| Review code | `/code-review` | code-reviewer |
| Fix build | `/build-fix` | build-error-resolver |
| E2E tests | `/e2e` | e2e-runner |
| Security audit | `/security-scan` | security-reviewer |
| Dead code | `/refactor-clean` | refactor-cleaner |
| Docs | `/update-docs` | doc-updater |
| Python review | `/python-review` | python-reviewer |
| DB queries | *(auto-delegated)* | database-reviewer |

**Workflows:** Plan → `/plan`; then `/tdd` for implementation; `/code-review` before merge. For production: `/security-scan`, `/e2e`, `/test-coverage`.

---

## FAQ

**How do I install?**  
Use `node scripts/install-ecc.js` with your language(s). Default target is Claude (`~/.claude/`). Use `--target cursor` or `--target codex` for the others. See [Installation](#installation).

**Does this work with Cursor / Codex?**  
Yes. Use `--target cursor` or `--target codex`. Each tool gets its own install directory; see [Cursor / Codex / OpenCode](#cursor--codex--opencode).

**Duplicate hooks / plugin.json?**  
Do not add a `"hooks"` field to `.claude-plugin/plugin.json`. Claude Code loads `hooks/hooks.json` by convention. See [upstream repo](https://github.com/affaan-m/everything-claude-code) for history (#29, #52, #103).

More: [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md), and `docs/`.

---

## Running tests

```bash
node tests/run-all.js
```

Profile-specific shortcuts:

```bash
npm run test:neutral
npm run test:claude
npm run test:cursor
npm run test:codex
npm run test:gemini
```

You can also set `ECC_TEST_ENV_PROFILE` when running the test runner directly:

```bash
ECC_TEST_ENV_PROFILE=cursor node tests/run-all.js
```

Equivalent direct CLI usage:

```bash
node tests/run-all.js --profile cursor
```

Valid profile values: `neutral`, `claude`, `cursor`, `codex`, `gemini`.

Single files: `node tests/lib/utils.test.js`, `node tests/hooks/hooks.test.js`, etc.

---

## Token optimization

See [docs/token-optimization.md](docs/token-optimization.md) for recommended settings and workflow (model, thinking tokens, compaction).

---

## Important notes

- **Customize:** Start with what fits your stack; add or remove rules/skills as needed.
- **Original author:** [@affaan-m](https://github.com/affaan-m). To support the original project: [GitHub Sponsors](https://github.com/sponsors/affaan-m).
- **Ecosystem:** Upstream has [ecc.tools](https://ecc.tools), [AgentShield](https://github.com/affaan-m/agentshield), Skill Creator, Plankton — see [original README](https://github.com/affaan-m/everything-claude-code).

---

## Links

- **Original project:** [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) — plugin, guides, community
- **Shorthand Guide:** [The Shorthand Guide to Everything Claude Code](https://x.com/affaanmustafa/status/2012378465664745795)
- **Longform Guide:** [The Longform Guide to Everything Claude Code](https://x.com/affaanmustafa/status/2014040193557471352)

---

## License

MIT. Original work by [@affaan-m](https://github.com/affaan-m); this fork maintained independently.

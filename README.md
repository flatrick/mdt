# ModelDev Toolkit

Generic model toolkit for software development workflows and scaffolding.
Not just configs. A complete system: skills, agents, hooks, rules, and MCP configurations.
Works with **Claude Code**, **Cursor**, **Codex**, and other AI agent harnesses.

## READ ME FIRST!

This started as merely a clone of [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) but my goal is to adjust this my own liking.

My first change was to turn this into a **NodeJS-only runtime and installer**; sticking to one language that is truly cross-platform was my first goal.
The original is, at the time of writing this (2026-03-07), using NodeJS, Bash-scripts and Python.

The second goal is to steer away from being all about Claude Code as the primary LLM-tool, and instead aim for a generic toolkit that will hopefully work well for all/most alternatives.

**2026-03-07 I'm still under heavy development with this, so things are likely to break often until I can begin working on stabilizing everything.**

### This fork

- **Node-only:** No Bash or PowerShell scripts. All install and hook logic is JavaScript run with Node.js.
- **Single installer:** `node scripts/install-mdt.js` installs to Claude Code, Cursor, or Codex (see Installation).
- **Per-tool installs:** Each tool gets its own directory — Claude → `~/.claude/`, Codex → `~/.codex/`, Cursor → project `.cursor/` or `~/.cursor/` with `--global`. Nothing points Cursor or Codex at `~/.claude/`.
- **Cursor:** Default is project-local (full rules, agents, skills, commands, hooks, MCP). Use `--global` to install to `~/.cursor/` (rules skipped there; Cursor does not support file-based rules globally).
- **Fork v1 direction:** Backwards compatibility with legacy passthrough behavior is not a goal; this fork prioritizes explicit, security-first defaults.

Reset or reinstall: [docs/MIGRATION.md](docs/MIGRATION.md).
Rename tracking for upstream sync: [docs/upstream-rename-map.md](docs/upstream-rename-map.md).

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

- **Shorthand Guide (start here):** [The Shorthand Guide to ModelDev Toolkit](https://x.com/affaanmustafa/status/2012378465664745795)
- **Longform Guide (advanced):** [The Longform Guide to ModelDev Toolkit](https://x.com/affaanmustafa/status/2014040193557471352)

---

## Quick Start

1. **Clone this repo**
   ```bash
   git clone https://github.com/flatrick/modeldev-toolkit.git
   cd modeldev-toolkit
   ```

2. **Install** (pick target and language)
   ```bash
   # Claude Code (default) — installs to ~/.claude/
   node scripts/install-mdt.js typescript

   # Cursor — project .cursor/ (or ~/.cursor/ with --global)
   node scripts/install-mdt.js --target cursor typescript

   # Codex — installs to ~/.codex/
   node scripts/install-mdt.js --target codex

   # Discover available targets/languages
   node scripts/install-mdt.js --list

   # Preview install without writing files
   node scripts/install-mdt.js --target cursor --global --dry-run typescript
   ```

3. **Use** commands and agents in your tool (e.g. `/plan`, `/tdd`, `/code-review`). Full layout: [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md).

**NOTE 2026-03-07 I don't think I'll bother with this for a while, but I'll leave this section to not forget about it END NOTE**
For the official Claude Code plugin (marketplace install), use the [original repo](https://github.com/affaan-m/modeldev-toolkit).

---

## Installation

One installer for all targets:

```bash
node scripts/install-mdt.js [--target claude|cursor|codex] [--global] [--list] [--dry-run] [language ...]
```

```bash
npx mdt-install typescript
```

| Target | Destination | Notes |
|--------|-------------|--------|
| `claude` (default) | `~/.claude/` | Rules, agents, commands, skills, hooks, scripts |
| `cursor` | `./.cursor/` or `~/.cursor/` | Use `--global` for user-level; then rules are skipped |
| `codex` | `~/.codex/` | config.toml + AGENTS.md (no language args) |

Examples:

```bash
node scripts/install-mdt.js typescript
node scripts/install-mdt.js --target cursor typescript python
node scripts/install-mdt.js --target cursor --global typescript
node scripts/install-mdt.js --target codex
node scripts/install-mdt.js --list
node scripts/install-mdt.js --target claude --dry-run typescript
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
- `scripts/` — Node.js only (install-mdt.js, hooks, lib, detect-env)
- `.cursor/` — Cursor-ready config (rules, hooks, commands, mcp.json)
- `.codex/` — Codex config (config.toml, AGENTS.md)
- `tests/` — Test suite

Full layout and details: [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md).

---

## Cursor / Codex / OpenCode

**Cursor:** Configs in `.cursor/`. Quick start: `node scripts/install-mdt.js --target cursor typescript`. Local install gets rules, agents, skills, commands, hooks, and MCP. Use `--global` for `~/.cursor/` (rules not supported there by Cursor).

**Codex:** Config in `.codex/`. Quick start: `node scripts/install-mdt.js --target codex`. Installs config.toml and AGENTS.md to `~/.codex/`.

**OpenCode:** Config in `.opencode/`. See [.opencode/README.md](.opencode/README.md) for plugin install and feature parity in this fork.

---

## Key concepts

- **Agents** are subagents (planner, code-reviewer, tdd-guide, …).
- **Skills** are workflow definitions.
- **Hooks** are Node scripts that run on tool events.
- **Rules** are common + language-specific guidelines.

See [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md).

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

**Workflows:**
- Plan → `/plan`; then `/tdd` for implementation; `/code-review` before merge.
- For production: `/security-scan`, `/e2e`, `/test-coverage`.

---

## FAQ

### How do I install?

Use `node scripts/install-mdt.js` with your language(s).
Default target is Claude (`~/.claude/`).
Use `--target cursor` or `--target codex` for the others.

See [Installation](#installation).

### Does this work with Cursor / Codex?

Yes, use `--target cursor` or `--target codex`.

Each tool gets its own install directory; see [Cursor / Codex / OpenCode](#cursor--codex--opencode).

### Duplicate hooks / plugin.json?

Do not add a `"hooks"` field to `.claude-plugin/plugin.json`.
Claude Code loads `hooks/hooks.json` by convention.
See [upstream repo](https://github.com/affaan-m/modeldev-toolkit) for history (#29, #52, #103).

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

You can also set `MDT_TEST_ENV_PROFILE` when running the test runner directly:

```bash
MDT_TEST_ENV_PROFILE=cursor node tests/run-all.js
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
- **Ecosystem:** Upstream has AgentShield, Skill Creator, and Plankton — see [original README](https://github.com/affaan-m/modeldev-toolkit).

---

## Links

- **Original project:** [Everything Claude Code](https://github.com/affaan-m/modeldev-toolkit) — plugin, guides, community
- **Shorthand Guide:** [The Shorthand Guide to ModelDev Toolkit](https://x.com/affaanmustafa/status/2012378465664745795)
- **Longform Guide:** [The Longform Guide to ModelDev Toolkit](https://x.com/affaanmustafa/status/2014040193557471352)

---

## License

MIT. Original work by [@affaan-m](https://github.com/affaan-m); this fork maintained independently.

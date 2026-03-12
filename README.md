# ModelDev Toolkit

<!-- Current tool: Cursor -->

Generic model toolkit for software development workflows and scaffolding.
Not just configs. MDT ships skills, agents, hooks, rules, commands, and per-tool install adapters.

## READ ME FIRST!

This fork started from [Everything Claude Code](https://github.com/affaan-m/everything-claude-code), then diverged into a Node-only, multi-tool workflow toolkit under the **ModelDev Toolkit (MDT)** name.

My first change was to turn this into a **NodeJS-only runtime and installer**; sticking to one language that is truly cross-platform was my first goal.
The original is, at the time of writing this (2026-03-07), using NodeJS, Bash-scripts and Python.

The second goal is to steer away from being all about Claude Code as the primary LLM-tool, and instead aim for a generic toolkit that will hopefully work well for all/most alternatives.

**2026-03-09 status:** the template-source/runtime-dir migration is complete. Current work is v1 stabilization: installer contracts, package manifests, tool parity, and verified docs.

### This fork

- **Node-only:** No Bash or PowerShell scripts. All install and hook logic is JavaScript run with Node.js.
- **Single installer:** `node scripts/install-mdt.js` installs to Claude Code, Cursor, Codex, or Gemini.
- **Per-tool installs:** each tool has its own install surfaces; see [Installation](docs/INSTALLATION.md).
- **Docs-first:** detailed capability and install claims live under [docs/](docs/), especially [docs/supported-tools.md](docs/supported-tools.md) and [docs/tools/](docs/tools/).
- **Fork v1 direction:** Backwards compatibility with legacy passthrough behavior is not a goal; this fork prioritizes explicit, security-first defaults.

Reset or reinstall: [docs/MIGRATION.md](docs/MIGRATION.md)  
Install reference: [docs/INSTALLATION.md](docs/INSTALLATION.md)  
Supported tools: [docs/supported-tools.md](docs/supported-tools.md)  
Rename tracking for upstream sync: [docs/upstream-rename-map.md](docs/upstream-rename-map.md)

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

- **Upstream shorthand guide:** [Affaan's shorthand guide for Everything Claude Code](https://x.com/affaanmustafa/status/2012378465664745795)
- **Upstream longform guide:** [Affaan's longform guide for Everything Claude Code](https://x.com/affaanmustafa/status/2014040193557471352)

---

## Quick Start

1. **Clone this repo**
   ```bash
   git clone https://github.com/flatrick/modeldev-toolkit.git
   cd modeldev-toolkit
   ```

2. **Install** (pick target and package set)
   ```bash
   # Claude Code
   node scripts/install-mdt.js typescript

   # Cursor global install (always install to ~/.cursor/)
   node scripts/install-mdt.js --target cursor typescript

   # Cursor IDE repo-local rules bridge (additional step when needed)
   # Preferred inside Cursor after install: /install-rules
   node scripts/materialize-mdt-local.js --target cursor --surface rules

   # Codex
   node scripts/install-mdt.js --target codex typescript continuous-learning

   # Discover available targets/packages
   node scripts/install-mdt.js --list

   # Preview install without writing files
   node scripts/install-mdt.js --target cursor --dry-run typescript
   ```

3. **Verify** with:
   ```bash
   node scripts/verify-tool-setups.js
   node scripts/smoke-tool-setups.js
   ```

Marketplace/plugin support remains secondary in this fork for now. For the official upstream Claude Code plugin flow, use the [original repo](https://github.com/affaan-m/modeldev-toolkit).

Cursor note, last locally true `2026-03-12`: always install MDT for Cursor into the global `~/.cursor/` directory, even if the user only plans to use Cursor IDE today. That global install remains the shared MDT install surface and may be consumed by more Cursor surfaces in the future. If the user also wants repo-local `.cursor/rules/` files for Cursor IDE, use the installed Cursor custom command `/install-rules` or run `materialize-mdt-local.js --target cursor --surface rules` as an additional bridge step. The bridge command copies the rules currently installed under `~/.cursor/rules/` into the opened repo's `.cursor/rules/`.

---

## Documentation

Use these as the current source of truth:

- [docs/INSTALLATION.md](docs/INSTALLATION.md) for install targets, package examples, and the global-only install contract
- [docs/supported-tools.md](docs/supported-tools.md) for audited tool capability status
- [docs/tools/README.md](docs/tools/README.md) for the tool docs pack
- [docs/V1-TARGET-STATE.md](docs/V1-TARGET-STATE.md) for the intended end state by `v1.0.0`
- [docs/testing/manual-verification/README.md](docs/testing/manual-verification/README.md) for manual runtime checks
- [docs/MIGRATION.md](docs/MIGRATION.md) for reset/reinstall policy
- [NEXT-STEPS.md](NEXT-STEPS.md) for active roadmap items
- [BACKLOG.md](BACKLOG.md) for deferred future work tracked in-repo until `v1.0.0`
- [docs/history/](docs/history/) for completed work that has been moved out of the backlog

---

## What's inside

- `agents/` — Subagents (planner, code-reviewer, tdd-guide, security-reviewer, etc.)
- `skills/` — Workflow definitions (TDD, security-review, continuous-learning-manual, etc.)
- `commands/` — Slash commands (/plan, /tdd, /e2e, /code-review, …)
- `rules/` — Common + language-specific rules (TypeScript, Python, …)
- `hooks/` — Hook mirrors and shared hook docs; `hooks/hooks.json` remains the Claude-facing mirror
- `claude-template/` — Claude-specific source templates such as hook config rendered into `.claude/`
- `scripts/` — Node.js only (install-mdt.js, hooks, lib, detect-env, sync-hook-mirrors.js)
- `cursor-template/` — Cursor source templates (rules, hooks, skills, and config files rendered into `.cursor/` on install)
- `codex-template/` — Codex source templates (`config.toml`, `AGENTS.md`, `skills/`) rendered into `~/.codex/`, with MDT-owned runtime/state under `~/.codex/mdt/`
- `tests/` — Test suite

Full layout and detailed tool behavior: [docs/](docs/), [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md).

---

## Tool Notes

- Cursor details: [docs/tools/cursor.md](docs/tools/cursor.md)
- Codex details: [docs/tools/codex.md](docs/tools/codex.md)
- Claude Code details: [docs/tools/claude-code.md](docs/tools/claude-code.md)

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

Use `node scripts/install-mdt.js` with package names such as `typescript` or `continuous-learning`.

See [docs/INSTALLATION.md](docs/INSTALLATION.md).

### Does this work with Cursor / Codex?

Yes, but the install surfaces differ by tool.

See:
- [docs/tools/cursor.md](docs/tools/cursor.md)
- [docs/tools/codex.md](docs/tools/codex.md)
- [docs/supported-tools.md](docs/supported-tools.md)

### Duplicate hooks / plugin.json?

Do not add a `"hooks"` field to `.claude-plugin/plugin.json`.
Claude Code loads `hooks/hooks.json` by convention. Edit `claude-template/hooks.json` and sync mirrors with `node scripts/sync-hook-mirrors.js`.
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

- **Original project:** [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) — plugin, guides, community
- **Upstream shorthand guide:** [Affaan's shorthand guide for Everything Claude Code](https://x.com/affaanmustafa/status/2012378465664745795)
- **Upstream longform guide:** [Affaan's longform guide for Everything Claude Code](https://x.com/affaanmustafa/status/2014040193557471352)

---

## License

MIT. Original work by [@affaan-m](https://github.com/affaan-m); this fork maintained independently.

---
name: ai-learning
description: Instinct-based learning system that adapts to the environment: hooks-passive observation for Claude/Cursor, explicit capture for hook-free tools. Single unified surface for all tools.
version: 2.1.0

---

# AI Learning v2.1 - Instinct-Based Architecture

An advanced learning system that turns MDT tool sessions into reusable knowledge through atomic "instincts" — small learned behaviors with confidence scoring, project scoping, and optional evolution into full skills, commands, and agents.

**v2.1** adds **project-scoped instincts** so React patterns stay in your React project, Python conventions stay in your Python project, and universal patterns (like "always validate input") can be shared globally.

## When to Activate

- Setting up learning from Claude Code or Cursor sessions (hook-based)
- Running explicit capture and analysis passes (Codex or hook-free tools)
- Reviewing or managing instinct confidence, scope, export, import, or promotion
- Running weekly retrospectives to find automation candidates
- Evolving instincts into full skills, commands, or agents

## Tool Modes

The instinct model and storage are shared across all tools. Capture and analysis differ by environment.

### Claude / Cursor (hooks available)

- The observe hook (`skills/ai-learning/hooks/observe.js`) captures every PreToolUse and PostToolUse event passively — 100% deterministic, no patterns missed
- The background observer runs every 5 minutes (configurable) and analyzes accumulated observations
- Running `/learn` or `mdt learning analyze` triggers immediate analysis on demand
- Observer is **ON by default** (`observer.enabled: true` in `config.json`)
- Set `observer.enabled: false` to opt out
- For Claude/Cursor, do **not** use `instinct-cli.js` for `capture` or `analyze` because that CLI only supports instinct management actions such as `status`, `projects`, `evolve`, `export`, `import`, and `promote`
- For a normal analysis pass, do **not** write instinct markdown files directly; run the learning workflow so observations are analyzed through the supported runtime

### Codex / hook-free tools

- No passive hook capture; observation is explicit and manual
- Use `mdt learning capture < summary.txt` to feed in a session summary
- Use `mdt learning analyze` to run an analysis pass on whatever has been captured
- Weekly retrospectives (`mdt learning retrospective weekly`) are part of the recommended baseline
- External observer is optional and **OFF by default** for hook-free environments

### All environments

These commands work identically regardless of tool:

`/ai-learning`, `/learn`, `/learn-eval`, `/instinct-status`, `/evolve`, `/instinct-export`, `/instinct-import`, `/promote`, `/projects`

## Command Routing Rules

Use the correct entrypoint for the requested action:

- `status`, `projects`, `evolve`, `export`, `import`, `promote` → `skills/ai-learning/scripts/instinct-cli.js`
- `learning status`, `learning capture`, `learning analyze`, `learning retrospective weekly`, `learning observer ...` → `mdt/scripts/mdt.js`

If the user asks to "review instincts and run an analysis pass" in Claude/Cursor:

1. Run `instinct-cli.js status`
2. Optionally run `instinct-cli.js projects` if project context is relevant
3. Run `mdt.js learning analyze`
4. Summarize the results instead of synthesizing instincts by hand

## The Instinct Model

An instinct is a small learned behavior:

```yaml
---
id: prefer-functional-style
trigger: "when writing new functions"
confidence: 0.7
domain: "code-style"
source: "session-observation"
scope: project
project_id: "my-react-app-a1b2c3d4"
project_name: "my-react-app"
---

# Prefer Functional Style

## Action
Use functional patterns over classes when appropriate.

## Evidence
- Observed 5 instances of functional pattern preference
- User corrected class-based approach to functional on 2025-01-15
```

Properties:

- **Atomic** — one trigger, one action
- **Confidence-weighted** — `0.3` = tentative, `0.9` = near certain
- **Domain-tagged** — code-style, testing, git, debugging, workflow, etc.
- **Evidence-backed** — tracks what observations created it
- **Scope-aware** — `project` (default) or `global`

## How It Works

```
Session activity
      |
      | Capture path depends on tool:
      | - Claude/Cursor: observe hook captures every tool call (passive)
      | - Codex/hook-free: mdt learning capture < summary.txt (explicit)
      v
<project-id>/observations.jsonl
      |
      | Observer (background, cheap model) or explicit mdt learning analyze
      v
pattern detection
      |
      | creates / updates
      v
<project-id>/instincts/personal/
instincts/personal/ (global)
      |
      | /evolve + /promote
      v
<project-id>/evolved/
evolved/ (global)
```

## Project Detection

The system detects project context in this order:

1. Explicit project/config environment variables such as `CLAUDE_PROJECT_DIR` or tool-agnostic `MDT_PROJECT_ROOT`
2. `git remote get-url origin` when available — the remote URL becomes the stable project identity anchor
3. `git rev-parse --show-toplevel` — fallback using the local git repo root when no remote is available
4. cwd-scoped fallback when no git-backed project can be identified

Project IDs:

- **Remote available** → `<repo-name>-git` — stable across re-clones of the same origin
- **Git repo, no remote** → `<basename>-<md5(path)>` — path-anchored local fallback
- **No git project** → `<basename>-<md5(path)>` using the current cwd

A registry file at `<data>/homunculus/projects.json` maps project IDs to human-readable names, roots, and remotes. Each project stores its own state under `<data>/homunculus/<project-id>/`.

## Quick Start

### 1. Enable Observation Hooks (Claude / Cursor only)

Add hook wiring to your tool config. For Claude Code this is typically `~/.claude/settings.json`.

**If installed as a plugin** (recommended):

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node \"${MDT_ROOT}/skills/ai-learning/hooks/observe.js\" pre"
      }]
    }],
    "PostToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node \"${MDT_ROOT}/skills/ai-learning/hooks/observe.js\" post"
      }]
    }]
  }
}
```

**If installed manually** to `<config>/skills`:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node <config>/skills/ai-learning/hooks/observe.js pre"
      }]
    }],
    "PostToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node <config>/skills/ai-learning/hooks/observe.js post"
      }]
    }]
  }
}
```

The observer starts automatically after hooks are wired and enough observations accumulate.

### 2. Explicit Capture (Codex / hook-free tools)

```bash
mdt learning status
mdt learning capture < summary.txt
mdt learning analyze
mdt learning retrospective weekly --week 2026-W11
```

If `mdt` is not on `PATH`:

```bash
node ~/.codex/mdt/scripts/mdt.js learning status
node ~/.codex/mdt/scripts/mdt.js learning capture < summary.txt
node ~/.codex/mdt/scripts/mdt.js learning analyze
node ~/.codex/mdt/scripts/mdt.js learning retrospective weekly --week 2026-W11
```

### 3. Use the Instinct Commands

```bash
/instinct-status     # Show learned instincts (project + global)
/evolve              # Cluster related instincts into skills/commands
/instinct-export     # Export instincts to file
/instinct-import     # Import instincts from others
/promote             # Promote project instincts to global scope
/projects            # List all known projects and their instinct counts
```

## Commands

| Command | Description |
|---------|-------------|
| `/ai-learning` | Review instinct status and run the supported ai-learning workflow |
| `/instinct-status` | Show all instincts (project-scoped + global) with confidence |
| `/evolve` | Cluster related instincts into skills/commands, suggest promotions |
| `/instinct-export` | Export instincts (filterable by scope/domain) |
| `/instinct-import <file>` | Import instincts with scope control |
| `/promote [id]` | Promote project instincts to global scope |
| `/projects` | List all known projects and their instinct counts |

## Configuration

`config.json` ships with `observer.enabled: true` — the right default for Claude/Cursor installs where hooks are available. For hook-free environments, set `enabled: false`.

```json
{
  "version": "2.1",
  "observer": {
    "enabled": true,
    "run_interval_minutes": 5,
    "min_observations_to_analyze": 20,
    "tool": null,
    "models": {
      "claude": "haiku",
      "cursor": "auto"
    },
    "commands": {
      "claude": "claude",
      "cursor": "agent"
    }
  }
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `observer.enabled` | `true` | Enable the background observer. Set `false` to opt out (Claude/Cursor) or as the default for hook-free tools |
| `observer.run_interval_minutes` | `5` | How often the observer analyzes observations |
| `observer.min_observations_to_analyze` | `20` | Minimum observations before analysis runs |
| `observer.tool` | `null` | Force a specific native observer runner (`claude` or `cursor`); otherwise inferred from environment |
| `observer.models.claude` | `haiku` | Claude observer model preference |
| `observer.models.cursor` | `auto` | Cursor observer model preference |
| `observer.commands.*` | tool default | Override the native CLI command used for each tool |

All scripts are Node.js (`.js`). Same commands work on Windows, macOS, and Linux. The observer must use the active tool's native CLI — Claude setups must not depend on Cursor, and Cursor setups must not depend on the `claude` binary.

## Generated Candidates vs Live Skills

- `homunculus/` stores instincts, evidence, evolution outputs, and project-scoped learning state
- `<data>/generated/skills/learned/` is MDT-owned staging for candidate/generated skills
- `<config>/skills/` is the live tool-facing skill directory

Promotion/materialization is the boundary between MDT-owned staging and the live tool-facing skill surface. Until a generated skill is explicitly approved, it stays under MDT-owned state.

## Weekly Retrospectives

Weekly retrospectives are intentionally low-noise. The goal is to surface:

- repeated shell commands that should become scripts or custom commands
- repeated external CLI usage that may justify MCP integrations
- repeated multi-step workflows that should be documented or automated
- repeated file hotspots that suggest missing helpers

Retrospective data is stored at:

```text
<data>/homunculus/<project-id>/retrospectives/weekly/YYYY-Www.json
```

## File Structure

```text
<data>/
+-- homunculus/
|   +-- identity.json
|   +-- projects.json
|   +-- observations.jsonl      (global fallback)
|   +-- instincts/
|   |   +-- personal/           (global auto-learned instincts)
|   |   +-- inherited/          (global imported instincts)
|   +-- evolved/
|   |   +-- agents/
|   |   +-- skills/
|   |   +-- commands/
|   +-- projects/
|       +-- <project-id>/
|       |   +-- observations.jsonl
|       |   +-- observations.archive/
|       |   +-- instincts/
|       |   |   +-- personal/
|       |   |   +-- inherited/
|       |   +-- evolved/
|       |       +-- skills/
|       |       +-- commands/
|       |       +-- agents/
|       +-- <another-project-id>/
|           +-- ...
+-- generated/
    +-- skills/
        +-- learned/
```

## Scope Decision Guide

| Pattern Type | Scope | Examples |
|-------------|-------|---------|
| Language/framework conventions | **project** | "Use React hooks", "Follow Django REST patterns" |
| File structure preferences | **project** | "Tests in `__tests__/`", "Components in src/components/" |
| Code style | **project** | "Use functional style", "Prefer dataclasses" |
| Error handling strategies | **project** | "Use Result type for errors" |
| Security practices | **global** | "Validate user input", "Sanitize SQL" |
| General best practices | **global** | "Write tests first", "Always handle errors" |
| Tool workflow preferences | **global** | "Grep before Edit", "Read before Write" |
| Git practices | **global** | "Conventional commits", "Small focused commits" |

When in doubt, default to `scope: project` — safer to be project-specific and promote later than to contaminate the global space.

## Instinct Promotion

Project instincts can be promoted to global scope when the same pattern appears in multiple projects with strong confidence.

**Auto-promotion criteria:**
- Same instinct ID in 2+ projects
- Average confidence >= 0.8

```bash
# Promote a specific instinct
node "${MDT_ROOT}/skills/ai-learning/scripts/instinct-cli.js" promote prefer-explicit-errors

# Auto-promote all qualifying instincts
node "${MDT_ROOT}/skills/ai-learning/scripts/instinct-cli.js" promote

# Preview without changes
node "${MDT_ROOT}/skills/ai-learning/scripts/instinct-cli.js" promote --dry-run
```

For manual installs, replace `<config>` with your MDT config directory:

```bash
node "<config>/skills/ai-learning/scripts/instinct-cli.js" promote
```

The `/evolve` command also surfaces promotion candidates.

## Confidence Scoring

| Score | Meaning | Behavior |
|-------|---------|----------|
| 0.3 | Tentative | Suggested but not enforced |
| 0.5 | Moderate | Applied when relevant |
| 0.7 | Strong | Auto-approved for application |
| 0.9 | Near-certain | Core behavior |

**Confidence increases** when the pattern is repeatedly observed, the user doesn't correct the behavior, or similar instincts from other sources agree.

**Confidence decreases** when the user explicitly corrects the behavior, the pattern isn't observed for extended periods, or contradicting evidence appears.

## Why Hooks vs Skills for Observation?

Hooks fire **100% of the time**, deterministically. Skills fire ~50-80% of the time based on the model's judgment. For Claude/Cursor, this means every tool call is observed and no patterns are missed. For hook-free tools, explicit capture with `mdt learning capture` fills the same role at the cost of requiring manual input.

## Backward Compatibility

v2.1 is fully compatible with v2.0 and v1:
- Existing global instincts in `<data>/homunculus/instincts/` continue to work as global instincts
- Existing learned candidate skills in `<data>/generated/skills/learned/` are unaffected
- Legacy hook-oriented flows remain relevant for Claude Code and Cursor

## Privacy

- Observations stay **local** on your machine
- Project-scoped instincts are isolated per project
- Only **instincts** (patterns) can be exported — not raw observations
- No actual code or conversation content is shared
- You control what gets exported and promoted

## Related

- [Skill Creator](https://skill-creator.app) - Generate instincts from repo history
- Homunculus - Community project that inspired the v2 instinct-based architecture
- [The Longform Guide](https://x.com/affaanmustafa/status/2014040193557471352) - Continuous learning section

---

*Instinct-based learning: teaching your tools your patterns, one project at a time.*

---
name: continuous-learning-manual
description: Instinct-based learning system that turns explicit session summaries, optional tool observations, and retrospectives into reusable instincts, skills, commands, and agents. v2.1 adds project-scoped instincts to prevent cross-project contamination.
version: 2.1.0

---

# Continuous Learning v2.1

An instinct-based learning system for MDT that turns repeated behavior into small reusable instincts with confidence scoring, project scoping, and optional evolution into larger assets.

`v2.1` adds project-scoped instincts so project-specific patterns stay local while broader workflow and security patterns can still be shared globally.

## When To Activate

- Reviewing or capturing reusable workflow patterns
- Running explicit Codex learning passes
- Setting up Claude Code or Cursor observation hooks
- Reviewing instinct confidence, scope, export, import, or promotion
- Running weekly retrospectives to find automation candidates
- Deciding whether repeated work should become a skill, command, script, or MCP-backed integration

## Tool Modes

This skill supports different tool modes. The instinct model is shared, but capture and analysis differ by tool.

### Codex

Codex is manual-first in this repo.

- global MDT state lives under `~/.codex/mdt/homunculus/`
- explicit/manual capture is the baseline
- explicit/manual analysis is the baseline
- weekly retrospectives are part of the baseline
- the optional external observer only automates background analysis after observations already exist
- Codex does not currently get hook-style automatic capture in this repo

Use `continuous-learning-manual` as the Codex-facing contract.

### Claude Code and Cursor

Claude Code and Cursor are the hook-capable modes.

- they can capture observations via tool hooks
- they can use the optional observer with the tool's native CLI
- hook setup is specific to those tools and is not the general model for Codex

### Optional Observer

The observer is an enhancement layer, not the baseline.

- for Claude Code and Cursor, it processes hook-captured observations
- for Codex, it is analysis-only and remains optional
- it does not create automatic capture parity where native hook surfaces do not exist

## What's New in v2.1

| Feature | v2.0 | v2.1 |
|---------|------|------|
| Storage | Global (`<data>/homunculus/`) | Project-scoped (`<project-id>/` under homunculus) |
| Scope | All instincts apply everywhere | Project-scoped + global |
| Detection | None | git remote URL / repo path |
| Promotion | N/A | Project -> global when seen in 2+ projects |
| Commands | 4 (status/evolve/export/import) | 6 (+promote/projects) |
| Cross-project | Contamination risk | Isolated by default |

## What's New In v2

v2 introduced:

- instinct-sized learning units instead of only full learned assets
- confidence-weighted evidence
- observer-assisted analysis where the active tool supports it
- project-aware storage and evolution paths

The exact observation path is tool-specific:

- Claude Code / Cursor: hook-capable observation
- Codex: explicit/manual capture by default

Generated skill artifacts should be treated as a separate concern from instincts.

- candidate/generated skills belong under `<data>/generated/skills/learned/`
- live/promoted skills belong under the tool-facing skill surface such as `<config>/skills/`
- do not treat MDT-owned generated candidates as already-promoted live skills

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

- atomic: one trigger, one action
- confidence-weighted: `0.3` = tentative, `0.9` = near certain
- domain-tagged: code-style, testing, git, debugging, workflow, etc.
- evidence-backed: tracks what observations created it
- scope-aware: `project` or `global`

## Shared Learning Flow

The storage and instinct model are shared even though capture differs by tool.

```text
Session activity
      |
      | Capture path depends on tool:
      | - Codex: explicit/manual capture
      | - Claude/Cursor: hook-capable capture
      v
<project-id>/observations.jsonl
      |
      | optional observer or explicit analysis
      v
pattern detection
      |
      | creates / updates
      v
<project-id>/instincts/personal/
instincts/personal/ (global)
      |
      | evolve / promote
      v
<project-id>/evolved/
evolved/ (global)
```

## Project Detection

The system detects project context in this order:

1. explicit project/config environment variables such as `CLAUDE_PROJECT_DIR` or tool-agnostic `MDT_PROJECT_ROOT`
2. git remote URL when available
3. git repo root fallback when no remote is available
4. cwd-scoped fallback when no git-backed project can be identified

Project IDs use the current runtime contract:

- **Remote available** → `<repo-name>-git` — stable across re-clones of the same origin
- **Git repo, no remote** → `<basename>-<md5(path)>` — path-anchored local fallback
- **No git project** → `<basename>-<md5(path)>` using the current cwd instead of collapsing into a global project

Only git is currently detected; other VCS systems are in the backlog. A registry file at `<data>/homunculus/projects.json` maps IDs to absolute paths, remotes, and human-readable names, while each project stores its own state under `<data>/homunculus/<project-id>/`.

## Quick Start

### Codex Explicit Workflow

Codex does not rely on Claude/Cursor hook capture in this repo.

Use the explicit `mdt` workflow:

```bash
mdt learning status
```

Then capture a concise session summary:

```bash
mdt learning capture < summary.txt
```

Run an explicit analysis pass:

```bash
mdt learning analyze
```

Run a weekly retrospective for one ISO week:

```bash
mdt learning retrospective weekly --week 2026-W11
```

This writes Codex project learning state under `~/.codex/mdt/homunculus/<project-id>/...`.

Installed Codex-root equivalent if `mdt` is not on `PATH`:

```bash
node ~/.codex/mdt/scripts/mdt.js learning status
node ~/.codex/mdt/scripts/mdt.js learning capture < summary.txt
node ~/.codex/mdt/scripts/mdt.js learning analyze
node ~/.codex/mdt/scripts/mdt.js learning retrospective weekly --week 2026-W11
```

Codex baseline:

- sparse, explicit capture
- explicit/manual analysis
- explicit weekly retrospectives
- optional external observer for background analysis only

### Claude Code / Cursor Hook Setup

This section applies only to Claude Code and Cursor.

Add hook wiring to the relevant tool config. For Claude Code this is typically `~/.claude/settings.json`.

The hook surface lives in `continuous-learning-automatic`, not in this manual skill.

If installed as a plugin:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node \"${MDT_ROOT}/skills/continuous-learning-automatic/hooks/observe.js\" pre"
      }]
    }],
    "PostToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node \"${MDT_ROOT}/skills/continuous-learning-automatic/hooks/observe.js\" post"
      }]
    }]
  }
}
```

If installed manually to `<config>/skills` where `<config>` is the tool config dir:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node <config>/skills/continuous-learning-automatic/hooks/observe.js pre"
      }]
    }],
    "PostToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node <config>/skills/continuous-learning-automatic/hooks/observe.js post"
      }]
    }]
  }
}
```

## Commands And Workflows

The instinct workflows are:

- `status`
- `evolve`
- `export`
- `import`
- `promote`
- `projects`
- `weekly`

Tool surface differs:

- Codex: explicit script/workflow entrypoints
- Claude/Cursor: tool commands plus hook-captured observations where supported

## Configuration

Edit `config.json` to control the optional observer:

```json
{
  "version": "2.1",
  "observer": {
    "enabled": false,
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
| `observer.enabled` | `false` | Enable the background observer agent |
| `observer.run_interval_minutes` | `5` | How often the observer analyzes observations |
| `observer.min_observations_to_analyze` | `20` | Minimum observations before analysis runs |
| `observer.tool` | `null` | Force a specific native observer runner where supported |
| `observer.models.claude` | `haiku` | Claude observer model preference |
| `observer.models.cursor` | `auto` | Cursor observer model preference |
| `observer.commands.*` | tool default | Override the native CLI command for supported observer runners |

Notes:

- all scripts are Node.js `.js`
- Claude setups must not depend on Cursor
- Cursor setups must not depend on Claude
- Codex observer support is a separate opt-in layer, not the baseline

## Generated Candidates vs Live Skills

Continuous learning can eventually produce skill-like artifacts, but they are not all equal.

- `homunculus/` stores instincts, evidence, evolution outputs, and project-scoped learning state
- `<data>/generated/skills/learned/` is MDT-owned staging for candidate/generated skills
- `<config>/skills/` is the live tool-facing skill directory

Promotion/materialization is the boundary between MDT-owned state and the live tool-facing skill surface. Until a generated skill is explicitly approved and materialized, it should stay under MDT-owned state.

Codex example:

- candidate/generated skills: `~/.codex/mdt/generated/skills/learned/`
- live/promoted skills: `~/.codex/skills/`

## Weekly Retrospectives

Weekly retrospectives are intentionally low-noise.

For Codex they are part of the recommended baseline:

```text
~/.codex/mdt/homunculus/<project-id>/retrospectives/weekly/YYYY-Www.json
```

The goal is not to log more activity. The goal is to highlight:

- repeated shell commands that should become scripts or custom commands
- repeated external CLI usage that may justify MCP integrations
- repeated multi-step workflows that should be documented or automated
- repeated file hotspots that suggest missing helpers

## File Structure

```text
<data>/
+-- homunculus/
|   +-- identity.json
|   +-- projects.json
|   +-- observations.jsonl
|   +-- instincts/
|   |   +-- personal/
|   |   +-- inherited/
|   +-- evolved/
|   |   +-- agents/
|   |   +-- skills/
|   |   +-- commands/
|   +-- projects/
|   |   +-- <project-id>/
|   |       +-- observations.jsonl
|   |       +-- observations.archive/
|   |       +-- instincts/
|   |       |   +-- personal/
|   |       |   +-- inherited/
|   |       +-- evolved/
|   |           +-- skills/
|   |           +-- commands/
|   |           +-- agents/
+-- generated/
    +-- skills/
        +-- learned/
```

## Scope Decision Guide

| Pattern Type | Scope | Examples |
|-------------|-------|---------|
| Language/framework conventions | project | "Use React hooks", "Follow Django REST patterns" |
| File structure preferences | project | "Tests in `__tests__/`", "Components in src/components/" |
| Code style | project | "Use functional style", "Prefer dataclasses" |
| Error handling strategies | project | "Use Result type for errors" |
| Security practices | global | "Validate user input", "Sanitize SQL" |
| General best practices | global | "Write tests first", "Always handle errors" |
| Tool workflow preferences | global | "Grep before Edit", "Read before Write" |
| Git practices | global | "Conventional commits", "Small focused commits" |

## Instinct Promotion

Project instincts can be promoted to global scope when the same pattern is seen across multiple projects with strong confidence.

Example:

```bash
node "${MDT_ROOT}/skills/continuous-learning-manual/scripts/instinct-cli.js" promote
node "${MDT_ROOT}/skills/continuous-learning-manual/scripts/instinct-cli.js" promote --dry-run
```

For manual installs, replace `<config>` with your MDT config directory.

## Confidence Scoring

| Score | Meaning | Behavior |
|-------|---------|----------|
| 0.3 | Tentative | Suggested but not enforced |
| 0.5 | Moderate | Applied when relevant |
| 0.7 | Strong | Auto-approved for application |
| 0.9 | Near-certain | Core behavior |

Confidence increases with repeated consistent evidence and decreases with corrections, contradiction, or lack of reinforcement.

## Hook-Capable vs Manual Capture

Claude Code and Cursor can use hooks for deterministic observation capture.

Codex is intentionally different:

- no hook-style automatic capture claim
- manual capture and manual analysis are the baseline
- optional observer is analysis-only for Codex

## Backward Compatibility

v2.1 remains compatible with existing instinct storage and evolved assets. Legacy hook-oriented flows remain relevant for Claude Code and Cursor, but they are not the Codex baseline in this repo.

Generated candidate skills should now be treated as MDT-owned staging artifacts under `<data>/generated/skills/learned/`. Live tool-facing skills should remain in `<config>/skills/` and only receive explicitly promoted/materialized outputs.

## Privacy

- observations stay local on your machine
- project-scoped instincts are isolated by project
- only instinct patterns, not raw observations, should be exported
- you control export, import, and promotion

## Related

- [Skill Creator](https://skill-creator.app)
- Homunculus
- [The Longform Guide](https://x.com/affaanmustafa/status/2014040193557471352)

---

Instinct-based learning: teach the tool your patterns, one project at a time.

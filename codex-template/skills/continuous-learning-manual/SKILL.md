---
name: continuous-learning-manual
description: Instinct-based learning system that turns explicit session summaries, optional tool observations, and retrospectives into reusable instincts, skills, commands, and agents. v2.1 adds project-scoped instincts to prevent cross-project contamination.
version: 2.1.0
---

# Continuous Learning v2.1

An instinct-based learning system for MDT that turns repeated behavior into small reusable instincts with confidence scoring, project scoping, and optional evolution into larger assets.

`v2.1` adds project-scoped instincts so project-specific patterns stay local while broader workflow and security patterns can still be shared globally.

## When To Activate

- Reviewing or capturing reusable workflow patterns in Codex
- Running explicit Codex learning passes
- Reviewing instinct confidence, scope, export, import, or promotion
- Running weekly retrospectives to find automation candidates
- Deciding whether repeated work should become a skill, command, script, or MCP-backed integration

## Codex Model

Codex is manual-first in this repo.

- global MDT state lives under `~/.codex/mdt/homunculus/`
- explicit/manual capture is the baseline
- explicit/manual analysis is the baseline
- weekly retrospectives are part of the baseline
- the optional external observer only automates background analysis after observations already exist
- Codex does not currently get hook-style automatic capture in this repo

## What's New in v2.1

| Feature | v2.0 | v2.1 |
|---------|------|------|
| Storage | Global (`<data>/homunculus/`) | Project-scoped (`projects/<hash>/`) |
| Scope | All instincts apply everywhere | Project-scoped + global |
| Detection | None | git remote URL / repo path |
| Promotion | N/A | Project -> global when seen in 2+ projects |
| Commands | 4 (status/evolve/export/import) | 6 (+promote/projects) |
| Cross-project | Contamination risk | Isolated by default |

## What's New In v2

v2 introduced instinct-sized learning units, confidence-weighted evidence,
observer-assisted analysis, and project-aware storage and evolution paths.

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
project_id: "a1b2c3d4e5f6"
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

```text
Session activity
      |
      | explicit/manual capture
      v
projects/<project-hash>/observations.jsonl
      |
      | optional observer or explicit analysis
      v
pattern detection
      |
      | creates / updates
      v
projects/<project-hash>/instincts/personal/
instincts/personal/ (global)
      |
      | evolve / promote
      v
projects/<hash>/evolved/
evolved/ (global)
```

## Project Detection

The system detects project context in this order:

1. explicit project/config environment variables
2. git remote URL when available
3. repo path / repo markers
4. global fallback when no project can be identified

Each project gets a 12-character hash ID. A registry file at `~/.codex/mdt/homunculus/projects.json` maps IDs to human-readable names.

## Quick Start

### Codex Explicit Workflow

Use the explicit global-install workflow:

```bash
node ~/.codex/skills/continuous-learning-manual/scripts/codex-learn.js status
```

Then capture a concise session summary:

```bash
node ~/.codex/skills/continuous-learning-manual/scripts/codex-learn.js capture < summary.txt
```

Run an explicit analysis pass:

```bash
node ~/.codex/skills/continuous-learning-manual/scripts/codex-learn.js analyze
```

Run a weekly retrospective for one ISO week:

```bash
node ~/.codex/skills/continuous-learning-manual/scripts/codex-learn.js weekly --week 2026-W11
```

This writes Codex project learning state under `~/.codex/mdt/homunculus/projects/<project-id>/...`.

Codex baseline:

- sparse, explicit capture
- explicit/manual analysis
- explicit weekly retrospectives
- optional external observer for background analysis only

## Commands And Workflows

The instinct workflows are:

- `status`
- `evolve`
- `export`
- `import`
- `promote`
- `projects`
- `weekly`

For Codex, these are explicit script/workflow entrypoints.

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
| `observer.commands.*` | tool default | Override the native CLI command for supported observer runners |

Notes:

- all scripts are Node.js `.js`
- Codex observer support is a separate opt-in layer, not the baseline
- the observer reads and writes under `~/.codex/mdt/`

## Weekly Retrospectives

Weekly retrospectives are intentionally low-noise.

For Codex they are part of the recommended baseline:

```text
~/.codex/mdt/homunculus/projects/<project-id>/retrospectives/weekly/YYYY-Www.json
```

The goal is not to log more activity. The goal is to highlight:

- repeated shell commands that should become scripts or custom commands
- repeated external CLI usage that may justify MCP integrations
- repeated multi-step workflows that should be documented or automated
- repeated file hotspots that suggest missing helpers

## File Structure

```text
~/.codex/
+-- AGENTS.md
+-- config.toml
+-- rules/
+-- mdt/
    +-- scripts/
    +-- homunculus/
        +-- identity.json
        +-- projects.json
        +-- observations.jsonl
        +-- instincts/
        |   +-- personal/
        |   +-- inherited/
        +-- evolved/
        |   +-- agents/
        |   +-- skills/
        |   +-- commands/
        +-- projects/
            +-- <project-hash>/
                +-- observations.jsonl
                +-- observations.archive/
                +-- instincts/
                |   +-- personal/
                |   +-- inherited/
                +-- evolved/
                    +-- skills/
                    +-- commands/
                    +-- agents/
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
node ~/.codex/skills/continuous-learning-manual/scripts/instinct-cli.js promote
node ~/.codex/skills/continuous-learning-manual/scripts/instinct-cli.js promote --dry-run
```

## Confidence Scoring

| Score | Meaning | Behavior |
|-------|---------|----------|
| 0.3 | Tentative | Suggested but not enforced |
| 0.5 | Moderate | Applied when relevant |
| 0.7 | Strong | Auto-approved for application |
| 0.9 | Near-certain | Core behavior |

Confidence increases with repeated consistent evidence and decreases with corrections, contradiction, or lack of reinforcement.

## Manual Capture Contract

Codex is intentionally explicit and manual:

- no hook-style automatic capture claim
- manual capture and manual analysis are the baseline
- optional observer is analysis-only for Codex

## Backward Compatibility

v2.1 remains compatible with existing instinct storage and evolved assets.

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

# V1 Target State

This page describes where MDT is intended to land by `v1.0.0`.

It is not the source of truth for current support claims. For what is true today,
use:

- [supported-tools.md](./supported-tools.md)
- [tools/README.md](./tools/README.md)
- [INSTALLATION.md](./INSTALLATION.md)

## Principles

- keep current-state docs honest
- keep future-state goals explicit
- avoid mixing historical migration notes with active product direction
- prefer package-driven installs over implicit path copying
- keep tool-specific behavior native to each tool instead of cloning Claude semantics everywhere

## Installer Target State

By `v1.0.0`, the installer should be documented and understood as:

- package-driven for every first-class target
- global-first for normal installs, with explicit local bridges only where a tool truly requires them
- testable through dry-run output and temp-repo installs
- consistent enough that `docs/INSTALLATION.md` can stay short and stable

Desired target surfaces:

| Tool | User layer | Project layer | Desired maturity |
| --- | --- | --- | --- |
| Claude Code | `~/.claude/` | explicit bridge only if ever required | stable primary reference implementation |
| Cursor | `~/.cursor/` | explicit `.cursor/` bridge where needed | stable package-driven install with clear experimental/runtime boundaries |
| Codex | `~/.codex/` | explicit bridge only if ever required | stable package-driven install with native Codex workflow mapping |
| Gemini | `~/.gemini/` | `.agent/` and `.gemini/` | supported adapter with explicit limitations |

## Documentation Target State

The desired documentation shape is:

- `README.md`:
  - short overview
  - quick start
  - links into `docs/`
- `docs/INSTALLATION.md`:
  - install contract
  - examples
  - reset/reinstall pointers
- `docs/supported-tools.md` and `docs/tools/`:
  - current audited capability truth
- `NEXT-STEPS.md`:
  - active roadmap only
- `docs/history/`:
  - completed migrations and closed design notes

The README should not be a second full manual.

## Tool Target State

### Claude Code

Desired state:

- remains the clearest reference implementation for hooks and markdown workflow commands
- package-driven install stays explicit
- smoke and verify paths remain first-class

### Cursor

Desired state:

- package-driven project installs are stable
- runtime behavior is verified without pretending Cursor officially supports every MDT adapter surface
- custom commands, skills, and continuous-learning all work without Claude dependencies
- hook usage remains clearly marked when it depends on repo adapters or experimental surfaces

### Codex

Desired state:

- package-driven installs are first-class
- Codex uses native guidance, skills, and local scripts instead of fake markdown command clones
- Codex installs remain global-first, with project-scoped runtime state under `~/.codex/mdt/`
- continuous-learning works natively for Codex without Claude or Cursor dependencies

## Capability Package Target State

Capability packages should be treated as first-class install bundles, not informal labels.

Important categories:

- language packages
- scaffolding packages
- capability packages

Examples of desired capability-package outcomes:

- `continuous-learning`
- `context-compaction`
- `verification`
- `security`

Desired rule:

- packages describe what gets installed together
- tool docs describe what the tool can actually do today
- roadmap docs describe what still needs to be implemented

## Continuous-Learning Target State

Desired end state:

- sparse, event-driven capture
- low storage overhead
- focus on detecting repeated or costly workflows
- surface candidates for:
  - dedicated scripts
  - custom commands
  - MCP-backed integrations

What should not become the goal:

- logging every conversation turn
- maximizing raw observation volume
- long-term reporting before weekly summaries prove useful

## Done Means

The docs are in the intended shape when:

- current support claims only appear in audited current-state docs
- future goals live in roadmap/target-state docs
- historical notes live under `docs/history/`
- README stays concise and does not drift into a second source of truth

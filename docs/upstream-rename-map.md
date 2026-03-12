# MDT vs Upstream ECC

This page is a working comparison aid between upstream
`affaan-m/everything-claude-code` and this fork.

Use it when you are evaluating whether an upstream change should be copied into
MDT and need to know:

- what the upstream surface is called today
- what the nearest MDT surface is called today
- whether the concepts still map cleanly
- where porting work will probably land in this repo

This is not a history log of removed MDT aliases.

## Current Surface Map

| Upstream ECC surface | Current MDT surface | Porting note |
|---|---|---|
| Everything Claude Code | ModelDev Toolkit | MDT is multi-tool and no longer Claude-only in product framing |
| Claude-first plugin/install flow | `mdt install ...` | Port behavior into the umbrella CLI, not tool-specific one-off commands |
| `scripts/install-ecc.js` | [`scripts/install-mdt.js`](../scripts/install-mdt.js) | Core install behavior still lands here behind `mdt install` |
| npm bin / primary CLI | `mdt` via [`scripts/mdt.js`](../scripts/mdt.js) | New public CLI surface; do not reintroduce per-script public entrypoints |
| Claude-specific workflow entrypoints | `mdt verify ...`, `mdt smoke ...`, `mdt learning ...` | Normalize new workflow features under `mdt` where possible |
| `CLAUDE.md` | [`AGENTS.md`](../AGENTS.md) plus tool entrypoints | Shared repo guidance lives in `AGENTS.md`; tool deltas stay in root `CLAUDE.md` / `CODEX.md` / `CURSOR.md` |
| Claude-only capability claims | [`docs/supported-tools.md`](./supported-tools.md) and [`docs/tools/`](./tools/README.md) | Capability truth must be audited per tool, not copied blindly from Claude surfaces |
| `skills/continuous-learning/` | [`skills/continuous-learning-manual/`](../skills/continuous-learning-manual/SKILL.md) plus `mdt learning ...` | MDT’s shipped learning model is manual-first for Codex and hook-capable where supported |
| Claude hook workflows | Claude hooks plus tool-specific adapters | Port intent, not mechanism; Cursor hook support is still experimental and Codex has no equivalent hook surface |
| Claude slash commands | Claude commands plus tool-specific alternatives | Cursor may use custom commands; Codex should usually map to skills or `mdt` subcommands instead |
| Plugin/runtime state mixed under tool dirs | tool-facing config under `~/.{tool}/`, MDT-owned runtime/state under `~/.{tool}/mdt/` | Preserve this split when importing new runtime features |

## Porting Rules

When upstream adds or changes a feature:

1. Classify it first:
   - Claude-native capability
   - generic workflow idea
   - installer/runtime behavior
   - docs/guidance pattern
2. Find the MDT home for that feature:
   - umbrella CLI: [`scripts/mdt.js`](../scripts/mdt.js)
   - installer/runtime: [`scripts/install-mdt.js`](../scripts/install-mdt.js)
   - current capability truth: [`docs/tools/README.md`](./tools/README.md)
   - shared repo guidance: [`AGENTS.md`](../AGENTS.md)
3. Translate by capability, not by name:
   - if upstream uses a Claude hook, check whether MDT should map it to Claude-only behavior, an experimental Cursor adapter, a Codex `mdt learning` flow, or no cross-tool feature at all
   - if upstream uses a Claude slash command, decide whether MDT should expose it as a Claude command, a Cursor custom command, a Codex skill, or an `mdt` subcommand
4. Update docs in the right place:
   - current truth in [`docs/INSTALLATION.md`](./INSTALLATION.md), [`docs/supported-tools.md`](./supported-tools.md), and the rest of `docs/`
   - planned deltas in [`NEXT-STEPS.md`](../NEXT-STEPS.md) or [`docs/functional-parity-plan.md`](./functional-parity-plan.md)
   - completed work in [`docs/history/`](./history/README.md)

## High-Risk Drift Areas

These are the places where upstream changes are most likely to need deliberate
translation instead of direct copying:

- installer entrypoints and CLI examples
- hook-driven workflows
- continuous-learning flows
- tool capability claims
- path assumptions under tool home directories
- command/skill naming that is Claude-specific upstream

## MDT Source Of Truth For Porting

Before porting from upstream, check these current MDT files first:

- [`scripts/mdt.js`](../scripts/mdt.js)
- [`scripts/install-mdt.js`](../scripts/install-mdt.js)
- [`docs/supported-tools.md`](./supported-tools.md)
- [`docs/tools/capability-matrix.md`](./tools/capability-matrix.md)
- [`docs/tools/workflow-matrix.md`](./tools/workflow-matrix.md)
- [`docs/INSTALLATION.md`](./INSTALLATION.md)
- [`AGENTS.md`](../AGENTS.md)

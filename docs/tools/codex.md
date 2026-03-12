# Codex

Audit date: `2026-03-11`

Status:
- `official`
- `locally-verified`
- `experimental` for some feature flags

Local version seen:
- `codex --version` -> `codex-cli 0.114.0`

## MDT-Relevant Native Surfaces

- layered `AGENTS.md`
- rule files under Codex config layers
- skills under project `.codex/skills` and user/system skill locations
- built-in slash commands for session control
- optional MCP from CLI/config
- app automations
- experimental feature flags, including multi-agent related flags visible locally

## Native Surfaces vs MDT

| MDT Concern | Codex surface | Repo status |
|---|---|---|
| Rules / reusable guidance | `.rules` files under Codex rule layers | official |
| Project guidance | layered `AGENTS.md` | official |
| Skills / reusable workflows | project `.codex/skills` plus user/system skill locations | official |
| Repo-defined workflow commands | not a Claude-style markdown command surface; use skills and local scripts for smoke-style workflow checks | repo-adapter |
| Built-in slash commands | session-control slash commands such as `/permissions`, `/agent`, `/status`, `/model` | official |
| Agents / delegation | `AGENTS.md` is official; local feature flags show `multi_agent` and `child_agents_md` as non-stable | `official` plus `experimental` |
| Event hooks | no Claude-style hooks surface verified | unsupported |
| Automations | Codex app automations exist, but they are not the same as Claude hooks | official, separate concept |
| MCP | `config.toml` plus `codex mcp` | official, opt-in |

## What MDT Currently Ships

The repo currently ships:
- `codex-template/config.toml`
- `codex-template/AGENTS.md`
- `codex-template/skills/` as the install-source tree for Codex-readable skills
- package-driven Codex installs via `mdt install --tool codex <package...>`

Codex install scope follows the shared MDT contract:

- installs are global-only by default
- `--global` is accepted as a compatibility alias/no-op
- `--project-dir` is retired
- `--config-root <dir>` is for tests/dev when you need a fake Codex root

Codex now uses two distinct global layers:

- tool-facing layer: `~/.codex/` for `config.toml`, `AGENTS.md`, skills, and rules
- MDT-owned layer: `~/.codex/mdt/` for runtime helpers, observer scripts, manifests, and continuous-learning state

Codex global-config policy:

- treat `~/.codex/config.toml` as user-owned
- the installer may create it when missing during a global install
- if it already exists, MDT preserves it and writes `~/.codex/config.mdt.toml`
  as a reference file instead of overwriting local Codex settings
- repo guidance belongs in `AGENTS.md`, not in `config.toml`

For Codex, `codex-template/` is the install-source tree and `~/.codex/` is the
materialized tool-facing surface after install.

Important implication:
- do not document Codex as "single-agent only"
- do not document Codex as "instructions only"
- do not document Codex as "no rules" or "no skills"
- do not force Claude/Cursor markdown command patterns onto Codex when a skill plus local script is the cleaner fit

## Syntax and Paths To Prefer

### Layered instructions with `AGENTS.md`

Codex reads layered instruction files. Official docs describe:
- global: `~/.codex/AGENTS.md` or `AGENTS.override.md`
- project: repository `AGENTS.md`
- nested overrides closer to the working directory

The repo's `codex-template/AGENTS.md` should be treated as a Codex-specific supplement, not as proof that Codex lacks richer structure.

### Rule files

Official docs describe rule files under Codex rule layers, for example:

```text
~/.codex/rules/default.rules
```

Rule files use the Codex rules language and can be tested with Codex policy tooling.

### Skills

Official docs describe skill discovery in:
- repository `.codex/skills`
- user `~/.codex/skills`
- admin/system skill locations

Optional UI metadata can live in:

```text
agents/openai.yaml
```

For MDT smoke-style verification in Codex, prefer the shipped
`smoke` skill plus the local scripts when you are either:

- working in the MDT source repo itself
- or installing Codex with `--dev`

Smoke paths:

- MDT repo mode:
  - `mdt verify tool-setups`
  - `mdt smoke tool-setups`
  - `mdt smoke workflows --tool codex`
- installed global Codex root with `--dev`:
  - `node ~/.codex/mdt/scripts/mdt.js smoke tool-setups`
  - `node ~/.codex/mdt/scripts/mdt.js smoke workflows --tool codex`

For package-driven Codex installs, the installer materializes selected skills
from `codex-template/skills/` into `~/.codex/skills/`.

Normal Codex installs keep the general `documentation-steward` skill but do not
ship MDT-internal verifier/audit skills by default. Use `--dev` when you want
`smoke`, `tool-setup-verifier`, `tool-doc-maintainer`, and the repo-style smoke scripts
materialized into the installed global Codex root.

When testing against a clean environment, prefer:

```bash
mdt install --tool codex typescript continuous-learning
mdt install --tool codex --dev typescript continuous-learning
```

For `continuous-learning`, Codex currently uses an explicit manual workflow
instead of hooks:

```bash
mdt learning status
mdt learning capture < summary.txt
mdt learning analyze
mdt learning retrospective weekly --week 2026-W11
```

That writes project-scoped learning state under `~/.codex/mdt/homunculus/<project-id>/`.

Installed Codex-root equivalent:

```bash
node ~/.codex/mdt/scripts/mdt.js learning status
node ~/.codex/mdt/scripts/mdt.js learning capture < summary.txt
node ~/.codex/mdt/scripts/mdt.js learning analyze
node ~/.codex/mdt/scripts/mdt.js learning retrospective weekly --week 2026-W11
```

This is an intentional product choice, not a temporary documentation gap:

- Codex is a good fit for project-scoped learning state stored under the global MDT root plus explicit summaries
- Codex is not treated as having Claude/Cursor-style automatic hook capture
- the baseline Codex contract is explicit/manual capture plus explicit/manual analysis
- the optional external observer is only for background analysis after
  observations already exist
- the observer is a separate opt-in install layer, not part of baseline
  `continuous-learning`

The weekly retrospective path is manual-first and writes one summary per ISO
week under:

```text
~/.codex/mdt/homunculus/<project-id>/retrospectives/weekly/YYYY-Www.json
```

The intended output is low-noise and automation-focused:
- repeated shell commands that should become scripts or custom commands
- repeated external CLI workflows that may justify MCP integrations
- repeated tool sequences that deserve a documented workflow
- repeated file hotspots that suggest a missing helper, custom command, or MCP-backed integration

Important operational note:

- Codex project detection should prefer project-scoped records inside
  `~/.codex/mdt/homunculus/<id>/...` even when Node cannot spawn `git`
  in the active shell
- background analysis is different: if the active Codex shell blocks subprocess
  spawn (`EPERM`/`EACCES`), `analyze` may still be unable to launch the native
  Codex CLI from inside that session

Codex also has an optional external observer entrypoint for the cases where the
active Codex shell cannot spawn `codex exec`. Install it explicitly when
needed:

```bash
mdt install --tool codex continuous-learning-observer
```

Then use:

```bash
mdt learning observer status
mdt learning observer run
mdt learning observer watch --interval-seconds 15
```

Installed Codex-root equivalent:

```bash
node ~/.codex/mdt/scripts/mdt.js learning observer status
node ~/.codex/mdt/scripts/mdt.js learning observer run
node ~/.codex/mdt/scripts/mdt.js learning observer watch --interval-seconds 15
```

That observer:
- keeps the explicit/manual `status`, `capture`, `analyze`, and `weekly` flows as the baseline
- watches `~/.codex/mdt/homunculus/<id>/observations.jsonl`
- runs analysis in a normal shell environment where `codex exec` is allowed
- does not change Cursor or Claude behavior
- does not make Codex fully automatic; it supplements manual capture with
  background analysis

### Built-in slash commands

Codex slash commands are built-in session controls, not markdown workflow prompts. They are closer to terminal controls than to MDT's `commands/*.md`.

### Feature flags seen locally

`codex features list` currently shows, among others:
- `multi_agent` -> `experimental`
- `child_agents_md` -> `under development`
- `memories` -> `under development`
- `apps` -> `experimental`

Treat those as non-default until explicitly needed.

## What Not To Assume

- Do not assume Codex repo commands work like Claude markdown slash commands.
- Do not assume Codex can consume Claude hooks directly.
- Do not assume the absence of Claude-style hooks means Codex cannot support the same workflow outcome; use `AGENTS.md`, rules, skills, built-in slash commands, and automations instead.
- Do not try to emulate a Claude-style markdown `/smoke` command in Codex; use the Codex `smoke` skill and local smoke scripts instead.
- Do not treat `codex-template/` as optional documentation only; it is now the
  source tree the installer reads from for Codex-facing assets.

## Local Verification Commands

```bash
codex --version
codex --help
codex exec --help
codex features list
```

Look for:
- `mcp` support in `codex --help`
- `config.toml` references in help text
- feature stages in `codex features list`

MDT does not enable any Codex MCP servers by default. Treat MCP as an explicit
opt-in layer when a concrete workflow needs it.

## Source Links

- AGENTS.md: [developers.openai.com/codex/guides/agents-md](https://developers.openai.com/codex/guides/agents-md)
- Skills: [developers.openai.com/codex/skills](https://developers.openai.com/codex/skills)
- Rules: [developers.openai.com/codex/rules](https://developers.openai.com/codex/rules)
- CLI slash commands: [developers.openai.com/codex/cli/slash-commands](https://developers.openai.com/codex/cli/slash-commands)
- App automations: [developers.openai.com/codex/app/automations](https://developers.openai.com/codex/app/automations)

# Codex

Audit date: `2026-03-08`

Status:
- `official`
- `locally-verified`
- `experimental` for some feature flags

Local version seen:
- `codex --version` -> `codex-cli 0.111.0`

## MDT-Relevant Native Surfaces

- layered `AGENTS.md`
- rule files under Codex config layers
- skills under `.agents/skills` and user/system skill locations
- built-in slash commands for session control
- MCP from CLI/config
- app automations
- experimental feature flags, including multi-agent related flags visible locally

## Native Surfaces vs MDT

| MDT Concern | Codex surface | Repo status |
|---|---|---|
| Rules / reusable guidance | `.rules` files under Codex rule layers | official |
| Project guidance | layered `AGENTS.md` | official |
| Skills / reusable workflows | `.agents/skills` plus user/system skill locations | official |
| Repo-defined workflow commands | not a Claude-style markdown command surface; use skills and local scripts for smoke-style workflow checks | repo-adapter |
| Built-in slash commands | session-control slash commands such as `/permissions`, `/agent`, `/status`, `/model` | official |
| Agents / delegation | `AGENTS.md` is official; local feature flags show `multi_agent` and `child_agents_md` as non-stable | `official` plus `experimental` |
| Event hooks | no Claude-style hooks surface verified | unsupported |
| Automations | Codex app automations exist, but they are not the same as Claude hooks | official, separate concept |
| MCP | `config.toml` plus `codex mcp` | official |

## What MDT Currently Ships

The repo currently ships:
- `codex-template/config.toml`
- `codex-template/AGENTS.md`
- `codex-template/skills/` as the install-source tree for Codex-readable skills
- package-driven Codex installs via `node scripts/install-mdt.js --target codex <package...>`
- optional explicit project targeting via `node scripts/install-mdt.js --target codex --project-dir <repo> <package...>`

Codex install scope follows the shared MDT contract:

- no `--global` => do not touch `~`
- `--global` => user/global install is the intended target
- `--project-dir <repo>` => project-local `.agents/` install is the intended target

That means Codex installs are not implicitly two-layer anymore:

- user layer: `~/.codex/` only when `--global` is explicit
- project layer: `.agents/skills/` plus `.agents/scripts/` when `--project-dir` is used

Codex global-config policy:

- treat `~/.codex/config.toml` as user-owned
- the installer may create it when missing during a global install
- if it already exists, MDT preserves it and writes `~/.codex/config.mdt.toml`
  as a reference file instead of overwriting local Codex settings
- repo guidance belongs in `AGENTS.md`, not in `config.toml`

For Codex, `codex-template/` is the install-source tree. `.agents/skills/` is the
materialized project-facing surface after install.

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
- repository `.agents/skills`
- user `~/.agents/skills`
- admin/system skill locations

Optional UI metadata can live in:

```text
agents/openai.yaml
```

For MDT smoke-style verification in Codex, prefer the shipped
`tool-setup-verifier` skill plus the local scripts:

- MDT repo mode:
  - `node scripts/verify-tool-setups.js`
  - `node scripts/smoke-tool-setups.js`
  - `node scripts/smoke-codex-workflows.js`
- installed target repo mode:
  - `node .agents/scripts/smoke-tool-setups.js`
  - `node .agents/scripts/smoke-codex-workflows.js`

For package-driven Codex installs, the installer materializes selected skills
from `codex-template/skills/` into `.agents/skills/`.

When testing against a clean repo, prefer:

```bash
node scripts/install-mdt.js --target codex --project-dir ../scratch-repo typescript continuous-learning
node scripts/install-mdt.js --target codex --global typescript continuous-learning
```

For `continuous-learning`, Codex currently uses an explicit manual workflow
instead of hooks:

```bash
node .agents/skills/continuous-learning-manual/scripts/codex-learn.js status
node .agents/skills/continuous-learning-manual/scripts/codex-learn.js capture < summary.txt
node .agents/skills/continuous-learning-manual/scripts/codex-learn.js analyze
node .agents/skills/continuous-learning-manual/scripts/codex-learn.js weekly --week 2026-W11
```

That writes project-local learning state under `.codex/homunculus/`.

This is an intentional product choice, not a temporary documentation gap:

- Codex is a good fit for project-local learning state and explicit summaries
- Codex is not treated as having Claude/Cursor-style automatic hook capture
- the baseline Codex contract is explicit/manual capture plus explicit/manual analysis
- the optional external observer is only for background analysis after
  observations already exist

The weekly retrospective path is manual-first and writes one summary per ISO
week under:

```text
.codex/homunculus/projects/<project-id>/retrospectives/weekly/YYYY-Www.json
```

The intended output is low-noise and automation-focused:
- repeated shell commands that should become scripts or custom commands
- repeated external CLI workflows that may justify MCP integrations
- repeated tool sequences that deserve a documented workflow

Important operational note:

- Codex project detection should prefer repo-scoped `.codex/homunculus/projects/<id>/...`
  storage even when Node cannot spawn `git` in the active shell
- background analysis is different: if the active Codex shell blocks subprocess
  spawn (`EPERM`/`EACCES`), `analyze` may still be unable to launch the native
  Codex CLI from inside that session

Codex also has an optional external observer entrypoint for the cases where the
active Codex shell cannot spawn `codex exec`:

```bash
node .agents/scripts/codex-observer.js status
node .agents/scripts/codex-observer.js once
node .agents/scripts/codex-observer.js watch --interval-seconds 15
```

That observer:
- keeps the explicit/manual `status`, `capture`, `analyze`, and `weekly` flows as the baseline
- watches project `.codex/homunculus/projects/<id>/observations.jsonl`
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
- Do not try to emulate `/smoke` as a fake markdown command in Codex; use the Codex skill and local smoke scripts instead.
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

## Source Links

- AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- Skills: https://developers.openai.com/codex/skills
- Rules: https://developers.openai.com/codex/rules
- CLI slash commands: https://developers.openai.com/codex/cli/slash-commands
- App automations: https://developers.openai.com/codex/app/automations

# Codex

Audit date: `2026-03-12`

Status:
- `official`
- `locally-verified`
- `experimental` for some feature flags

Tested with version:
- `codex --version` -> `codex-cli 0.114.0`

## MDT-Relevant Native Surfaces

- layered `AGENTS.md`
- rule files under Codex config layers
- skills under project and user/system locations
- built-in slash commands for session control
- optional MCP from CLI/config
- app automations
- experimental feature flags

## Native Surfaces vs MDT

| MDT Concern | Codex surface | Repo status |
|---|---|---|
| Rules / reusable guidance | `.rules` files under Codex rule layers | `official` |
| Project guidance | layered `AGENTS.md` | `official` |
| Skills / reusable workflows | project `.codex/skills` plus user/system skill locations | `official` |
| Repo-defined workflow commands | skills plus local verification scripts | `repo-adapter` |
| Built-in slash commands | session-control slash commands such as `/permissions`, `/agent`, `/status`, `/model` | `official` |
| Agents / delegation | `AGENTS.md` plus experimental multi-agent feature flags | `official`, `experimental` |
| Event hooks | no Claude-style hooks surface verified | `unsupported` |
| Automations | Codex app automations | `official` |
| MCP | `config.toml` plus `codex mcp` | `official` |

## MDT Mapping Notes

- Codex is a first-class MDT target, but not a Claude-style hook target.
- Current-state docs should describe Codex in terms of `AGENTS.md`, rules, skills, built-in slash commands, and explicit `mdt` workflows.
- Use `mdt ...` as the public operational surface. Installed-home raw script paths are verification equivalents only.
- Distinguish Codex's shipped `~/.codex/AGENTS.md` from this repository's layered maintainer `AGENTS.md` files; the latter are dev-only authoring aids for MDT itself.

## Authoring MDT Surfaces

Use [authoring.md](./authoring.md) as the contributor entrypoint.
Use [surfaces/README.md](./surfaces/README.md) when you need a cross-tool comparison by surface type.

For Codex specifically:

- use layered `AGENTS.md`, Codex rules, and Codex skills as the primary authoring surfaces
- do not describe shared markdown commands as a native Codex command system
- do not create or document Claude-style hook behavior for Codex
- when a skill needs Codex-specific metadata or config, place that in the relevant `codex-template/skills/<name>/` add-on rather than inventing a top-level Codex agent/command story not supported by the audited docs

## Verification Method

Local CLI evidence:
- `codex --version`
- `codex --help`
- `codex exec --help`
- `codex features list`

Runtime workflow check:
- `mdt dev smoke tool-setups --tool codex`
- `mdt dev smoke workflows --tool codex`

Installed-home equivalent:
- `node ~/.codex/mdt/scripts/mdt.js dev smoke tool-setups --tool codex`
- `node ~/.codex/mdt/scripts/mdt.js dev smoke workflows --tool codex`

## What Not To Assume

- Do not assume Codex repo commands work like Claude markdown slash commands.
- Do not assume Codex can consume Claude hooks directly.
- Do not document Codex as a single-agent or instructions-only tool.

## Source Links

- AGENTS.md: [developers.openai.com/codex/guides/agents-md](https://developers.openai.com/codex/guides/agents-md)
- Skills: [developers.openai.com/codex/skills](https://developers.openai.com/codex/skills)
- Rules: [developers.openai.com/codex/rules](https://developers.openai.com/codex/rules)
- CLI slash commands: [developers.openai.com/codex/cli/slash-commands](https://developers.openai.com/codex/cli/slash-commands)
- App automations: [developers.openai.com/codex/app/automations](https://developers.openai.com/codex/app/automations)

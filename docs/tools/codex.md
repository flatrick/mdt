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
| Repo-defined workflow commands | not verified as a Claude-style markdown command surface in this audit | unsupported / redesign |
| Built-in slash commands | session-control slash commands such as `/permissions`, `/agent`, `/status`, `/model` | official |
| Agents / delegation | `AGENTS.md` is official; local feature flags show `multi_agent` and `child_agents_md` as non-stable | `official` plus `experimental` |
| Event hooks | no Claude-style hooks surface verified | unsupported |
| Automations | Codex app automations exist, but they are not the same as Claude hooks | official, separate concept |
| MCP | `config.toml` plus `codex mcp` | official |

## What MDT Currently Ships

The repo currently ships:
- `codex-template/config.toml`
- `codex-template/AGENTS.md`

That is useful, but narrower than what Codex officially supports.

Important implication:
- do not document Codex as "single-agent only"
- do not document Codex as "instructions only"
- do not document Codex as "no rules" or "no skills"

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

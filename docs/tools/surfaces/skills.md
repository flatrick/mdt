# Skills Across Tools

Use this page when you need to compare how MDT should create reusable skills across Claude Code, Cursor, and Codex.

## Support Summary

| Tool | Status | What MDT should author |
| --- | --- | --- |
| Claude | `official` | Shared `skills/<name>/SKILL.md` plus metadata |
| Cursor | `official` | Shared skill layout and metadata |
| Codex | `official` | Shared skills plus Codex add-on files when the skill needs Codex-specific metadata or config |

## Source Files

| Tool | Primary source files | Notes |
| --- | --- | --- |
| Claude | `skills/<name>/SKILL.md`, `skills/<name>/skill.meta.json` | Shared source |
| Cursor | `skills/<name>/SKILL.md`, `skills/<name>/skill.meta.json` | Same shared source format |
| Codex | `skills/<name>/...` plus `codex-template/skills/<name>/...` when needed | Codex may need add-on files such as `codex-template/skills/<name>/agents/openai.yaml` or tool-specific config |

## Creation Model

### Shared Baseline

Every installable skill starts in `skills/<name>/`.

Required:

- `SKILL.md`
- `skill.meta.json`

Optional:

- `config.json`
- `agents/`
- other skill-local support files allowed by the repo contract

### Claude and Cursor

- Use the shared skill directly.
- Keep `skill.meta.json` dependency and runtime requirements accurate.
- Use the same `SKILL.md` structure that the validators expect.

### Codex

- Start from the shared skill.
- Add files under `codex-template/skills/<name>/` only when Codex needs additional metadata or a different installed config shape.
- Keep template add-ons within the allowlist; do not duplicate full runtime trees there.

## Key Differences

| Question | Claude | Cursor | Codex |
| --- | --- | --- | --- |
| Is the shared skill layout native enough to use directly? | Yes | Yes | Usually yes, but sometimes with add-ons |
| Does the tool need a separate add-on layer? | Usually no | Usually no | Sometimes yes |
| Common mistake | missing metadata | treating skills as commands | duplicating too much in `codex-template/skills/` |

## Contributor Rules

- Create the shared skill first.
- Add Codex overlays only for real Codex-specific needs.
- Keep `skill.meta.json` truthful; it is part of the machine-readable contract.
- Use the add-on contract docs when adding tool-specific skill files.

## Decision Rule

- If the guidance is reusable across tools, start with one shared skill.
- If Codex needs extra metadata or config, add the smallest possible Codex overlay.
- If the behavior is really a command, rule, or workflow mapping rather than reusable task guidance, do not turn it into a skill just for parity.

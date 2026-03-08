# OpenCode

Audit date: `2026-03-08`

Status:
- `official`
- `not-locally-verified`

Local installation state:
- `opencode` is not installed on this machine

This page relies on:
- official OpenCode docs
- repo config under `.opencode/`

## MDT-Relevant Native Surfaces

- `opencode.json`
- `instructions`
- `agent`
- `command`
- `plugin`
- `tool`

These are all first-class config/plugin surfaces. OpenCode should be documented from that native model, not as a thin Claude clone.

## Native Surfaces vs MDT

| MDT Concern | OpenCode surface | Repo status |
|---|---|---|
| Rules / reusable guidance | `instructions` entries | official, not locally verified |
| Skills / reusable workflows | `instructions` can point at `SKILL.md` files | official in repo usage, not locally verified |
| Commands | `command` entries or markdown command files | official |
| Agents / delegation | `agent` config with primary/subagent modes | official |
| Automations / hooks | plugins and tools | official |
| Persistent context | persistent instructions/config | official |
| MCP / tool integration | config/plugin/tool surfaces | official |

## What MDT Currently Ships

The repo already contains a serious OpenCode adapter:
- `.opencode/opencode.json`
- `.opencode/commands/`
- `.opencode/prompts/agents/`
- `.opencode/plugins/`
- `.opencode/tools/`
- `.opencode/instructions/INSTRUCTIONS.md`

That means OpenCode should be treated as a structured adapter target, not as an afterthought.

## Important Drift To Remember

The repo currently contains conflicting OpenCode claims outside `docs/`:
- `.opencode/MIGRATION.md` says hooks have full parity and more
- `.opencode/prompts/agents/code-reviewer.txt` says hooks are not available in OpenCode

This docs pack is now the source of truth. Future work should reconcile those files later, but do not use them as authoritative without cross-checking.

## Syntax and Paths To Prefer

The native config center is:

```text
.opencode/opencode.json
```

MDT uses these native sections there:

```json
{
  "instructions": ["AGENTS.md", ".opencode/instructions/INSTRUCTIONS.md"],
  "plugin": ["./.opencode/plugins"],
  "agent": {},
  "command": {}
}
```

Repo plugin/tool examples live in:
- `.opencode/plugins/`
- `.opencode/tools/`

## What Not To Assume

- Do not assume OpenCode hooks are Claude hooks with different names.
- Do not assume local behavior on this machine; there is no installed `opencode` binary here.
- Use repo config plus official docs until OpenCode is installed locally and verified.

## Local Verification Commands To Use Once OpenCode Is Installed

```bash
opencode --version
opencode --help
```

Repo-only checks available right now:

```bash
cat .opencode/opencode.json
```

## Source Links

- Config: https://opencode.ai/docs/config/
- Commands: https://opencode.ai/docs/commands/
- Agents: https://opencode.ai/docs/agents/
- Plugins: https://opencode.ai/docs/plugins/

# Cursor

Audit date: `2026-03-14` (rules: only `.cursor/rules/` is read; `~/.cursor/rules/` ignored)

Status:
- `official`
- `locally-verified`
- `experimental` for MDT's current hook adapter

Tested with version:
- `agent --version` -> `2026.03.11-6dfa30c`
- `cursor-agent --version` -> `2026.03.11-6dfa30c`
- Cursor IDE -> `not-locally-verified` in this audit; manual human verification required

## MDT-Relevant Native Surfaces

- project rules (`.cursor/rules/` only; `~/.cursor/rules/` is ignored by Cursor IDE and cursor-agent)
- `AGENTS.md`
- custom commands
- skills
- memories
- background agents
- terminal agent / CLI
- MCP

## Native Surfaces vs MDT

| MDT Concern | Cursor surface | Repo status |
|---|---|---|
| Rules / project guidance | `.cursor/rules/` only; `~/.cursor/rules/` is not read by Cursor or cursor-agent | `official` (project only) |
| Commands | Cursor custom commands | `official` |
| Agents / delegation | custom modes, background agents, terminal agent | `official` |
| Skills / reusable workflows | `.cursor/skills/` and `~/.cursor/skills/` | `official` |
| Persistent context | rules, memories, `AGENTS.md` | `official` |
| Automations / hooks | MDT `cursor-template/hooks.json` adapter | `experimental` |
| MCP | Cursor CLI and agent MCP support | `official` |

## MDT Mapping Notes

- **Rules:** Cursor and cursor-agent **only** read rules from the **currently opened project/folder** (`.cursor/rules/`). The path `~/.cursor/rules/` is **ignored** (verified 2026-03-14). MDT must expect that Cursor rules only work when added to the current project. A command that installs rules into the opened project is required (e.g. `/mdt-install` or equivalent).
- Do not describe `~/.cursor/rules/` as a surface that Cursor reads; it is not.
- Treat `cursor-template/hooks.json` and `hooks/scripts/` as MDT's experimental adapter, not as vendor-native truth.
- Cursor IDE verification is manual and human-operated.

## Authoring MDT Surfaces

Use [authoring.md](./authoring.md) as the contributor entrypoint.
Use [surfaces/README.md](./surfaces/README.md) when you need a cross-tool comparison by surface type.

For Cursor specifically:

- author rules against the audited project-only rule model and keep Cursor-specific rule files in `cursor-template/rules/`
- author commands in `commands/*.md` with `commands/*.meta.json`; add `cursor-template/commands/*.md` only when Cursor needs a wording override
- treat `cursor-template/hooks.json` plus `hooks/scripts/` as an experimental MDT adapter, not a vendor-native contract
- do not document shared `agents/*.md` as if Cursor consumes Claude-style subagent files directly; describe Cursor delegation in terms of modes, background agents, terminal agent, and `AGENTS.md`

## Verification Method

Local CLI evidence:
- `agent --version`
- `agent --help`
- `cursor-agent --version`
- `cursor-agent --help`

Runtime workflow check:
- `mdt dev smoke tool-setups --tool cursor`
- `mdt dev smoke workflows --tool cursor`

Installed-home equivalent:
- `node ~/.cursor/mdt/scripts/mdt.js dev smoke tool-setups --tool cursor`
- `node ~/.cursor/mdt/scripts/mdt.js dev smoke workflows --tool cursor`

Manual verification boundary:
- Cursor IDE checks must be run by a human operator.
- When Cursor IDE is re-verified, record the exact tested version on the manual verification page.

## Local Bridge Exception

Use the repo-local rules bridge only when a specific repository needs `.cursor/rules/` for Cursor IDE:

```bash
mdt bridge materialize --tool cursor --surface rules
```

The installed Cursor custom command `/install-rules` is the in-product equivalent.

## Hooks: Known Limitation (Windows)

**Important:** On Windows, when a hook receives a **large payload**, Cursor may pass it via spawn arguments or environment instead of stdin. That exceeds the OS command-line length limit and causes **`spawn ENAMETOOLONG`** **before** the hook script runs—so the script cannot work around it. If you see this error, use the workarounds below.

**Affected hooks (large payloads):**

- **beforeReadFile** — file content or context can be large
- **afterFileEdit** — edit payload can be large
- **beforeSubmitPrompt** — prompt/content can be large
- **sessionEnd** — full session (messages, state) can be very large

Any other hook that receives a large payload from Cursor may also be affected.

Reference: [known Cursor bug](https://forum.cursor.com/t/pretooluse-hook-fails-with-enametoolong-for-large-files/150346); no ETA for a fix.

**Workarounds:**

1. **Remove the hook** — Remove the affected entry (e.g. `beforeReadFile`, `afterFileEdit`, `beforeSubmitPrompt`, `sessionEnd`) from `.cursor/hooks.json` so Cursor does not invoke that hook.
2. **Payload via temp file (when supported)** — If the caller writes the payload to a temp file and invokes the hook with only that path, set **`MDT_HOOK_PAYLOAD_FILE`** to the temp file path before invoking. MDT hooks that use the adapter’s `readHookPayload()` will read from that file and delete it after use. Today Cursor does not set this; this is for future Cursor support or custom wrappers.

## What Not To Assume

- Do not assume the hook adapter is an official Cursor feature.
- Do not assume Cursor IDE and `cursor-agent` share the same user-global rule storage model.
- Do not assume Cursor IDE can be launched and prompted through the current CLI verification flow.

## Source Links

- Rules: [docs.cursor.com/en/context/rules](https://docs.cursor.com/en/context/rules)
- AGENTS.md and rules together: [docs.cursor.com/en/cli/using](https://docs.cursor.com/en/cli/using)
- Custom commands: [docs.cursor.com/en/agent/chat/commands](https://docs.cursor.com/en/agent/chat/commands)
- Memories: [docs.cursor.com/en/context/memories](https://docs.cursor.com/en/context/memories)
- Background agents: [docs.cursor.com/en/background-agents/overview](https://docs.cursor.com/en/background-agents/overview)
- Terminal agent / CLI: [docs.cursor.com/en/cli/agent](https://docs.cursor.com/en/cli/agent)
- Skills: [cursor.com/docs/skills](https://cursor.com/docs/skills)

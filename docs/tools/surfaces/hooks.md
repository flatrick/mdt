# Hooks Across Tools

Use this page when you need to compare how MDT should create or document hook-like automation across Claude Code, Cursor, and Codex.

## Support Summary

| Tool | Status | What MDT should author |
| --- | --- | --- |
| Claude | `official` | Native Claude hooks driven from `claude-template/hooks.json` |
| Cursor | `experimental` | MDT adapter hooks from `cursor-template/hooks.json` plus `hooks/scripts/` wrappers |
| Codex | `unsupported` for Claude-style hooks | No hook authoring surface; use `AGENTS.md`, skills, rules, or automations instead |

## Source Files

| Tool | Primary source files | Notes |
| --- | --- | --- |
| Claude | `claude-template/hooks.json` | Native hook config source of truth |
| Cursor | `cursor-template/hooks.json`, `hooks/scripts/`, shared hook/runtime logic | Adapter layer, not vendor-native truth |
| Codex | none | Do not create Claude-style hooks for Codex |

## Decision Rule

- If you need event-driven behavior and the workflow only matters on Claude, author a Claude hook.
- If the same outcome must exist on Cursor, prefer a design that still works without hooks, then add the Cursor adapter only if the extra automation is worth the maintenance cost.
- If the target is Codex, redesign the workflow around Codex-native surfaces instead of trying to preserve hook semantics.

## Creation Model

### Claude

- Add or change the behavior in `claude-template/hooks.json`.
- Keep shared logic outside the config when possible.
- Claude has a native hook surface; that does not make it the default MDT model for other tools.

### Cursor

- Treat Cursor hooks as an MDT compatibility layer.
- Configure the surface in `cursor-template/hooks.json`.
- Keep event wrappers in `hooks/scripts/`.
- Keep reusable logic in shared runtime code, not in Cursor-only wrappers.
- Fail open when the adapter cannot safely enforce behavior.

### Codex

- Do not add hook docs, hook config, or hook-driven workflow claims.
- If the desired outcome is automation, redesign it using Codex-native guidance, skills, rules, or app automations.

## Key Differences

| Question | Claude | Cursor | Codex |
| --- | --- | --- | --- |
| Is this a native vendor surface? | Yes | No, MDT adapter | No |
| Should contributors author new hook behavior? | Yes | Only when the adapter is justified | No |
| Can MDT treat this as a stable cross-tool contract? | No | No | No |
| Main risk | projecting Claude behavior onto other tools | presenting adapter behavior as native Cursor support | inventing support that is not audited |

## Contributor Rules

- Start from the desired workflow outcome, not from "hooks everywhere".
- If the behavior is essential, verify that the workflow still makes sense without Cursor hooks.
- Keep Codex out of hook comparisons unless audited support changes.

## Verification

- Use [../local-verification.md](../local-verification.md) for the verification order.
- Keep the Cursor Windows payload limitation documented on [../cursor.md](../cursor.md).

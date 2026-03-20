# Cursor Delegation Example

This example shows how MDT should explain delegated behavior for Cursor without pretending that `agents/*.md` are Cursor's native on-disk agent format.

## Example Shape

Cursor realization is usually a combination of:

- shared guidance in [AGENTS.md](../../../../AGENTS.md)
- a Cursor-facing command or rule that tells Cursor when to plan, review, or delegate
- Cursor-native delegation features such as modes, background agents, or terminal agent

Example guidance shape:

```md
Use agents proactively without user prompt:
- Complex feature requests -> planner
- Code just written/modified -> code-reviewer
- Bug fix or new feature -> tdd-guide
```

That guidance lives in shared repo instructions, but it does not mean Cursor is reading `agents/planner.md` as a native subagent file.

## Why This Is Different From Claude

- Cursor supports delegation, but the audited native surfaces are modes, background agents, terminal agent, and `AGENTS.md`.
- The shared `agents/*.md` files may still help MDT define role concepts, but they are not the audited proof of Cursor's native agent-file format.

## Authoring Implication

When documenting Cursor support for a delegated workflow:

- explain the workflow outcome
- point to the Cursor-native realization
- avoid saying "Cursor reads `agents/*.md` directly" unless that behavior is separately audited

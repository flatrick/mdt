# Claude Agent Example

This example shows the shape of a real Claude-facing MDT agent file.

Source model:

- shared MDT agent file such as [agents/planner.md](../../../../agents/planner.md)

## Example Shape

```md
---
name: planner
description: Expert planning specialist for complex features and refactoring.
tools: ["Read", "Grep", "Glob"]
model: opus
---

You are an expert planning specialist focused on creating comprehensive,
actionable implementation plans.
```

## Why This Is Claude-Native

- The file itself is the tool-facing subagent definition.
- Claude consumes the `agents/*.md` shape directly.
- MDT commands and docs can refer to this file as a real agent surface, not just a conceptual role.

## Authoring Implication

If you add a new file under `agents/`, you are creating a direct Claude subagent surface.

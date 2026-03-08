---
description: Analyze instincts and suggest or generate evolved structures
agent: build
---

# Evolve Command

Analyze and evolve instincts in continuous-learning-v2: $ARGUMENTS

## Your Task

Run:

```bash
node "${MDT_ROOT}/skills/continuous-learning-v2/scripts/instinct-cli.js" evolve $ARGUMENTS
```

For manual installs, replace `<config>` with your MDT config directory:

```bash
node "<config>/skills/continuous-learning-v2/scripts/instinct-cli.js" evolve $ARGUMENTS
```

## Supported Args (v2.1)

- no args: analysis only
- `--generate`: also generate files under `evolved/{skills,commands,agents}`

## Behavior Notes

- Uses project + global instincts for analysis.
- Shows skill/command/agent candidates from trigger and domain clustering.
- Shows project -> global promotion candidates.
- With `--generate`, output path is:
  - project context: `<data>/homunculus/projects/<project-id>/evolved/`
  - global fallback: `<data>/homunculus/evolved/`

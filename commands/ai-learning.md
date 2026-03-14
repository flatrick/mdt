---
name: ai-learning
description: Review instinct status and run the supported ai-learning workflow
command: true

---

# AI Learning Command

Use this command as the shared entrypoint for the `ai-learning` workflow across MDT-supported tools.

## Implementation

Review current instinct state with the instinct CLI:

```bash
node "${MDT_ROOT}/skills/ai-learning/scripts/instinct-cli.js" status
node "${MDT_ROOT}/skills/ai-learning/scripts/instinct-cli.js" projects
```

Run an on-demand analysis pass with the MDT learning CLI:

```bash
node "${MDT_ROOT}/mdt/scripts/mdt.js" learning analyze
```

For manual installs, replace `<config>` with your MDT config directory:

```bash
node "<config>/skills/ai-learning/scripts/instinct-cli.js" status
node "<config>/skills/ai-learning/scripts/instinct-cli.js" projects
node "<config>/mdt/scripts/mdt.js" learning analyze
```

## Usage

```text
/ai-learning
```

Example follow-up requests:

```text
review instinct status
review instinct status and run an analysis pass on the current session
run an analysis pass only
```

## What to Do

1. Treat `/ai-learning` as the shared workflow surface, not a tool-specific one.
2. If the user asks for instinct review, run `status` first and `projects` when useful.
3. In hook-enabled environments, run `mdt.js learning analyze` on the accumulated observations.
4. In hook-free environments, use the explicit learning flow: capture a session summary when needed, then run `mdt.js learning analyze`.
5. Do not use `instinct-cli.js` for `capture` or `analyze`.
6. Do not write instinct markdown files directly unless the user explicitly asks for manual recovery or low-level repair work.
7. Summarize what changed or what was analyzed from command output.

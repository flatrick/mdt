---
description: Show learned instincts (project + global) with confidence
agent: build
---

# Instinct Status Command

Show instinct status from continuous-learning-v2: $ARGUMENTS

## Your Task

Run:

```bash
node "${MDT_ROOT}/skills/continuous-learning-v2/scripts/instinct-cli.js" status
```

For manual installs, replace `<config>` with your MDT config directory:

```bash
node "<config>/skills/continuous-learning-v2/scripts/instinct-cli.js" status
```

## Behavior Notes

- Output includes both project-scoped and global instincts.
- Project instincts override global instincts when IDs conflict.
- Output is grouped by domain with confidence bars.
- This command does not support extra filters in v2.1.

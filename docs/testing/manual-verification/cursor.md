# Cursor Manual Verification

Last verified:
- `2026-03-12`

Tested with version:
- `Cursor Agent CLI 2026.03.11-6dfa30c`
- `Cursor IDE` must be stamped manually by the human operator who runs the IDE check

Manual boundary:
- Cursor IDE tests must be run by a human operator.
- Do not treat this page as proof of a CLI-driven Cursor IDE prompt flow.

Use this page to confirm MDT behavior inside Cursor desktop after installing into a fresh global `~/.cursor/` directory and, when needed, materializing the repo-local `.cursor/rules/` bridge that Cursor IDE reads.

## Preconditions

1. Install MDT into Cursor with `mdt install --tool cursor typescript ai-learning`.
2. If the opened repository needs repo-local Cursor IDE rules, run `mdt bridge materialize --tool cursor --surface rules`.
3. Confirm the install exists under `~/.cursor/`.
4. If you want the maintainer-only smoke surface, reinstall with `mdt install --tool cursor --dev typescript ai-learning`.

## CLI Checks

Run:

```bash
agent --version
agent --help
cursor-agent --version
cursor-agent --help
mdt verify tool-setups
mdt dev smoke tool-setups --tool cursor
mdt dev smoke workflows --tool cursor
```

Installed-home equivalents:

```bash
node ~/.cursor/mdt/scripts/mdt.js dev smoke tool-setups --tool cursor
node ~/.cursor/mdt/scripts/mdt.js dev smoke workflows --tool cursor
```

## Human-Operated IDE Checks

- verify that repo-local `.cursor/rules/` are read when the bridge is materialized
- verify that installed commands and skills are visible in Cursor
- verify that the exact Cursor IDE version used for the check is recorded at the top of this page
- verify that any hook-dependent behavior is treated as experimental, not vendor-native

## Required Real-Session Check

After the scripted smoke passes, run one small human-operated task in Cursor itself:

1. Open this repo in Cursor with the expected global install and any needed rules bridge already in place.
2. Trigger one MDT workflow surface that should be visible in Cursor, such as a command, rule-driven planning step, or installed skill.
3. Ask Cursor to make one tiny disposable documentation or test-only edit and confirm the repo guidance is reflected in the response.
4. If the runtime behavior only appears in the IDE, treat that IDE observation as authoritative over CLI-only evidence.

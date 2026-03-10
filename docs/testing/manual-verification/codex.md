# Codex Manual Verification

Use this page for quick Codex sanity checks and deeper runtime verification in a
real local Codex session.

## Quick Smoke

Codex does not use the same markdown command surface as Claude Code or Cursor.
For Codex, the smoke path is:

- the `tool-setup-verifier` skill under `.agents/skills/`
- the local smoke scripts for the current repo mode:
  - MDT repo mode:
    - `node scripts/verify-tool-setups.js`
    - `node scripts/smoke-tool-setups.js`
    - `node scripts/smoke-codex-workflows.js`
  - installed target repo mode:
    - `node .agents/scripts/smoke-tool-setups.js`
    - `node .agents/scripts/smoke-codex-workflows.js`

Expected:
- in MDT repo mode, `verify-tool-setups.js` passes
- `smoke-tool-setups.js` reports Codex CLI probes as `PASS` when Codex is installed
- `smoke-codex-workflows.js` reports the current Codex MDT workflows as `PASS`

## Package Install

Install Codex with explicit packages:

```bash
node scripts/install-mdt.js --target codex --project-dir . typescript continuous-learning
```

If you want to test against a different repo without changing the current
workspace, use:

```bash
node scripts/install-mdt.js --target codex --project-dir ../scratch-repo typescript continuous-learning
```

Then confirm:

- `.agents/skills/` contains the selected Codex skills
- `.agents/scripts/lib/` exists for MDT runtime helpers

For a global Codex install, use:

```bash
node scripts/install-mdt.js --target codex --global typescript continuous-learning
```

Then confirm:

- `~/.codex/config.toml` exists
- if `~/.codex/config.toml` already existed before install, confirm the installer
  preserved it and wrote `~/.codex/config.mdt.toml` instead of overwriting it
- `~/.codex/AGENTS.md` exists

## Continuous Learning

Codex currently uses an explicit workflow instead of hooks.

Interpretation rule:

- treat explicit/manual capture as the normal Codex path
- treat the external observer as optional background analysis only
- treat the observer as a separate install layer, not part of baseline Codex learning
- do not treat Codex as having full automatic continuous learning parity with
  Claude Code or Cursor

1. Check status:

```bash
node .agents/skills/continuous-learning-manual/scripts/codex-learn.js status
```

Expected:
- `Tool: codex`
- storage under project `.codex/homunculus/...`

2. Capture a concise session summary:

```bash
node .agents/skills/continuous-learning-manual/scripts/codex-learn.js capture < summary.txt
```

3. Run one explicit analysis pass:

```bash
node .agents/skills/continuous-learning-manual/scripts/codex-learn.js analyze
```

Expected:
- observations are archived after analysis
- `observer.log` is written under project `.codex/homunculus/projects/<id>/`
- project-scoped instincts can be created under `.codex/homunculus/projects/<id>/instincts/personal/`
- if the active Codex shell blocks subprocess spawn (`EPERM`/`EACCES`), treat
  that as an environment limitation, not as proof that project detection is broken

4. Generate one weekly retrospective:

```bash
node .agents/skills/continuous-learning-manual/scripts/codex-learn.js weekly --week 2026-W11
```

Expected:
- a summary file is written under `.codex/homunculus/projects/<id>/retrospectives/weekly/`
- the summary includes automation-oriented sections such as repeated commands,
  repeated files, repeated workflows, and automation candidates
- repeated file hotspots should be called out explicitly when the same file is
  touched 3+ times in the selected ISO week
- the output stays sparse and reflects only the requested ISO week

## Optional External Observer

Codex now has an optional external observer for running background analysis from
a normal terminal outside the active Codex shell. Install it explicitly when
needed:

```bash
node scripts/install-mdt.js --target codex --project-dir <repo> continuous-learning-observer
```

Then use:

```bash
node .agents/scripts/codex-observer.js status
node .agents/scripts/codex-observer.js once
node .agents/scripts/codex-observer.js watch --interval-seconds 15
```

Use it when:

- project-scoped storage works
- explicit `capture` and `weekly` flows work
- but background `analyze` is blocked by the active Codex shell environment

Expected:

- `status` reports project `.codex/homunculus/projects/<id>/...` storage
- `once` triggers analysis when the observation threshold is met
- `watch` polls the same project-local observations file and runs analysis after
  new observations accumulate
- the explicit/manual flow remains the baseline even if the external observer is running
- the observer improves convenience and resilience; it does not turn Codex into
  a hook-driven capture environment

## Likely Deeper Checks

- local Codex launch verification for this repo
- sandbox/profile verification for trusted local testing
- install and config verification under the Codex repo template
- manual checks for workflows driven by `AGENTS.md` and installed skills
- any future Codex-native continuous-learning behavior

## Notes

- Keep this page focused on behavior that must be verified in a real local Codex session.
- Keep CLI-first checks in [docs/tools/local-verification.md](../../tools/local-verification.md).

# Codex Manual Verification

Use this page for quick Codex sanity checks and deeper runtime verification in a
real local Codex session.

## Quick Smoke

Codex does not use the same markdown command surface as Claude Code or Cursor.
For Codex, the smoke path is:

- the `smoke` skill under `~/.codex/skills/` when Codex was installed with `--dev`
- the local smoke scripts for the current repo mode:
  - MDT repo mode:
    - `mdt verify tool-setups`
    - `mdt smoke tool-setups`
    - `mdt smoke workflows --tool codex`
  - installed global Codex root with `--dev`:
    - `node ~/.codex/mdt/scripts/mdt.js smoke tool-setups`
    - `node ~/.codex/mdt/scripts/mdt.js smoke workflows --tool codex`

Expected:
- in MDT repo mode, `mdt verify tool-setups` passes
- `mdt smoke tool-setups` reports Codex CLI probes as `PASS` when Codex is installed
- `mdt smoke workflows --tool codex` reports the current Codex MDT workflows as `PASS`

## Package Install

Install Codex with explicit packages:

```bash
mdt install --tool codex typescript continuous-learning
```

Then confirm:

- `~/.codex/skills/` contains the selected Codex skills
- `~/.codex/mdt/scripts/` exists for MDT runtime helpers
- if you installed with `--dev`, `~/.codex/skills/smoke/`, `~/.codex/skills/tool-setup-verifier/`, and
  `~/.codex/skills/tool-doc-maintainer/` exist
- if you did not install with `--dev`, those MDT-internal verifier/audit skills
  should be absent

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
node ~/.codex/mdt/scripts/mdt.js learning status
```

Expected:
- `Tool: codex`
- storage under `~/.codex/mdt/homunculus/...`

2. Capture a concise session summary:

```bash
node ~/.codex/mdt/scripts/mdt.js learning capture < summary.txt
```

3. Run one explicit analysis pass:

```bash
node ~/.codex/mdt/scripts/mdt.js learning analyze
```

Expected:
- observations are archived after analysis
- `observer.log` is written under `~/.codex/mdt/homunculus/<id>/`
- project-scoped instincts can be created under `~/.codex/mdt/homunculus/<id>/instincts/personal/`
- if the active Codex shell blocks subprocess spawn (`EPERM`/`EACCES`), treat
  that as an environment limitation, not as proof that project detection is broken

4. Generate one weekly retrospective:

```bash
node ~/.codex/mdt/scripts/mdt.js learning retrospective weekly --week 2026-W11
```

Expected:
- a summary file is written under `~/.codex/mdt/homunculus/<id>/retrospectives/weekly/`
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
mdt install --tool codex continuous-learning-observer
```

Then use:

```bash
node ~/.codex/mdt/scripts/mdt.js learning observer status
node ~/.codex/mdt/scripts/mdt.js learning observer run
node ~/.codex/mdt/scripts/mdt.js learning observer watch --interval-seconds 15
```

Use it when:

- project-scoped storage works
- explicit `capture` and `weekly` flows work
- but background `analyze` is blocked by the active Codex shell environment

Expected:

- `status` reports `~/.codex/mdt/homunculus/<id>/...` storage
- `once` triggers analysis when the observation threshold is met
- `watch` polls the same project-scoped observations file and runs analysis after
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

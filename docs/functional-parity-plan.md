# Functional Parity Plan

This page tracks the remaining tool-parity gaps that still matter before `v1.0.0`.

It is a roadmap document, not a source of truth for current support claims. For
what is shipped today, use:

- [Capability Matrix](tools/capability-matrix.md)
- [Workflow Matrix](tools/workflow-matrix.md)
- [Claude Code](tools/claude-code.md)
- [Cursor](tools/cursor.md)
- [Codex](tools/codex.md)
- [Installation](INSTALLATION.md)

---

## Current Baseline

MDT now has one public CLI surface:

- `mdt install ...`
- `mdt verify tool-setups`
- `mdt smoke tool-setups`
- `mdt smoke workflows --tool <claude|cursor|codex>`
- `mdt learning ...`

Current parity status:

- Claude remains the reference implementation for hook-driven workflows.
- Cursor has working install and workflow smoke coverage, but its hook adapter
  is still documented as `experimental`.
- Codex has working install and workflow smoke coverage, but relies on explicit
  `mdt learning ...` flows instead of hook-driven capture.
- All three first-class tools now have workflow smoke coverage.

The parity problem is no longer "can MDT install and verify across tools?".
The remaining work is making the differences intentional, documented, and small
where possible.

---

## Current Gaps That Still Matter

### Cursor vs Claude

| Gap | Current state | Why it still matters |
|---|---|---|
| Hooks | MDT ships a Cursor hook adapter, but it is still `experimental` | Core workflows must remain valid even if Cursor ignores that adapter |
| Rule surfaces | Cursor IDE project rules and `cursor-agent` global rules are distinct surfaces | Docs and installs must keep those scopes separate |
| Command coverage | Cursor command coverage is good enough for smoke verification, but not every Claude workflow maps 1:1 | MDT should avoid pretending every Claude command has a Cursor-native twin |
| Learning resilience | Hook-driven observation works only where the adapter is honored | Fallback guidance must stay explicit |

### Codex vs Claude

| Gap | Current state | Why it still matters |
|---|---|---|
| Hooks | Unsupported in Codex | No automatic session-start/end capture, post-edit checks, or pre-tool validation |
| Workflow command surface | Codex uses `AGENTS.md`, rules, skills, and `mdt` commands instead of markdown workflow commands | Docs must not teach Claude-style command semantics in Codex |
| Continuous learning | Baseline is explicit/manual via `mdt learning ...` | Users need low-friction guidance, not hidden script paths |
| Background analysis | Optional observer exists, but it is a supplement rather than the baseline | Product docs must keep manual-first behavior clear |
| Cost/session tracking parity | Still weaker than hook-driven Claude flows | This remains a documented limitation rather than a hidden gap |

---

## Parity Work Still Planned

### P1. Keep current parity claims exact

This is the highest-priority parity work before `v1.0.0`.

Needed outcomes:

- current support docs describe only shipped behavior
- roadmap docs describe only planned changes
- Cursor hook behavior stays labeled `experimental`
- Codex manual-first learning stays labeled as the baseline, not a temporary workaround
- docs stop teaching retired direct script entrypoints as the public API

### P1. Stabilize the Codex and Cursor learning story

Current state:

- Codex baseline: `mdt learning status|capture|analyze|retrospective weekly`
- Codex optional observer: `mdt learning observer status|run|watch`
- Cursor hook capture exists, but depends on the current adapter being honored

Still planned:

- validate whether weekly retrospectives actually produce useful automation candidates
- decide whether Cursor should expose the same explicit weekly workflow more prominently
- keep monthly rollups deferred unless weekly output proves useful

### P2. Reduce avoidable tool-specific surprises

Follow-up areas that may still improve parity but are not required to claim a
stable `v1.0.0` baseline:

- stronger Cursor guidance around cache/path ambiguity
- better documentation or tooling for Cursor global-vs-local command/rule scope
- optional Codex quality gates that operate outside Codex hooks, such as git-hook or CI-backed enforcement
- clearer install-time warnings when a selected tool cannot provide a hook-driven outcome

---

## Gaps That Are Intentional For v1

These are not hidden TODOs. They are accepted product boundaries for `v1.0.0`.

### Codex

- no Claude-style event hooks
- no markdown-command clone of Claude workflow prompts
- no promise of automatic learning capture parity with Claude or Cursor
- no claim that Codex cost tracking is equivalent to hook-driven tools

### Cursor

- no claim that the MDT hook adapter is an official Cursor feature
- no claim that Cursor IDE and `cursor-agent` share identical rule storage semantics
- no claim that global and repo-local Cursor surfaces are interchangeable

---

## Done Means

This parity plan is complete enough for `v1.0.0` when:

- current docs stop overstating parity
- roadmap docs describe only the remaining planned deltas
- smoke and verify workflows stay green across Claude, Cursor, and Codex
- Codex users can follow the documented manual learning path without needing raw script-path knowledge
- Cursor users can understand the global install plus explicit bridge model without ambiguity

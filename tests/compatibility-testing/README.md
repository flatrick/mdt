# Compatibility Testing

This folder is reserved for execution-surface compatibility tests that run MDT
through real tool-facing contracts rather than only through unit-level module
imports.

Its purpose is to catch failures caused by:

- different wrapper locations after extraction
- installed-layout drift
- different `cwd`, PATH, HOME, and tool-specific environment handling
- shell and subprocess differences
- global-vs-project config surface splits

## Scope

Compatibility tests here should focus on:

- Codex
- Claude Code
- Cursor Agent

Each suite should verify, where relevant:

- direct public-wrapper execution
- installed-layout execution from the tool config root
- hook, command, rule, skill, or observer launch behavior
- smoke-surface behavior, not just file existence

## Suggested layout

- `codex-compatibility.test.js`
- `claude-code-compatibility.test.js`
- `cursor-agent-compatibility.test.js`
- `cursor-ide-compatibility.test.js`
- `shared-fixtures.js`

## Minimum expectations

Each tool-specific suite should try to cover:

1. public entrypoint contract
2. installed-layout contract
3. smoke contract
4. one tool-specific edge surface

Examples:

- Codex:
  - installed `smoke` skill is present and usable
  - `scripts/codex-observer.js` resolves the extracted runtime correctly
- Claude Code:
  - `/smoke` and hook-facing paths still resolve after wrapper extraction
  - installed `.claude` layout contains required delegated runtime files
- Cursor Agent:
  - `/smoke` and `/install-rules` still work from the installed `~/.cursor/`
    surface
  - repo-local rule materialization remains compatible with the globally
    installed rule set

## Relationship to existing tests

The existing `tests/scripts/`, `tests/hooks/`, and `tests/lib/` suites should
continue to validate implementation and wrapper behavior.

This folder is for broader compatibility checks that model how each tool
actually launches MDT surfaces.

## Documentation rule

If a compatibility test reveals a tool-specific limitation or launch quirk,
document it in:

- `docs/tools/`
- the relevant manual-verification page under `docs/testing/manual-verification/`
- any migration plan that depends on that behavior staying stable

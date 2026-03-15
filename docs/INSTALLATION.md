# Installation

Use `mdt` to install MDT into Claude Code, Cursor, or Codex.

Detailed tool behavior lives in:

- [Supported Tools](./supported-tools.md)
- [Claude Code](./tools/claude-code.md)
- [Cursor](./tools/cursor.md)
- [Codex](./tools/codex.md)
- [Local Verification](./tools/local-verification.md)
- [Reset / Reinstall](./MIGRATION.md)

## CLI

```bash
mdt install [package ...] [--tool claude|cursor|codex] [--config-root <tool-config-dir>] [--dev] [--dry-run]
mdt install list [--tool claude|cursor|codex]
```

Notes:

- positional args are package names
- default tool is `claude`
- installs are global-only; `--global` is accepted as a compatibility no-op
- `--project-dir` is retired and exits with a migration message
- `--config-root` redirects the tool config root for tests or isolated installs
- `--dev` adds MDT-internal maintenance surfaces meant for MDT development, not normal end-user installs

## Install Contract

This is the install model for MDT now:

- normal installs always target the tool's user/global config root
- MDT-owned runtime and state live under `~/.{tool}/mdt/`
- tool-facing assets still live where the tool expects them
- repo-local installs are exceptions, not the baseline
- repo-local exceptions use explicit bridge commands instead of full project installs

Current bridge support:

- Cursor repo-local rules for Cursor IDE via:
  - Cursor custom command `/install-rules` after a normal Cursor install
  - or `mdt bridge materialize --tool cursor --surface rules`

## Target Summary

| Target | Tool config root | MDT-owned root | Notes |
| --- | --- | --- | --- |
| `claude` | `~/.claude/` | `~/.claude/mdt/` | installs rules, agents, commands, skills, hooks, and runtime scripts |
| `cursor` | `~/.cursor/` | `~/.cursor/mdt/` | always installs MDT into the shared global Cursor directory, even for IDE-only users; includes `.mdc` rules, skills, commands, optional experimental hooks, and runtime state |
| `codex` | `~/.codex/` | `~/.codex/mdt/` | installs Codex config, AGENTS, skills, rules, and helper scripts globally |

## Path Notation

Use path forms that stay unambiguous across Markdown renderers, terminals, and agents:

- prefer shell-neutral prose such as `~/.codex/`, `~/.claude/`, `~/.cursor/`, and `~/.{tool}/mdt/`
- in PowerShell examples, prefer `Join-Path $HOME '.codex'`, `Join-Path $HOME '.claude'`, and `Join-Path $HOME '.cursor'`
- avoid spelling out expanded Windows absolute home paths to tool dot-directories in docs or user-facing output

## Examples

Claude Code:

```bash
mdt install typescript
mdt install --dry-run typescript ai-learning
```

Cursor:

```bash
# Global Cursor install surface (always install to ~/.cursor/)
mdt install --tool cursor typescript
mdt install --tool cursor typescript ai-learning

# Repo-local Cursor IDE rules bridge (additional step when needed)
# Preferred inside Cursor after install: /install-rules
mdt bridge materialize --tool cursor --surface rules
```

Cursor mode split, last locally true `2026-03-12`:

- always use `mdt install --tool cursor ...` to install MDT into the global `~/.cursor/` directory, even if the user does not currently use `cursor-agent`
- treat that global install as the primary MDT Cursor install surface and future-compatible shared location
- use `/install-rules` inside Cursor, or `mdt bridge materialize --tool cursor --surface rules`, only as an additional step when a repo needs `.cursor/rules/` files for Cursor IDE
- the repo-local bridge complements the global install; it does not replace it

Codex:

```bash
mdt install --tool codex typescript ai-learning
mdt install --tool codex --dev typescript ai-learning
```

Codex notes:

- `~/.codex/config.toml` is treated as user-owned
- if `config.toml` already exists, MDT preserves it and writes `~/.codex/config.mdt.toml` as a reference file instead of overwriting local Codex settings
- Codex-specific MDT guidance lives primarily in `~/.codex/AGENTS.md`
- ai-learning state is project-scoped inside `~/.codex/mdt/homunculus/<project-id>/`
- MDT does not enable any Codex MCP servers by default; add them manually only when a concrete workflow needs them

Discovery:

```bash
mdt install list
mdt install --tool cursor --dry-run typescript
```

## Verification

After install, prefer:

```bash
mdt verify tool-setups
```

With `--dev` installs, you can also run the maintainer smoke checks:

```bash
mdt dev smoke tool-setups
mdt dev smoke workflows --tool claude
mdt dev smoke workflows --tool cursor
mdt dev smoke workflows --tool codex
```

Tool-specific manual checks live under:

- [docs/testing/manual-verification/claude-code.md](./testing/manual-verification/claude-code.md)
- [docs/testing/manual-verification/cursor.md](./testing/manual-verification/cursor.md)
- [docs/testing/manual-verification/codex.md](./testing/manual-verification/codex.md)

Readiness rule:

- `mdt verify tool-setups` confirms the normal install surface and workflow contract
- `mdt dev smoke ...` is an additional maintainer check for `--dev` installs
- the matching page in `docs/testing/manual-verification/` is still required for runtime behaviors inside Claude, Cursor, or Codex before calling the setup fully verified

Dev-only verification helpers:

- `--dev` guarantees a smoke-verification surface for Claude, Cursor, and Codex. It also installs `mdt-dev-smoke`, `mdt-dev-verify`, and the backing smoke scripts under the global MDT root
- normal end-user installs still include `docs-steward` as the general documentation skill

## Pre-v1 Policy

Before `v1.0.0`, assume reinstall rather than in-place upgrade:

- start fresh when install layout changes
- rerun `mdt install`
- do not rely on compatibility migration steps between intermediate revisions

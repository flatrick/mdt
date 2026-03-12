# Installation

Use `scripts/install-mdt.js` to install MDT into Claude Code, Cursor, Codex, or Gemini.

Detailed tool behavior lives in:

- [Supported Tools](./supported-tools.md)
- [Claude Code](./tools/claude-code.md)
- [Cursor](./tools/cursor.md)
- [Codex](./tools/codex.md)
- [Local Verification](./tools/local-verification.md)
- [Reset / Reinstall](./MIGRATION.md)

## CLI

```bash
node scripts/install-mdt.js [--target claude|cursor|codex|gemini] [--override <tool-config-dir>] [--dev] [--list] [--dry-run] [package ...]
```

Notes:

- positional args are package names
- default target is `claude`
- installs are global-only; `--global` is accepted as a compatibility no-op
- `--project-dir` is retired and exits with a migration message
- `--override` redirects the tool config root for tests or isolated installs
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
  - or `node scripts/materialize-mdt-local.js --target cursor --surface rules`

## Target Summary

| Target | Tool config root | MDT-owned root | Notes |
| --- | --- | --- | --- |
| `claude` | `~/.claude/` | `~/.claude/mdt/` | installs rules, agents, commands, skills, hooks, and runtime scripts |
| `cursor` | `~/.cursor/` | `~/.cursor/mdt/` | always installs MDT into the shared global Cursor directory, even for IDE-only users; includes `.mdc` rules, skills, commands, optional experimental hooks, and runtime state |
| `codex` | `~/.codex/` | `~/.codex/mdt/` | installs Codex config, AGENTS, skills, rules, and helper scripts globally |
| `gemini` | `~/.gemini/` | `~/.gemini/mdt/` | uses Gemini/Antigravity-specific layout with MDT state under `mdt/` |

## Examples

Claude Code:

```bash
node scripts/install-mdt.js typescript
node scripts/install-mdt.js --dry-run typescript continuous-learning
```

Cursor:

```bash
# Global Cursor install surface (always install to ~/.cursor/)
node scripts/install-mdt.js --target cursor typescript
node scripts/install-mdt.js --target cursor typescript continuous-learning

# Repo-local Cursor IDE rules bridge (additional step when needed)
# Preferred inside Cursor after install: /install-rules
node scripts/materialize-mdt-local.js --target cursor --surface rules
```

Cursor mode split, last locally true `2026-03-12`:

- always use `install-mdt.js --target cursor ...` to install MDT into the global `~/.cursor/` directory, even if the user does not currently use `cursor-agent`
- treat that global install as the primary MDT Cursor install surface and future-compatible shared location
- use `/install-rules` inside Cursor, or `materialize-mdt-local.js --target cursor --surface rules`, only as an additional step when a repo needs `.cursor/rules/` files for Cursor IDE
- the repo-local bridge complements the global install; it does not replace it

Codex:

```bash
node scripts/install-mdt.js --target codex typescript continuous-learning
node scripts/install-mdt.js --target codex --dev typescript continuous-learning
```

Codex notes:

- `~/.codex/config.toml` is treated as user-owned
- if `config.toml` already exists, MDT preserves it and writes `~/.codex/config.mdt.toml` as a reference file instead of overwriting local Codex settings
- Codex-specific MDT guidance lives primarily in `~/.codex/AGENTS.md`
- continuous-learning state is project-scoped inside `~/.codex/mdt/homunculus/<project-id>/`
- MDT does not enable any Codex MCP servers by default; add them manually only when a concrete workflow needs them

Gemini:

```bash
node scripts/install-mdt.js --target gemini typescript
```

Discovery:

```bash
node scripts/install-mdt.js --list
node scripts/install-mdt.js --target cursor --dry-run typescript
```

## Verification

After install, prefer:

```bash
node scripts/verify-tool-setups.js
node scripts/smoke-tool-setups.js
```

Tool-specific manual checks live under:

- [docs/testing/manual-verification/claude-code.md](./testing/manual-verification/claude-code.md)
- [docs/testing/manual-verification/cursor.md](./testing/manual-verification/cursor.md)
- [docs/testing/manual-verification/codex.md](./testing/manual-verification/codex.md)

Dev-only verification helpers:

- `--dev` guarantees a smoke-verification surface for Claude, Cursor, and Codex. It also installs MDT-internal surfaces such as `tool-setup-verifier` and `tool-doc-maintainer` plus the backing smoke scripts under the global MDT root
- normal end-user installs keep `documentation-steward` as the general documentation skill but do not ship MDT-maintainer-specific verifier/audit skills by default

## Pre-v1 Policy

Before `v1.0.0`, assume reinstall rather than in-place upgrade:

- start fresh when install layout changes
- rerun `node scripts/install-mdt.js`
- do not rely on compatibility migration steps between intermediate revisions

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
node scripts/install-mdt.js [--target claude|cursor|codex|gemini] [--global] [--project-dir <path>] [--dev] [--list] [--dry-run] [package ...]
```

Notes:

- positional args are package names
- default target is `claude`
- `--project-dir` changes where project-level files are installed
- `--global` only affects targets that support a user-level install mode
- `--dev` adds MDT-internal maintenance surfaces meant for MDT development, not normal end-user installs

## Scope Contract

This is the install-scope rule for MDT:

- if `--global` is not supplied, do not write to `~`
- treat `--global` as: `user/global install is the intended target`
- `--project-dir` means the named repo is the intended project target
- only make a user-home exception if there is a hard technical requirement
- if an exception exists, document it explicitly in this file and the relevant
  tool page

This rule applies across tools. A project-targeted install should not silently
touch user-global config just because a tool happens to support a user layer.

## Target Summary

| Target | User/global layer | Project layer | Notes |
| --- | --- | --- | --- |
| `claude` | `~/.claude/` with `--global` | `.claude/` by default | installs rules, agents, commands, skills, hooks, and runtime scripts |
| `cursor` | `~/.cursor/` with `--global` | `.cursor/` by default | global rules are not file-installable; project install is the primary mode |
| `codex` | `~/.codex/` with `--global` | `.agents/skills/` and `.agents/scripts/` in the target repo | package-driven; use `--project-dir` for clean external repo installs |
| `gemini` | `~/.gemini/` with `--global` | `.agent/` and `.gemini/` by default | uses Gemini/Antigravity-specific layout |

## Examples

Claude Code:

```bash
node scripts/install-mdt.js typescript
node scripts/install-mdt.js --dry-run typescript continuous-learning
```

Cursor:

```bash
node scripts/install-mdt.js --target cursor typescript
node scripts/install-mdt.js --target cursor typescript continuous-learning
node scripts/install-mdt.js --target cursor --global typescript
```

Codex:

```bash
node scripts/install-mdt.js --target codex --project-dir ../scratch-repo typescript continuous-learning
node scripts/install-mdt.js --target codex --global typescript continuous-learning
node scripts/install-mdt.js --target codex --project-dir ../scratch-repo --dev typescript continuous-learning
```

Codex note:

- project-targeted Codex installs should stay out of `~`
- `~/.codex/config.toml` is treated as user-owned
- if a global Codex install targets `~/.codex` and `config.toml` already exists,
  the installer should preserve it and write `~/.codex/config.mdt.toml` as an
  MDT reference file instead
- Codex-specific MDT guidance lives primarily in `~/.codex/AGENTS.md` for
  global installs
- MDT does not enable any Codex MCP servers by default; add them manually only
  when a concrete workflow needs them

Gemini:

```bash
node scripts/install-mdt.js --target gemini typescript
node scripts/install-mdt.js --target gemini --global typescript
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

- `--dev` installs MDT-internal surfaces such as `tool-setup-verifier`,
  `tool-doc-maintainer`, and Codex smoke workflow scripts into the target
  project install
- normal end-user installs keep `documentation-steward` as the general
  documentation skill but do not ship MDT-maintainer-specific verifier/audit
  skills by default

## Pre-v1 Policy

Before `v1.0.0`, assume reinstall rather than in-place upgrade:

- start fresh when install layout changes
- rerun `node scripts/install-mdt.js`
- do not rely on compatibility migration steps between intermediate revisions

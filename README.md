# ModelDev Toolkit

ModelDev Toolkit (MDT) is a Node-first workflow toolkit for Claude Code, Cursor, and Codex. It ships agents, skills, commands, rules, and install adapters behind one public CLI: `mdt`.

## Quick Start

```bash
git clone https://github.com/flatrick/modeldev-toolkit.git
cd modeldev-toolkit
npm install
npx mdt install typescript
npx mdt verify tool-setups
```

Tool-specific installs:

```bash
npx mdt install --tool cursor typescript
npx mdt install --tool codex typescript continuous-learning
npx mdt install list
```

Cursor IDE note:

- install MDT globally to `~/.cursor/`
- materialize repo-local Cursor IDE rules only when needed:
  `mdt bridge materialize --tool cursor --surface rules`
- Cursor IDE runtime verification is manual and human-operated

## Fast-Find Docs

Root entrypoints:

- [AGENTS.md](AGENTS.md) for repo rules and shared working policy
- [CLAUDE.md](CLAUDE.md) for the Claude Code entry shim
- [CURSOR.md](CURSOR.md) for the Cursor entry shim
- [CODEX.md](CODEX.md) for the Codex entry shim
- [README.POST-CLONE.md](README.POST-CLONE.md) for local post-clone setup
- [BACKLOG.md](BACKLOG.md) for active work and remaining tool-agnostic gaps

Current-state docs:

- [docs/INSTALLATION.md](docs/INSTALLATION.md) for install behavior
- [docs/supported-tools.md](docs/supported-tools.md) for the audited tool snapshot
- [docs/tools/README.md](docs/tools/README.md) for the tool docs pack
- [docs/testing/manual-verification/README.md](docs/testing/manual-verification/README.md) for manual checks
- [docs/plans/active.md](docs/plans/active.md) for current implementation plans

ECC comparison:

- [docs/upstream-rename-map.md](docs/upstream-rename-map.md) for MDT-to-ECC translation

## Current Rules

- Use `mdt ...` as the official public entrypoint.
- Treat `docs/` as the source of truth for current install and capability behavior.
- Treat Cursor IDE verification as manual-only.
- Stamp verification claims with exact tested versions.
- Do not treat Claude-native features as the base MDT contract unless the docs say they are vendor-specific.

## Repo Layout

- `agents/` shared agent prompts
- `commands/` shared markdown commands
- `skills/` shared skill definitions
- `rules/` shared rule packs
- `cursor-template/`, `codex-template/`, `claude-template/` tool install-source trees
- `docs/` current docs, manual verification, plans, and ECC comparison
- `scripts/` Node.js runtime, install, and CI helpers

## Verification

Repository checks:

```bash
npm run lint
npm test
```

Tool setup checks:

```bash
mdt verify tool-setups
```

Dev-install maintainer checks (`--dev` only):

```bash
mdt dev smoke tool-setups
mdt dev smoke workflows --tool claude
mdt dev smoke workflows --tool cursor
mdt dev smoke workflows --tool codex
```

## License

MIT. Original upstream work by [@affaan-m](https://github.com/affaan-m), maintained independently here.

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
npx mdt install --tool codex typescript ai-learning
npx mdt install list
```

Cursor IDE note:

- install MDT globally to `~/.cursor/`
- materialize repo-local Cursor IDE rules only when needed:
  `mdt bridge materialize --tool cursor --surface rules`
- Cursor IDE runtime verification is manual and human-operated

**Windows + Cursor hooks:** On Windows, Cursor may pass large hook payloads via spawn arguments instead of stdin. That can trigger **`spawn ENAMETOOLONG`** before the hook script runs—so the script cannot fix it. Affected hooks include **beforeReadFile**, **afterFileEdit**, **beforeSubmitPrompt**, and **sessionEnd**. See [Cursor hooks limitation](docs/tools/cursor.md#hooks-known-limitation-windows) for workarounds (remove the hook or use payload-via-temp-file when Cursor supports it).

## Fast-Find Docs

Root entrypoints:

- [AGENTS.md](AGENTS.md) for repo rules and shared working policy
- local `AGENTS.md` files inside major subdirectories for subtree-specific MDT-development rules
- [CLAUDE.md](CLAUDE.md) for the Claude Code entry shim
- [CURSOR.md](CURSOR.md) for the Cursor entry shim
- [CODEX.md](CODEX.md) for the Codex entry shim
- [README.POST-CLONE.md](README.POST-CLONE.md) for local post-clone setup
- [BACKLOG.md](BACKLOG.md) for active work and remaining tool-agnostic gaps

Current-state docs:

- [docs/INSTALLATION.md](docs/INSTALLATION.md) for install behavior
- [docs/supported-tools.md](docs/supported-tools.md) for the audited tool snapshot
- [docs/tools/README.md](docs/tools/README.md) for the tool docs pack
- [docs/tools/authoring.md](docs/tools/authoring.md) for contributor authoring rules across Claude, Cursor, and Codex
- [docs/tools/surfaces/README.md](docs/tools/surfaces/README.md) for surface-by-surface comparisons across tools
- [docs/testing/manual-verification/README.md](docs/testing/manual-verification/README.md) for manual checks
- [docs/plans/active.md](docs/plans/active.md) for current implementation plans

ECC comparison:

- [docs/upstream-rename-map.md](docs/upstream-rename-map.md) for MDT-to-ECC translation

## Current Rules

- Use `mdt ...` as the official public entrypoint.
- Treat `docs/` as the source of truth for current install and capability behavior.
- Treat layered repo `AGENTS.md` files as maintainer-only guidance for working in this repository, not as generic installed product content.
- Treat Cursor IDE verification as manual-only.
- Stamp verification claims with exact tested versions.
- Do not let Claude-native features redefine MDT's tool-agnostic contract; only use them where the docs mark them as vendor-specific.

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
npm run test:verbose
```

`npm test` now keeps console output focused on failed/skipped items and writes detailed JSONL artifacts under `.artifacts/logs/test-runs/`.

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

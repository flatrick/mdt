# Contributing to ModelDev Toolkit

This repository is the MDT fork (`flatrick/modeldev-toolkit`). Submit issues and PRs here for this fork. If a change is meant for upstream ECC, open a separate upstream PR.

## Contribution Rules

- treat `docs/` as the source of truth for current behavior
- keep root docs thin and fast to scan
- use `mdt ...` as the public entrypoint in current-state docs
- stamp verification claims with exact tested versions
- keep base MDT tool-agnostic unless a behavior is genuinely vendor-specific

## Before You Start

- read [AGENTS.md](AGENTS.md)
- read the nearest local `AGENTS.md` for the subtree you are changing
- check [BACKLOG.md](BACKLOG.md)
- check [docs/plans/active.md](docs/plans/active.md)
- if the work is substantial, add or update a plan under `docs/plans/details/`

## Working On Docs

- current install and capability truth belongs in `docs/`
- local `AGENTS.md` files are short agent-facing overlays for MDT development in this repo; `README.md` files and `docs/` remain the human-facing reference
- active planning work belongs in `docs/plans/`
- ECC comparison belongs in [docs/upstream-rename-map.md](docs/upstream-rename-map.md)
- do not add new root docs unless they are true fast-find entrypoints
- when documenting how to create MDT rules, commands, hooks, skills, agents, or workflows, use [docs/tools/authoring.md](docs/tools/authoring.md) as the contributor entrypoint
- when documenting how one surface differs across tools, use the comparison pages under [docs/tools/surfaces/](docs/tools/surfaces/README.md)

## Working On Skills, Agents, Commands, And Hooks

- `skills/*/SKILL.md`, `agents/*.md`, `commands/*.md`, and tool-template Markdown assets are runtime prompt surfaces, not casual reference notes
- keep them aligned with the current MDT contract
- do not teach stale operational commands or Claude-only assumptions as if they are base MDT behavior
- if a surface is still genuinely Claude-only, either rewrite it or add a concrete backlog item

## Hooks

- Claude has native hook support
- Cursor has an experimental MDT hook adapter
- Codex is not a Claude-style hook target
- use [hooks/README.md](hooks/README.md) for hook layout and source-of-truth paths

## Verification

Run the standard repo checks before submitting:

```bash
npm run lint
npm test
mdt verify tool-setups
```

When your change depends on a specific tool/runtime behavior:
- record the tested version in the relevant doc
- use the manual verification pages for human-operated checks
- do not guess on unverified surfaces

### Logs

#### Test logs

- Logs produced by for example `npm test` are in the JSONL format.
- Logs are sent to `.artifacts/logs/test-runs/YYYYMMDD.HHmmss/{test}.jsonl`
- Recommended tool for reading the logs: [fx](https://fx.wtf/)

## Pull Requests

- use conventional commits
- summarize the behavior change, verification, and any remaining gaps
- if you leave a real cross-tool gap unresolved, add it to [BACKLOG.md](BACKLOG.md)

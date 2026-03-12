# CODEX.md

This file is the Codex-specific entrypoint for working in this repository.

## Shared Repo Guidance

Read [AGENTS.md](AGENTS.md) first.

That file is the shared source of truth for:

- repo working rules
- development workflow
- testing and security expectations
- cross-tool documentation policy

## Codex-Specific Details

For durable Codex capability and integration details, use:

- [docs/tools/codex.md](docs/tools/codex.md)
- [docs/supported-tools.md](docs/supported-tools.md)

Repo-specific Codex note:

- Codex-facing install assets live under [codex-template/](codex-template/)
- MDT-owned runtime helpers and state are installed under `~/.codex/mdt/`
- workflow smoke checks are script-based, not Claude-style markdown commands

## Verification

Use the normal repo verification flow first:

```bash
npm run lint
npm test
```

If you need Codex-specific workflow verification, also use:

```bash
mdt smoke workflows --tool codex
```

# CURSOR.md

This file is the Cursor-specific entrypoint for working in this repository.

## Shared Repo Guidance

Read [AGENTS.md](AGENTS.md) first.

That file is the shared source of truth for:

- repo working rules
- development workflow
- testing and security expectations
- cross-tool documentation policy

## Cursor-Specific Details

For durable Cursor capability and integration details, use:

- [docs/tools/cursor.md](docs/tools/cursor.md)
- [docs/supported-tools.md](docs/supported-tools.md)

Repo-specific Cursor notes:

- Cursor install-source assets live under [cursor-template/](cursor-template/)
- the primary MDT install target is `~/.cursor/`
- repo-local `.cursor/` surfaces are exception bridges, not the default install
  model
- the hook adapter is experimental and workflows must still work without it

## Verification

Use the normal repo verification flow first:

```bash
npm run lint
npm test
```

If you need Cursor-specific workflow verification, also use:

```bash
mdt dev smoke workflows --tool cursor
```

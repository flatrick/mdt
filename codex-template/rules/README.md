# Codex Rules Source

This directory contains rule files installed to `~/.codex/rules/` by the package-driven installer.

## Files

- `common-coding-style.md` — immutability, file organization, error handling, input validation
- `common-testing.md` — TDD workflow, test coverage requirements
- `common-security.md` — security checklist, secret management, response protocol
- `common-git-workflow.md` — commit message format, PR workflow

## Naming Convention

Files use the `common-` prefix to reflect their source (`rules/common/`) and to avoid collisions in the flat `~/.codex/rules/` directory. This mirrors the convention used in `cursor-template/rules/`.

## Note on Format

Codex rule files may require the `.rules` extension or a Codex-specific rules language. These files currently use plain markdown (`.md`). If Codex does not pick them up automatically, rename to `.rules` and adjust the package manifest entries accordingly after local verification.

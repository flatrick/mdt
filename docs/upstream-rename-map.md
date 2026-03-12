# Upstream Rename Map (ECC -> ModelDev Toolkit)

This document tracks naming changes from upstream `affaan-m/everything-claude-code` to this fork, so upstream changes can be adapted deliberately.

## Current rename map

| Upstream name | This fork name | Notes |
|---|---|---|
| Everything Claude Code | ModelDev Toolkit | Product/repo branding in docs and UI strings |
| `scripts/install-ecc.js` | `scripts/install-mdt.js` | Installer script renamed |
| `ecc-install` (npm bin) | `mdt-install` | Old bin alias removed |
| `npm run install-ecc` | `npm run install-mdt` | Old npm script alias removed |
| `install-ecc` tests | `install-mdt` tests | `tests/scripts/install-mdt*.test.js` |
| `CLAUDE_PLUGIN_ROOT` | `MDT_ROOT` | Runtime placeholder renamed; legacy alias removed in this fork |
| `skills/continuous-learning/` | package `continuous-learning` -> `skills/continuous-learning-manual/` | Legacy v1 skill removed; upstream references to `continuous-learning` map to the v2 skill directory in this fork |

## Upstream sync checklist

When pulling a change from upstream that touches renamed surfaces:

1. Locate upstream edits affecting old names (search for `everything-claude-code`, `install-ecc`, `ecc-install`).
2. Port behavior first, then translate names using the table above.
3. Verify references in:
   - `package.json` / `package-lock.json`
   - `README.md` / `docs/MIGRATION.md` / `CLAUDE.md`
   - `scripts/install-mdt.js`
   - `tests/run-all.js` and `tests/scripts/install-mdt*.test.js`
4. Run targeted tests for installer and script wiring after porting.

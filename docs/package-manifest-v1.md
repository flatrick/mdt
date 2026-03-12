# Package Manifest v1 Draft (Historical)

Date: 2026-03-09  
Status: Historical design note

This page preserves the 2026-03-09 design draft that led to MDT's current
package-manifest system.

Current truth now lives in:

- [Package Manifest Schema](./package-manifest-schema.md)
- [Installation](./INSTALLATION.md)
- [History: 2026-03-12 roadmap rebaseline](./history/2026-03-12.roadmap-rebaseline.md)

## What Shipped From This Draft

The main direction from this draft is now implemented:

- install selection is manifest-driven under `packages/`
- manifests support `extends`
- manifests support `requires`
- package validation runs in CI
- Codex package intent is explicit under `tools.codex.*`

## What Changed From The Draft

The current contract differs from the original draft in a few important ways:

- `ruleDirectory` is now a required manifest field
- `tools.cursor.commands` and `tools.codex.rules` are real supported fields now
- the current schema is documented separately from this historical note
- skill dependency/runtime metadata is currently carried in `skill.meta.json`
  `requires` blocks rather than in `SKILL.md` frontmatter

## Why Keep This File

This note is still useful as design history because it captures:

- why install selection moved away from implicit directory scanning
- why package composition became explicit data
- why capability packages were introduced as first-class install bundles

Use it for historical context, not for the current schema.

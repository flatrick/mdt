---
name: docs-health
description: Audit MDT documentation health in this Cursor workspace.
---

# Docs Health

Use this command for a quick documentation quality pass in the current
workspace.

## Goal

Confirm that MDT docs are:

- linked correctly
- placed in the right part of the repo
- honest about current support
- easy to follow for both humans and LLMs

## Required Workflow

1. Run:

```bash
node scripts/ci/validate-markdown-links.js
node scripts/ci/validate-markdown-path-refs.js
```

If this workspace is using an installed MDT Cursor surface and the repo itself
does not contain `scripts/ci/`, use:

```bash
node .cursor/scripts/ci/validate-markdown-links.js
node .cursor/scripts/ci/validate-markdown-path-refs.js
```

2. Use the `documentation-steward` skill.

3. If the task touches cross-tool capability claims and `tool-doc-maintainer` is
available, use that skill as well and verify against `docs/tools/`.

4. Review whether the relevant docs are correctly split across:

- `README.md`
- `docs/`
- `docs/tools/`
- `NEXT-STEPS.md`
- `docs/history/`

## Preferred Output

```text
DOCS HEALTH: PASS|PARTIAL|FAIL

Validators: OK|FAIL
Current truth: OK|DRIFT
Placement: OK|DRIFT
Readability: OK|DRIFT

Fix now:
- ...

Follow-up:
- ...
```

## Rules

- do not guess about tool support
- do not report a broken link or missing path unless you checked it
- if `README.md` duplicates detailed docs, recommend shrinking it and linking to
  `docs/`
- if a page mixes current truth and future intent, recommend separating them

# Docs Health

Run a focused MDT documentation audit for correctness, placement, and
readability.

## Goal

Produce a short documentation health report that answers:

- are the markdown links and repo path references valid?
- are current-state claims still true?
- is any detailed truth living outside `docs/` when it should be moved?
- are roadmap, target-state, and history docs cleanly separated?
- what should be fixed now versus later?

## Required Workflow

1. Run:

```bash
node scripts/ci/validate-markdown-links.js
node scripts/ci/validate-markdown-path-refs.js
```

If the repo does not have `scripts/ci/` at root because this is an installed
MDT target repo, use the installed validator copies instead:

- Claude Code: `node .claude/scripts/ci/validate-markdown-links.js`
- Claude Code: `node .claude/scripts/ci/validate-markdown-path-refs.js`
- Cursor: `node .cursor/scripts/ci/validate-markdown-links.js`
- Cursor: `node .cursor/scripts/ci/validate-markdown-path-refs.js`
- Codex: `node .agents/scripts/ci/validate-markdown-links.js`
- Codex: `node .agents/scripts/ci/validate-markdown-path-refs.js`

2. Use the `documentation-steward` skill.

3. If the task touches cross-tool capability claims and the skill is available,
also use:

- `skills/tool-doc-maintainer/SKILL.md`

4. Review the relevant docs and classify findings into:

- current truth
- target state
- roadmap
- history
- generated reference
- manual verification

5. Prefer moving durable detailed guidance into `docs/` instead of letting root
files grow into a second manual.

## Output Format

Return a short report like:

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

- do not guess about support claims
- do not rewrite large doc areas unless the current task needs it
- use explicit file/path evidence for drift findings
- if a page mixes current truth and future intent, recommend a split
- if a root file duplicates detailed docs, prefer shrinking the root file and
  linking to `docs/`

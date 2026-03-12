---
name: documentation-steward
description: Keep MDT documentation current, accurate, well-placed, and easy to follow for both humans and LLMs. Use when auditing doc drift, correcting stale claims, deciding where docs belong, or validating documentation quality before a commit.

---

# Documentation Steward

Use this skill when the task is about keeping MDT documentation correct,
current, and easy to navigate.

## Goal

Maintain one coherent documentation system that:

- keeps current truth in `docs/`
- keeps root docs thin and easy to scan
- keeps tool capability claims aligned with audited evidence
- keeps roadmap and history separate from current truth
- stays readable for both humans and LLMs

## When To Use

- auditing documentation before a commit
- correcting stale or conflicting documentation claims
- deciding whether content belongs in `README.md`, `docs/`, `NEXT-STEPS.md`, or `docs/history/`
- checking whether new workflow/tool docs are actually supported by the code
- doing a repo-wide docs-health pass

## Core Taxonomy

Every documentation change should fit one of these buckets:

- current truth
- target state
- roadmap
- history
- generated reference
- manual verification

Use these destination rules:

- `README.md`:
  - short overview
  - quick start
  - links into `docs/`
- `docs/`:
  - durable detailed truth
- `docs/tools/`:
  - cross-tool capability truth
- `NEXT-STEPS.md`:
  - active roadmap only
- `docs/history/`:
  - completed migrations and closed design notes

## Baseline Checks

Run these first:

```bash
node scripts/ci/validate-markdown-links.js
node scripts/ci/validate-markdown-path-refs.js
```

If the current repo is an installed MDT Codex target repo and `scripts/ci/` is
not present at repo root, use the installed local copies under:

- `~/.codex/mdt/scripts/ci/`

Treat these validator checks as baseline gates, not optional extras.

## Required Workflow

### 1. Classify the doc surface

Before editing, decide:

- what is current truth
- what is future intent
- what is historical record
- what is generated/reference material

If a page mixes these, split or trim it.

### 2. Verify support claims before repeating them

For MDT capability docs in a Codex-installed repo:

- use `skills/tool-doc-maintainer/SKILL.md` when it is available in the current repo
- treat `docs/tools/` as the source of truth
- do not treat repo adapter files as proof of native support

### 3. Check whether the content belongs in `docs/`

If detailed guidance is living at repo root or in a workflow note, prefer moving
the durable version into `docs/` and leaving a shorter pointer behind.

### 4. Prefer readable, low-duplication docs

Good outcomes:

- one clear authoritative page per topic
- short entrypoint docs that link to deeper pages
- minimal duplication of support claims or install details
- concrete commands and file paths when verification matters

### 5. Report findings by category

Use categories like:

- stale claim
- wrong location
- duplicated truth
- missing verification
- broken link/path
- unclear for humans
- unclear for LLMs

## Readability Rules

- keep root docs short
- keep detailed truth in `docs/`
- prefer explicit commands and file paths when a human or LLM needs to verify behavior
- avoid burying active instructions inside historical notes
- avoid making roadmap docs pretend future work is already shipped
- avoid making current-state docs speculate about future design

## Never Do This

- never claim support without verification
- never let `README.md` become a second full manual
- never silently copy stale claims from files outside `docs/`
- never mix roadmap promises into current support docs
- never create new docs in odd locations when a `docs/` page is the right home

## Useful Companion Workflows

- `commands/docs-health.md` for a quick repo-wide docs audit
- `skills/tool-doc-maintainer/SKILL.md` for cross-tool capability truth when available
- `commands/update-docs.md` for generated/reference doc updates

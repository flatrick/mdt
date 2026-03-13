---
name: commit
description: Verify changes are safe to commit, run targeted checks, then draft and execute a conventional commit with a thorough message.

---

# Commit Command

Inspect the working tree, verify it is safe to commit, then produce and execute a well-structured commit message.

## Workflow

1. **Inspect** — run `git status`, `git diff`, and `git log --oneline -5` in parallel to understand what changed and what commit style the project uses
2. **Lint** — run the project linter; block and stop if errors are found
3. **Targeted tests** — run tests for the changed files only; fall back to full suite if targeted execution is not available; block and stop on failures
4. **Draft message** — write a conventional commit (subject + body)
5. **Confirm** — show the proposed message and wait for explicit approval
6. **Execute** — stage the right files and commit

## Commit Message Format

```
<type>: <short imperative description>

<body — what changed and why; omit for trivial changes>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`

Subject line: imperative mood, no trailing period, 72 characters max.

Body: wrap at 72 chars, explain what and why (not how), bullet points for multi-part changes.

## Required Behaviour

- Block on lint errors or test failures — do not proceed to commit.
- Never use `--no-verify` or skip hooks.
- Always wait for explicit user confirmation before committing.
- Prefer staging specific files over `git add -A`.
- If the working tree is clean, report that and stop.

## Arguments

- *(none)* — full workflow
- `quick` — lint only, skip tests
- `all` — stage all tracked changes before drafting
- `wip` — skip checks, use `chore: wip` subject

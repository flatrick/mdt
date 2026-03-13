---
description: Verify the working tree is clean enough to commit, run targeted checks, then draft and execute a conventional commit.

---

# Commit Command

Inspect current changes, verify they are safe to commit, then draft and execute a well-structured git commit message.

## What This Command Does

1. **Inspect changes** — read `git status` and `git diff` to understand what is staged and unstaged
2. **Lint** — run the project linter; block on any errors
3. **Run targeted tests** — identify test files related to changed source files and run them; fall back to the full suite if targeted execution is not possible
4. **Draft the commit message** — write a conventional commit with a concise subject line and an informative body
5. **Show and confirm** — present the proposed message and wait for explicit approval before committing
6. **Execute** — stage the right files and run `git commit`

## When to Use

Use `/commit` when:
- You have made changes and want to commit them safely
- You want the commit message written for you based on the actual diff
- You want a quick lint + targeted-test gate before touching git history

## Workflow

### Step 1 — Inspect

Run these in parallel:

```bash
git status
git diff
git log --oneline -5
```

Identify:
- Which files are modified, staged, or untracked
- Whether there are changes worth committing
- The commit style used in recent history (type prefix, sentence case, etc.)

If the working tree is clean, report that and stop.

### Step 2 — Lint

Run the project lint command (e.g. `npm run lint`, `ruff check .`, `eslint .`).

- If lint **fails with errors**, report the failures and **STOP**. Do not proceed to commit.
- If lint passes or only has warnings, continue.

### Step 3 — Targeted tests

Determine which test files correspond to the changed source files. Use whatever convention the project follows (e.g. `src/foo.ts` → `tests/foo.test.ts`, `lib/bar.js` → `tests/lib/bar.test.js`).

Run only those tests. If the project does not support targeted test execution, run the full test suite.

- If tests **fail**, report the failures and **STOP**.
- If no test files are found for the changed files, note that and continue.

### Step 4 — Draft the commit message

Write a conventional commit message:

```
<type>: <short imperative description>

<body — what changed and why; omit for trivial changes>
```

**Type selection:**

| Type | When to use |
|------|-------------|
| `feat` | new capability visible to users or callers |
| `fix` | corrects a defect |
| `refactor` | restructures code without changing behavior |
| `test` | adds or changes tests only |
| `docs` | documentation only |
| `chore` | build scripts, config, dependencies |
| `perf` | performance improvement |
| `ci` | CI pipeline changes |

**Subject line rules:**
- Imperative mood: "add", "fix", "remove" — not "added", "fixes", "removed"
- No trailing period
- 72 characters maximum
- Specific enough to be useful without reading the diff

**Body rules:**
- Wrap at 72 characters
- Explain *what* changed and *why*, not *how* (the diff shows how)
- Use bullet points for multi-part changes
- Include relevant context: issue numbers, links, migration notes
- Omit for single-line trivial changes (typo fixes, comment updates)

### Step 5 — Present and confirm

Show the proposed commit message clearly, including a summary of which files will be staged.

**STOP and wait for the user to respond with one of:**
- Approval (proceed as-is)
- A revised message or specific edits
- Cancellation

Do NOT commit without explicit approval.

### Step 6 — Execute

Stage the appropriate files and create the commit:

```bash
git add <files>
git commit -m "<subject>" -m "<body>"
```

Prefer staging specific named files over `git add -A` or `git add .` to avoid accidentally including unintended files.

After committing, run `git status` and report the new HEAD SHA.

## Arguments

`$ARGUMENTS` can refine the behaviour:

- *(none)* — full workflow as described above
- `quick` — skip tests, lint only
- `all` — stage all tracked changes before drafting (equivalent to `git add -u` scope)
- `wip` — use `chore: wip` subject, skip checks (for checkpointing only)

## Required Behaviour

- Never commit if lint errors are present (unless `wip` mode).
- Never commit if targeted tests fail (unless `wip` mode).
- Never use `--no-verify` or skip hooks.
- Never amend a commit that has already been pushed.
- Always wait for explicit confirmation before executing the commit.
- If the working tree is clean, say so and exit cleanly.

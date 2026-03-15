# Context-Mode Usage in MDT Development

Use context-mode tools (`ctx_execute`, `ctx_execute_file`) instead of raw Bash
or Read whenever the output could exceed ~20 lines. This keeps the main context
window clean and prevents large outputs from crowding out working memory.

---

## Always Use Context-Mode For

### Test Pipeline

```
npm test            → ctx_execute("npm test 2>&1")
npm run test:verbose → ctx_execute("npm run test:verbose 2>&1")
```

Spawns 19+ validators, each writing JSONL to
`.artifacts/logs/test-runs/<timestamp>/`. A single run produces 20–40 files;
the summary alone is 5–15 KB of raw output.

### JSONL Test Artifacts

```
.artifacts/logs/test-runs/<timestamp>/*.jsonl
```

Use `ctx_execute_file` with filtering code to extract failures, counts, or
timing. Never use Read on these files for analysis — they reach 9–11 KB each
in machine-readable format.

### install-mdt.js

```
node scripts/install-mdt.js  →  ctx_execute("node scripts/install-mdt.js 2>&1")
```

At 59 KB, this is the largest script in the repo and produces substantial
stdout. Never run via raw Bash.

### Smoke Tests

```
node scripts/mdt-dev-smoke-*.js  →  ctx_execute(...)
```

Smoke workflow files are 17–19 KB each and produce verbose structured output.
Use `ctx_execute` + targeted analysis code to surface only what matters.

### Lint Output

```
npm run lint  →  ctx_execute("npm run lint 2>&1")
```

Lint output across `skills/`, `docs/`, `commands/`, `agents/` can be hundreds
of lines when warnings accumulate. Print only failures.

### CI Validation Scripts

```
node scripts/ci/validate-install-packages.js   →  ctx_execute(...)
node scripts/ci/validate-dependency-sidecars.js →  ctx_execute(...)
```

These 5–17 KB validators print per-package/per-file results. Filter to
failures only inside the execute block.

### Git Log / Diff for PR Work

```
git log --oneline -50  →  ctx_execute(shell)
git diff main...HEAD   →  ctx_execute(shell)
```

MDT has active branches across skills, agents, commands, and docs. Diffs can
be large; use `ctx_execute` with awk/jq filtering.

### GitHub CLI

```
gh pr list   →  ctx_execute("gh pr list --json ...")
gh run view  →  ctx_execute("gh run view ...")
```

`gh` returns JSON arrays that flood context if piped raw. Use `--jq` or filter
inside `ctx_execute`.

---

## Raw Tools Are Fine For

| Task | Tool | Reason |
|------|------|--------|
| Reading a skill SKILL.md to edit | Read | Small file, Edit needs it in context |
| Reading a plan file | Read | Always small |
| Reading CLAUDE.md / AGENTS.md | Read | Small, targeted |
| Editing a validator script | Read → Edit | Need line-accurate context |
| `git add`, `git commit`, `git push` | Bash | Writes only, no large output |
| `mkdir`, `mv`, `cp` | Bash | Whitelist ops |

---

## MDT Artifact Analysis Loop

Optimal pattern for debugging a test failure:

```
1. ctx_execute("npm test 2>&1")
   → capture summary, note failing test file name

2. ctx_execute_file(".artifacts/logs/test-runs/<latest>/<failing>.jsonl",
     code: parse JSONL, filter level="error", print msg + context)
   → get exact failure details

3. Read the specific source file (Read tool, targeted, to enable Edit)

4. Edit → git commit (Bash)

5. ctx_execute("npm test 2>&1")
   → verify fix
```

This keeps the full test cycle from flooding context while delivering precise
failure details at step 2.

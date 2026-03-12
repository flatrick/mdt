---
name: refactor-clean
description: Safely identify and remove dead code with test verification at every step. One deletion at a time, never without a green baseline first.

---

# Refactor Clean Command

Use this command to remove dead code safely, with tests verifying each step.

## What This Command Does

1. Detect unused code with analysis tools.
2. Categorize findings by deletion safety.
3. Delete safe items one at a time with test verification.
4. Consolidate near-duplicates after cleanup.

## When to Use

Use `refactor-clean` when:
- the codebase has accumulated unused exports or files
- a feature was removed but its supporting code was not
- dependencies listed in `package.json` are no longer used

## Required Workflow

1. **DETECT**
   - run the appropriate analysis tool:

   | Tool | What It Finds | Command |
   |---|---|---|
   | knip | Unused exports, files, dependencies | `npx knip` |
   | depcheck | Unused npm dependencies | `npx depcheck` |
   | ts-prune | Unused TypeScript exports | `npx ts-prune` |
   | vulture | Unused Python code | `vulture src/` |
   | deadcode | Unused Go code | `deadcode ./...` |

   If no tool is available, use grep to find exports with zero imports.

2. **CATEGORIZE**

   | Tier | Examples | Action |
   |---|---|---|
   | SAFE | Unused utilities, internal functions | Delete with confidence |
   | CAUTION | Components, API routes, middleware | Verify no dynamic imports or external consumers first |
   | DANGER | Config files, entry points, type definitions | Investigate before touching |

3. **SAFE DELETION LOOP** (one item at a time)
   - run the full test suite — establish a green baseline
   - delete the dead code
   - re-run the test suite
   - if tests fail: revert with `git checkout -- <file>` and skip this item
   - if tests pass: move to the next item

4. **CAUTION ITEMS**
   - search for dynamic imports: `import()`, `require()`, string references
   - verify no external consumers before deleting

5. **CONSOLIDATE**
   - merge near-duplicate functions (>80% similar)
   - remove wrapper functions that add no value
   - consolidate redundant type definitions

6. **SUMMARY**
   ```
   Dead Code Cleanup
   ─────────────────────────────
   Deleted:   N unused functions / files / dependencies
   Skipped:   N items (tests failed or uncertain)
   Saved:     ~N lines removed
   ─────────────────────────────
   All tests passing
   ```

## Required Behavior

- Never delete without a green test baseline first.
- One deletion at a time — atomic changes make rollback easy.
- Skip if uncertain — better to keep dead code than break production.
- Do not refactor while cleaning — separate concerns.

## Quality Bar

- all tests green before and after each deletion
- no speculative deletions
- no refactoring mixed into the cleanup

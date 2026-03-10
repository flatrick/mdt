---
name: build-fix
description: Incrementally fix build and type errors with minimal, safe changes. One error at a time with verification after each fix.
---

# Build Fix Command

Use this command to resolve build or type errors without over-engineering the fix.

## What This Command Does

1. Detect the build system and run the build.
2. Group and sort errors by file and dependency order.
3. Fix one error at a time with re-verification after each.
4. Report what was fixed and what remains.

## When to Use

Use `build-fix` when:
- the build is broken and you need to restore it
- type errors are blocking compilation
- a dependency upgrade introduced errors

## Required Workflow

1. **DETECT**
   - identify the build tool from project files:

   | Indicator | Build Command |
   |---|---|
   | `package.json` with `build` script | `npm run build` / `pnpm build` |
   | `tsconfig.json` only | `npx tsc --noEmit` |
   | `Cargo.toml` | `cargo build` |
   | `go.mod` | `go build ./...` |
   | `pyproject.toml` | `mypy .` |

2. **GROUP**
   - parse stderr and group errors by file
   - fix import/type errors before logic errors (dependency order)
   - count total errors for progress tracking

3. **FIX LOOP** (one error at a time)
   - read the file around the error
   - diagnose root cause
   - apply the smallest fix that resolves it
   - re-run the build to confirm the error is gone and no new ones appeared

4. **SUMMARY**
   - errors fixed (with file paths)
   - errors remaining (if any)
   - suggested next steps for unresolved issues

## Guardrails

Stop and ask if:
- a fix introduces more errors than it resolves
- the same error persists after 3 attempts
- the fix requires architectural changes
- errors stem from missing dependencies (`npm install`, `cargo add`, etc.)

## Recovery Strategies

| Situation | Action |
|---|---|
| Missing import | Check if package is installed; suggest install command |
| Type mismatch | Read both type definitions; fix the narrower type |
| Circular dependency | Identify cycle; suggest extraction to a shared module |
| Version conflict | Check `package.json` / lock file for version constraints |
| Build misconfiguration | Read config; compare with working defaults |

## Quality Bar

- fix one error at a time
- prefer minimal diffs over refactoring
- no new errors introduced
- build passes cleanly at the end

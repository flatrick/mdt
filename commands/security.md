---
name: security
description: Run a security review of the current change or file. Checks for secrets, injection vulnerabilities, auth issues, and other OWASP Top 10 risks.

---

# Security Command

Use this command to review code for security vulnerabilities before committing.

## What This Command Does

1. Scan for hardcoded secrets and credentials.
2. Check for injection vulnerabilities (SQL, command, XSS).
3. Review authentication and authorization logic.
4. Verify input validation at system boundaries.
5. Report findings by severity.

## When to Use

Use `security` when:
- adding authentication or session handling
- writing code that accepts user input
- creating or modifying API endpoints
- handling file uploads or external data
- working with secrets, tokens, or credentials

## Required Workflow

1. **SCAN**
   - check all changed files for secrets (API keys, passwords, tokens)
   - check for SQL injection (raw string queries)
   - check for command injection (`exec`, `eval`, shell interpolation)
   - check for XSS (unsanitized HTML output)
2. **ASSESS**
   - rate each finding: CRITICAL / HIGH / MEDIUM / LOW
   - CRITICAL and HIGH must be fixed before committing
3. **FIX**
   - replace hardcoded secrets with environment variables
   - use parameterized queries or an ORM
   - sanitize output before rendering HTML
   - validate all inputs at the system boundary
4. **VERIFY**
   - re-scan after fixes
   - confirm no secrets appear in the diff

## Severity Guide

| Severity | Examples | Action |
|---|---|---|
| CRITICAL | Hardcoded secret, auth bypass, RCE | Fix immediately, do not commit |
| HIGH | SQL injection, XSS, IDOR | Fix before committing |
| MEDIUM | Missing rate limit, verbose error messages | Fix when possible |
| LOW | Informational, best-practice gaps | Note and defer if low risk |

## Required Behavior

- STOP and report if a CRITICAL finding is found — do not continue with other work.
- If a secret may have been committed previously, note that it must be rotated.
- Do not silently skip files — report any file that could not be scanned.

## Quality Bar

- no hardcoded secrets in the diff
- all user input validated before use
- parameterized queries used for all database access
- error messages do not leak internal paths or stack traces

# ModelDev Toolkit (MDT) — Agent Instructions

This is a multi-tool, Node-first AI coding repository with specialized agents, skills, commands, and automation adapters for software development workflows.

## Core Principles

1. **Agent-First** — Delegate to specialized agents for domain tasks
2. **Test-Driven** — Write tests before implementation, 80%+ coverage required
3. **Security-First** — Never compromise on security; validate all inputs
4. **Immutability** — Always create new objects, never mutate existing ones
5. **Plan Before Execute** — Plan complex features before writing code

## Repo-Specific Working Rules

- Treat `docs/supported-tools.md` and `docs/tools/` as the source of truth for Claude Code, Cursor, Codex, and OpenCode capability claims.
- Do not assume a file under `cursor-template/`, `codex-template/`, or `.opencode/` proves that the corresponding vendor supports that feature natively.
- When updating cross-tool capability documentation, use `skills/tool-doc-maintainer/SKILL.md` and follow its verification workflow.
- Prefer the repo's Node-first runtime and adapters. Do not reintroduce Bash-, PowerShell-, or Python-specific runtime assumptions unless the repo already requires them.
- Do not assume a specific OS or shell. Verify the environment before giving shell-specific instructions, and prefer shell-neutral guidance when possible.

## Available Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| planner | Implementation planning | Complex features, refactoring |
| architect | System design and scalability | Architectural decisions |
| tdd-guide | Test-driven development | New features, bug fixes |
| code-reviewer | Code quality and maintainability | After writing/modifying code |
| security-reviewer | Vulnerability detection | Before commits, sensitive code |
| build-error-resolver | Fix build/type errors | When build fails |
| e2e-runner | End-to-end Playwright testing | Critical user flows |
| refactor-cleaner | Dead code cleanup | Code maintenance |
| doc-updater | Documentation and codemaps | Updating docs |
| database-reviewer | PostgreSQL/Supabase specialist | Schema design, query optimization |
| python-reviewer | Python code review | Python projects |
| bash-reviewer | Bash/shell script review | Shell script changes and portability checks |
| powershell-reviewer | PowerShell code review | PowerShell scripts and cross-platform PS |
| dotnet-reviewer | .NET code review | C#/VB.NET reviews and architecture checks |
| rust-reviewer | Rust code review | Rust ownership, async, and unsafe audits |
| harness-optimizer | Harness and eval loop optimization | Improving evaluation, grading, and workflow harnesses |
| loop-operator | Loop workflow operations | Operating iterative or long-running loop workflows |
| chief-of-staff | Communication triage and response drafting | Email/chat triage and follow-up workflows |

The `agents/` directory is authoritative if this table drifts.

## Agent Orchestration

Use agents proactively without user prompt:
- Complex feature requests → **planner**
- Code just written/modified → **code-reviewer**
- Bug fix or new feature → **tdd-guide**
- Architectural decision → **architect**
- Security-sensitive code → **security-reviewer**

Use parallel execution for independent operations — launch multiple agents simultaneously.

## Security Guidelines

**Before ANY commit:**
- No hardcoded secrets (API keys, passwords, tokens)
- All user inputs validated
- SQL injection prevention (parameterized queries)
- XSS prevention (sanitized HTML)
- CSRF protection enabled
- Authentication/authorization verified
- Rate limiting on all endpoints
- Error messages don't leak sensitive data

**Secret management:** NEVER hardcode secrets. Use environment variables or a secret manager. Validate required secrets at startup. Rotate any exposed secrets immediately.

**If security issue found:** STOP → use security-reviewer agent → fix CRITICAL issues → rotate exposed secrets → review codebase for similar issues.

## Coding Style

**Immutability (CRITICAL):** Always create new objects, never mutate. Return new copies with changes applied.

**File organization:** Many small files over few large ones. 200-400 lines typical, 800 max. Organize by feature/domain, not by type. High cohesion, low coupling.

**Error handling:** Handle errors at every level. Provide user-friendly messages in UI code. Log detailed context server-side. Never silently swallow errors.

**Input validation:** Validate all user input at system boundaries. Use schema-based validation. Fail fast with clear messages. Never trust external data.

**Code quality checklist:**
- Functions small (<50 lines), files focused (<800 lines)
- No deep nesting (>4 levels)
- Proper error handling, no hardcoded values
- Readable, well-named identifiers

## Testing Requirements

**Minimum coverage: 80%**

Test types (all required):
1. **Unit tests** — Individual functions, utilities, components
2. **Integration tests** — API endpoints, database operations
3. **E2E tests** — Critical user flows

**TDD workflow (mandatory):**
1. Write test first (RED) — test should FAIL
2. Write minimal implementation (GREEN) — test should PASS
3. Refactor (IMPROVE) — verify coverage 80%+

Troubleshoot failures: check test isolation → verify mocks → fix implementation (not tests, unless tests are wrong).

## Development Workflow

1. **Plan** — Use planner agent, identify dependencies and risks, break into phases
2. **TDD** — Use tdd-guide agent, write tests first, implement, refactor
3. **Review** — Use code-reviewer agent immediately, address CRITICAL/HIGH issues
4. **Commit** — Conventional commits format, comprehensive PR summaries

## Tool Capability Docs

When working on cross-tool behavior for Claude Code, Cursor, Codex, or OpenCode:

- Treat `docs/supported-tools.md` and `docs/tools/` as the repo's capability source of truth.
- Read `docs/tools/capability-matrix.md` and the relevant per-tool page before making claims about hooks, skills, commands, agents, rules, memory, or MCP support.
- Do not assume a Claude-native feature maps directly to another tool just because MDT has an adapter file for it.
- If capability docs need to be updated, use `skills/tool-doc-maintainer/SKILL.md` and follow its verification workflow before changing support labels.
- Files outside `docs/tools/` may be stale; verify tool capability claims against the docs pack, local CLI behavior, and official vendor docs before repeating them.

## Git Workflow

**Commit format:** `<type>: <description>` — Types: feat, fix, refactor, docs, test, chore, perf, ci

**PR workflow:** Analyze full commit history → draft comprehensive summary → include test plan → push with `-u` flag.

## Architecture Patterns

**API response format:** Consistent envelope with success indicator, data payload, error message, and pagination metadata.

**Repository pattern:** Encapsulate data access behind standard interface (findAll, findById, create, update, delete). Business logic depends on abstract interface, not storage mechanism.

**Skeleton projects:** Search for battle-tested templates, evaluate with parallel agents (security, extensibility, relevance), clone best match, iterate within proven structure.

## Performance

**Context management:** Avoid last 20% of context window for large refactoring and multi-file features. Lower-sensitivity tasks (single edits, docs, simple fixes) tolerate higher utilization.

**Build troubleshooting:** Use build-error-resolver agent → analyze errors → fix incrementally → verify after each fix.

## Project Structure

```
agents/          — Specialized subagents and role prompts
skills/          — Workflow skills and domain knowledge
commands/        — Markdown command prompts
docs/tools/      — Cross-tool capability docs and verification guidance
hooks/           — Trigger-based automations
rules/           — Always-follow guidelines (common + per-language)
scripts/         — Cross-platform Node.js utilities
mcp-configs/     — MCP server registry configuration
tests/           — Test suite
```

## Success Metrics

- All tests pass with 80%+ coverage
- No security vulnerabilities
- Code is readable and maintainable
- Performance is acceptable
- User requirements are met

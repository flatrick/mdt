# MDT for Codex CLI

This supplements the root `AGENTS.md` with Codex-specific guidance.

## Model Recommendations

| Task Type | Recommended Model |
|-----------|------------------|
| Routine coding, tests, formatting | o4-mini |
| Complex features, architecture | o3 |
| Debugging, refactoring | o4-mini |
| Security review | o3 |

## Skills Discovery

Skills are auto-loaded from `.codex/skills/`. Each skill contains:
- `SKILL.md` — Detailed instructions and workflow
- `agents/openai.yaml` — Codex interface metadata

Available skills:
- tdd-workflow — Test-driven development with 80%+ coverage
- security-review — Comprehensive security checklist
- coding-standards — Universal coding standards
- frontend-patterns — React/Next.js patterns
- frontend-slides — Viewport-safe HTML presentations and PPTX-to-web conversion
- backend-patterns — API design, database, caching
- e2e-testing — Playwright E2E tests
- eval-harness — Eval-driven development
- strategic-compact — Context management
- api-design — REST API design patterns
- verification-loop — Build, test, lint, typecheck, security

MDT development installs (`--dev`) additionally materialize:
- smoke — Run the installed MDT Codex smoke checks
- tool-setup-verifier — Smoke-check MDT tool adapters and workflow contracts
- tool-doc-maintainer — Keep MDT's cross-tool capability docs aligned with reality

## MCP Servers

Configure optional MCP servers in `~/.codex/config.toml` under `[mcp_servers]`.
MDT does not enable any Codex MCP servers by default.

## Codex Security Model

Codex security enforcement in MDT is instruction-based:
1. Always validate inputs at system boundaries
2. Never hardcode secrets — use environment variables
3. Run `npm audit` / `pip audit` before committing
4. Review `git diff` before every push
5. Use `sandbox_mode = "workspace-write"` in config

# Codex Delegation Example

This example shows how MDT should model delegated or role-based behavior for Codex.

## Example Shape

Repo-wide Codex guidance is expressed through layered [`.codex/AGENTS.md`](../../../../.codex/AGENTS.md):

```md
## Model Recommendations

| Task Type | Recommended Model |
|-----------|------------------|
| Routine coding, tests, formatting | o4-mini |
| Complex features, architecture | o3 |
```

When a skill needs Codex-specific interface metadata, the add-on may also include a file like:

```yaml
interface:
  display_name: "TDD Workflow"
  short_description: "Test-driven development with 80%+ coverage"
policy:
  allow_implicit_invocation: true
```

That shape lives inside a Codex skill add-on such as `codex-template/skills/<name>/agents/openai.yaml`.

## Why This Is Different From Claude

- Codex does not use the top-level `agents/*.md` directory as its native agent definition model.
- MDT expresses Codex delegation primarily through layered instructions and skill-local Codex metadata.

## Authoring Implication

If you want a Codex workflow to feel role-specific:

- start with `.codex/AGENTS.md`
- add skill-local Codex metadata only when needed
- do not document top-level `agents/*.md` as the native Codex surface

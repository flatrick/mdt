# Package-Manifest Install Model

Date: 2026-03-09
Status: Historical design note

## Summary

The current installer chooses much of its behavior indirectly from `rules/` and
from hardcoded path logic inside `scripts/install-mdt.js`. That model is now too
implicit.

Example failure:

```text
node scripts/install-mdt.js --target cursor typescript
```

can install unrelated skills because Cursor skill install is currently driven by
path copying rather than by an explicit install bundle definition.

This note captured the design direction before package manifests were implemented.
The repo now uses package manifests for install selection. Prefer:

- [docs/package-manifest-schema.md](./package-manifest-schema.md)
- [docs/INSTALLATION.md](./INSTALLATION.md)
- [NEXT-STEPS.md](../NEXT-STEPS.md)

For the preserved intermediate design draft, see:

- [docs/package-manifest-v1.md](./package-manifest-v1.md)

## Pre-v1 Operating Rule

Until a commit is tagged `v1.0.0`, install layout is allowed to change.

That means:

- do not preserve intermediate migration workflows for installer layout changes
- do not keep compatibility shims just to carry older partial installs forward
- assume the supported update path is: start fresh and run `node scripts/install-mdt.js`

This design should optimize for clarity and explicitness, not upgrade-path
stability across pre-v1 revisions.

## Problems With The Old Model

### 1. Install scope is implicit

Today, language arguments are discovered from `rules/`, but actual install
content comes from several different places:

- `rules/`
- `skills/`
- `commands/`
- per-tool template directories
- hardcoded installer branches

That makes it hard to answer a basic question: “what does `typescript` install?”

### 2. Tool differences are scattered

Cursor, Claude, Codex, and Gemini all have different install surfaces,
but those differences are mostly encoded in installer conditionals instead of in
data.

### 3. Skills/commands/hooks do not map cleanly to language names

Not everything should be selected by language.

Some installable bundles are better described as:

- `typescript`
- `python`
- `frontend`
- `backend`
- `security`
- `verification`

Using `rules/` as the install-selection anchor makes those broader bundles
awkward.

### 4. Testability is weaker than it should be

The installer should be easy to test with assertions like:

- package `typescript` includes these Cursor rules
- package `typescript` does not install Rust-oriented skills into `.cursor/`
- package `frontend` installs these commands and skills

That is much easier if package composition is explicit data.

## Proposed Model (Implemented Direction)

Add a `packages/` directory containing install manifests.

Suggested structure:

```text
packages/
  typescript/
    package.json
  python/
    package.json
  frontend/
    package.json
  backend/
    package.json
```

Each package manifest defines the install bundle directly.

## Manifest Shape

Initial suggested shape:

```json
{
  "name": "typescript",
  "description": "Base TypeScript development workflow package",
  "rules": [
    "common/coding-style.md",
    "common/testing.md",
    "typescript/coding-style.md",
    "typescript/testing.md"
  ],
  "skills": [
    "coding-standards",
    "tdd-workflow",
    "verification-loop"
  ],
  "commands": [
    "plan.md",
    "tdd.md",
    "verify.md",
    "code-review.md"
  ],
  "hooks": [],
  "tools": {
    "claude": {
      "skills": [
        "coding-standards",
        "tdd-workflow",
        "verification-loop"
      ]
    },
    "cursor": {
      "rules": [
        "common-coding-style.md",
        "common-testing.md",
        "typescript-coding-style.md",
        "typescript-testing.md"
      ],
      "skills": [
        "frontend-slides"
      ],
      "commands": []
    },
    "codex": {}
  }
}
```

The exact schema can change, but the key requirement is that install composition
is explicit and tool-aware.

## Source-Of-Truth Rules

The package manifests should describe install composition, not replace the
underlying content directories.

Source assets stay where they belong:

- `rules/` remains the source for shared and language rule content
- `skills/` remains the source for shared skill content
- `commands/` remains the source for shared command content
- `hooks/` and `scripts/` remain the source for shared hook/runtime logic
- `claude-template/`, `cursor-template/`, and `codex-template/` remain the
  source for per-tool template assets

`packages/` should only decide what gets installed together.

## Installer Behavior

`scripts/install-mdt.js` should move from “languages plus hardcoded copy rules”
to “selected packages plus tool-aware install resolution”.

Target behavior:

1. Parse requested package names from CLI args.
2. Load package manifests from `packages/`.
3. Resolve the selected target tool.
4. Build an install plan by combining:
   - shared package entries
   - tool-specific package overrides
   - tool runtime constraints such as Cursor global rules being unsupported
5. Copy only the declared assets.

## CLI Direction

Pre-v1, keep the current CLI shape if useful:

```text
node scripts/install-mdt.js typescript
node scripts/install-mdt.js --target cursor typescript
```

But reinterpret the positional args as package names rather than “languages
derived from `rules/`”.

That keeps the UX stable while changing the internal model.

Possible later expansion:

```text
node scripts/install-mdt.js --target cursor typescript frontend
```

This should mean “install the `typescript` package plus the `frontend` package”.

## First Implementation Slice (Completed)

Keep the first slice narrow.

### Slice goal

Prove the package model solves the current Cursor skill-selection bug without
rewriting the whole installer in one pass.

### Slice steps

1. Add `packages/typescript/package.json`.
2. Teach `scripts/install-mdt.js` to resolve `typescript` from `packages/`.
3. Switch Cursor skill install logic to install only what the selected package
   declares for Cursor.
4. Keep the rest of the installer behavior as close as possible to current
   behavior.
5. Add tests proving:
   - `--target cursor typescript` installs only declared Cursor skills
   - unrelated skills are not copied into `.cursor/skills/`

## Testing Plan

Add or update tests around `scripts/install-mdt.js`:

- unit tests for package manifest loading and dry-run planning
- install tests that render into a temp workspace
- negative tests confirming unrelated assets are not installed

Minimum expected assertions for the first slice:

- `node scripts/install-mdt.js --target cursor typescript` installs declared
  Cursor rules
- it installs only declared Cursor skills
- it does not copy the whole shared `skills/` tree into `.cursor/skills/`
- dry-run output reports selected packages instead of “languages from `rules/`”

## Risks

### 1. Schema drift

If package manifests are added without validation, they will drift.

Mitigation:

- add a schema or validator early
- test every package manifest in CI

### 2. Duplication

Tool-specific overrides can duplicate shared entries if the schema is clumsy.

Mitigation:

- keep the initial schema small
- prefer additive tool overrides

### 3. Behavior change for existing users

Some users may rely on today’s overly broad installs.

Mitigation:

- accept this as a pre-v1 change
- document fresh reinstall as the supported path

## Open Questions

- Should package names stay language-oriented, or should workflow/domain package
  names be first-class from the start?
- Should shared skills be referenced directly from package manifests, or should
  tools be forced to reference only tool-template skill surfaces?
- Should package manifests allow dependency composition, for example `frontend`
  depending on `typescript`?

## Recommendation

Do not try to solve all package semantics in one pass.

Implement the first slice to fix install selection for Cursor, prove the model
works, and then expand package coverage gradually.

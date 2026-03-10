# Package Manifest v1 Draft

Date: 2026-03-09
Status: Draft

## Summary

MDT package manifests should become the explicit install contract for package composition.

That contract needs to support three different package roles:

- language packages such as `typescript`, `python`, and `rust`
- scaffolding packages such as `frontend`, `backend`, `security`, and `verification`
- capability packages such as `continuous-learning`, `context-compaction`, and other MDT-native LLM workflow behaviors

Scaffolding packages exist to encode the universal MDT pattern that new languages should inherit from.
Language packages then add language-specific rules, skills, commands, agents, and tool overlays on top.
Capability packages exist to encode what MDT itself brings to LLM-assisted development:
hooks, session learning, context management, runtime automation, and other agent-oriented behavior.

## Goals

- make install composition explicit and inspectable
- remove remaining installer inference from `rules/` and filename prefixes
- let new language support follow a standard MDT package shape
- make it possible for a future “add language support” workflow to scaffold a new package instead of inventing structure ad hoc
- keep the schema small enough that it is easy to validate and test

## Non-Goals

- do not turn manifests into a general-purpose build system
- do not add per-tool fields unless the repo has a real install surface for them
- do not preserve pre-`v1.0.0` migration compatibility for old install layouts

## Package Roles

### Language Packages

Examples:

- `typescript`
- `python`
- `rust`
- `dotnet`

Language packages define what is specific to that language,
while reusing scaffolding packages for common MDT workflow patterns.

### Scaffolding Packages

Examples:

- `frontend`
- `backend`
- `security`
- `verification`

Scaffolding packages define reusable MDT workflow bundles that should be available to many languages.
They should be installable on their own and also composable into language packages.

These are not just labels.
They should be first-class packages with their own manifests, validation, and install semantics.

### Capability Packages

Examples:

- `continuous-learning`
- `context-compaction`
- `session-evaluation`
- `cost-tracking`
- `hook-automation`
- `agent-orchestration`

Capability packages describe MDT-native LLM workflow behavior.
They are not tied to a language like `typescript`, and they are not the same
thing as domain scaffolding like `frontend` or `backend`.

These packages should also be first-class, installable, and composable.
For continuous-learning style capabilities, the design goal should be signal
quality over event volume: sparse capture first, then retrospective analysis
that surfaces automation opportunities.

Two concrete examples already fit this model:

- `continuous-learning`
  - owns `skills/continuous-learning-manual`
  - owns the instinct-management commands such as `/instinct-status`, `/evolve`, `/instinct-export`, `/instinct-import`, `/promote`, and `/projects`
  - depends on hook wiring, runtime scripts, and writable session data storage
  - should prioritize detecting candidates for scripts, custom commands, and
    MCP integrations over recording every low-value interaction
- `context-compaction`
  - owns `skills/strategic-compact`
  - depends on compaction-related hook/runtime behavior such as `scripts/hooks/suggest-compact.js` and `scripts/hooks/pre-compact.js`
  - is generally useful even when continuous learning is not installed

## Proposed Manifest Shape

```json
{
  "name": "typescript",
  "description": "Base TypeScript workflow package",
  "kind": "language",
  "extends": [
    "verification",
    "security",
    "frontend",
    "continuous-learning",
    "context-compaction"
  ],
  "rules": [
    "common/coding-style.md",
    "typescript/coding-style.md"
  ],
  "agents": [
    "planner.md",
    "code-reviewer.md"
  ],
  "commands": [
    "plan.md",
    "verify.md"
  ],
  "skills": [
    "coding-standards",
    "tdd-workflow"
  ],
  "tools": {
    "cursor": {
      "rules": [
        "common-coding-style.md",
        "typescript-coding-style.md"
      ],
      "skills": [
        "frontend-slides"
      ]
    },
    "gemini": {
      "rules": [
        "common-coding-style.md",
        "typescript-coding-style.md"
      ]
    }
  }
}
```

## Field Semantics

### `name`

- must equal the manifest directory name
- is the package identifier used by `install-mdt.js`

### `description`

- short human-readable package purpose

### `kind`

Allowed initial values:

- `language`
- `scaffolding`
- `capability`

This is documentation and validation metadata first.
It should not drive different installer behavior in the first implementation.

### `extends`

- optional array of package names
- used to compose scaffolding and capability packages into language packages
- installer should resolve these recursively before installation
- cycles must be rejected

### `rules`

- shared rule files under `rules/`
- explicit source of truth for Claude/shared rule selection

### `agents`

- shared agent files under `agents/`

### `commands`

- shared command files under `commands/`

### `skills`

- shared skill directories under `skills/`

### `tools`

Tool-specific overlays. Only fields backed by real repo assets should exist.

Current candidates:

- `tools.claude.skills`
- `tools.cursor.rules`
- `tools.cursor.skills`
- `tools.codex.skills`
- `tools.gemini.rules`

Not yet justified:

- `tools.cursor.commands`
- `tools.codex.rules`
- `tools.opencode.*`

Those should wait until the repo has a real install surface and installer path
for them.

### `requires`

This field is optional for packages that are just asset bundles, but it becomes
mandatory once a package declares runtime capability flags such as `hooks`,
`runtimeScripts`, or `sessionData`.

Example shape:

```json
{
  "requires": {
    "hooks": true,
    "runtimeScripts": true,
    "tools": ["claude", "cursor"]
  }
}
```

This would let packages declare constraints such as:

- hook infrastructure is required
- runtime scripts must be installed
- only certain currently implemented installer targets support the capability

That is especially relevant for capability packages like continuous learning and
intelligent context compaction.

For example, the current first-pass capability manifests can already declare:

```json
{
  "name": "continuous-learning",
  "kind": "capability",
  "skills": ["continuous-learning-manual"],
  "commands": [
    "instinct-status.md",
    "evolve.md",
    "instinct-export.md",
    "instinct-import.md",
    "promote.md",
    "projects.md"
  ],
  "requires": {
    "runtimeScripts": true,
    "sessionData": true,
    "tools": ["claude", "cursor", "codex"]
  }
}
```

And:

```json
{
  "name": "context-compaction",
  "kind": "capability",
  "skills": ["strategic-compact"],
  "requires": {
    "hooks": true,
    "runtimeScripts": true,
    "sessionData": true,
    "tools": ["claude", "cursor"]
  }
}
```

`requires` should become the place where the package model says “this package is
not only a rule/skill bundle; it also assumes hook execution and writable runtime
state.”

For v1, `requires.tools` should describe current installer support, not a
permanent product truth. If a capability should later work in Codex or another
tool, that should be added when the repo has a real install/runtime path for it.

## Merge Rules

When a package extends other packages:

1. Resolve base packages first, depth-first.
2. Merge arrays by stable union, preserving first-seen order.
3. Child package entries append to inherited entries.
4. Tool-specific arrays follow the same stable-union rule.
5. Scalars such as `description` and `kind` are not inherited for output; they
   remain metadata for the package being requested.

Example:

- `verification` contributes shared `verify.md`, `verification-loop`, and common testing rules
- `security` contributes `security-reviewer.md`, `security-review`, and security rules
- `continuous-learning` contributes MDT-native hook/runtime behavior
- `typescript` extends all of the above and then adds TypeScript-specific rules and assets

The effective installed asset set is the resolved union.

## Validation Rules

At minimum, validation should enforce:

- package name matches directory
- `kind` is one of the allowed values
- `extends` references existing packages
- no cyclic `extends`
- `rules`, `agents`, `commands`, `skills` reference real assets
- tool-specific rule/skill entries reference real tool assets
- if `requires` exists, it must match the supported schema
- if `requires.hooks`, `requires.runtimeScripts`, or `requires.sessionData` is set,
  `requires.tools` must also be provided

## Installer Resolution Model

`scripts/install-mdt.js` should eventually behave like this:

1. Parse selected package names.
2. Load manifests.
3. Resolve `extends`.
4. Build the effective package composition.
5. Install exactly the declared shared and tool-specific assets.

This means manifests, not directory naming conventions, decide install scope.

## New Language Scaffolding

Future “add language support” commands or skills should scaffold a new language package by following MDT package conventions.

Target workflow:

1. Create `packages/<language>/package.json`.
2. Set `kind: "language"`.
3. Add `extends` pointing to the standard scaffolding and capability packages.
4. Scaffold language rule files in `rules/<language>/`.
5. Add any real tool-specific overlays if those surfaces exist.
6. Add validator and installer coverage.

That gives the LLM a stable shape to fill out instead of having it invent a new install model each time.

## Initial Recommended Scaffolding Packages

Candidate first set:

- `verification`
- `security`
- `backend`
- `frontend`

## Initial Recommended Capability Packages

Candidate first set:

- `continuous-learning`
- `context-compaction`
- `session-evaluation`
- `cost-tracking`
- `hook-automation`

`continuous-learning` and `context-compaction` are the right first real
capability packages because they already map to concrete MDT behavior that is not
language-specific and not domain-specific.

Possible later addition:

- `core`

`core` would hold the most universal MDT behaviors if separating them from domain-oriented scaffolding becomes useful.
This does not need to exist in the first version.

## Open Questions

- Should `kind` stay purely descriptive, or eventually affect CLI help and docs?
- Should `extends` order be user-authored and preserved exactly, or normalized?
- Should the installer accept direct installs of scaffolding packages, or only language packages at first?
- Should the installer accept direct installs of capability packages, or should some of them only be composed through language/scaffolding packages?
- Should `requires` be part of v1, or only added once capability packages begin declaring hook/runtime/tool constraints?
- Should `core` exist from the beginning, or only if common/shared packages get too broad?

## Recommendation

The next implementation step should not be “add all scaffolding packages”.

The next step should be:

1. accept this v1 direction
2. add `extends` support to manifest parsing and validation
3. keep the existing language packages working
4. only then introduce the first real scaffolding packages

That keeps the design explicit without forcing a broad package migration in one shot.

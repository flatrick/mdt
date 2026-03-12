# Package Manifest Schema

This page documents the current MDT package-manifest contract implemented by:

- `scripts/install-mdt.js`
- `scripts/ci/validate-install-packages.js`

Use this page for current truth. Historical design context lives in
[docs/package-manifest-v1.md](./package-manifest-v1.md) and
[docs/packages-install-model.md](./packages-install-model.md).

## Summary

Each installable package lives under `packages/<name>/package.json`.

Manifests control what gets installed together. They do not replace the source
asset directories under `rules/`, `agents/`, `commands/`, `skills/`, or the
per-tool template directories.

## Current Shape

```json
{
  "name": "continuous-learning",
  "description": "MDT capability package for instinct-based session learning",
  "kind": "capability",
  "ruleDirectory": "common",
  "extends": [],
  "rules": ["common/testing.md"],
  "agents": [],
  "commands": ["learn.md"],
  "skills": ["continuous-learning-manual"],
  "tools": {
    "claude": {
      "skills": ["continuous-learning-automatic"]
    },
    "cursor": {
      "rules": ["common-testing.mdc"],
      "skills": ["continuous-learning-automatic"],
      "commands": ["learn.md"]
    },
    "codex": {
      "rules": ["common-testing.md"],
      "skills": ["continuous-learning-manual"],
      "scripts": ["codex-observer.js"]
    },
    "gemini": {
      "rules": ["common-testing.mdc"]
    }
  },
  "requires": {
    "runtimeScripts": true,
    "sessionData": true,
    "tools": ["claude", "cursor", "codex"]
  }
}
```

## Field Semantics

### `name`

- required
- must equal the manifest directory name
- is the package identifier accepted by `install-mdt.js`

### `description`

- required
- short human-readable package purpose

### `kind`

- optional in parsing, but validated when provided
- allowed values: `language`, `scaffolding`, `capability`
- currently metadata for docs/validation, not a behavior switch

### `ruleDirectory`

- required
- names the matching directory under `rules/`
- used for package discovery/reporting and must exist

### `extends`

- optional array of package names
- resolved depth-first
- cycles are rejected

### `rules`

- required array
- shared rule paths under `rules/`

### `agents`

- required array
- shared agent files under `agents/`

### `commands`

- required array
- shared command files under `commands/`

### `skills`

- required array
- shared skill directories under `skills/`
- referenced skills must include `skill.meta.json`

### `tools`

- required object
- only real install surfaces should be represented

Supported subfields today:

- `tools.claude.skills`
- `tools.cursor.rules`
- `tools.cursor.skills`
- `tools.cursor.commands`
- `tools.codex.rules`
- `tools.codex.skills`
- `tools.codex.scripts`
- `tools.gemini.rules`

Validation is intentionally asymmetric by tool because MDT does not ship the
same native surface everywhere.

### `requires`

- optional object
- supported keys:
  - `hooks`
  - `runtimeScripts`
  - `sessionData`
  - `tools`
- if any capability flag is `true`, `requires.tools` must also be provided

`requires.tools` documents current supported installer targets, not a permanent
product promise.

## Merge Rules

When a package uses `extends`:

1. parent packages resolve first, depth-first
2. arrays merge by stable union, preserving first-seen order
3. child arrays append to inherited arrays
4. tool-specific arrays use the same stable-union behavior
5. `requires` capability flags merge by union
6. `requires.tools` merges by intersection when both parent and child declare it

The effective install surface is the resolved union.

## Validation Rules

At minimum, validation enforces:

- package name matches directory
- `description` is non-empty
- `ruleDirectory` exists under `rules/`
- `kind` is allowed when provided
- `extends` references existing packages and does not cycle
- shared asset references exist
- tool-specific asset references exist
- referenced skills include `skill.meta.json`
- `requires` matches the supported schema

Run:

```bash
node scripts/ci/validate-install-packages.js
```

## Current Operating Notes

- normal installs are global-first and target the tool config root
- pre-`v1.0.0`, assume reinstall rather than in-place migration
- package manifests describe install composition; capability docs still belong in
  `docs/tools/` and related current-state docs

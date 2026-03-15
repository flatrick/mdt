# Template Add-On and Config-Fragment Contracts

This document defines the template-root add-on allowlist and the per-tool config-fragment contract. It is derived from the [Install Schema and Location Discovery](plans/details/20260314.02.04.install-schema-and-location-discovery.md) plan (Q5 and Q6).

## Template-Root Add-On Contract

### Layout

Each `{tool}-template/` folder **mirrors the output structure** that will end up under `~/.{tool}/` (or wherever that tool expects its files). For example, `codex-template/skills/ai-learning/` maps to `~/.codex/skills/ai-learning/` at install time.

### Allowlist (fixed)

Add-on directories may contain **only** the following. No full duplicate of `scripts/` or other runtime trees.

| Allowed | Examples |
|--------|----------|
| **Metadata** | `skill.meta.json` |
| **Docs** | `SKILL.md`, `STYLE_PRESETS.md` |
| **Config** | `config.json` |
| **agents/** | Agent definition files |
| **rules/** | Rule files |

Disallowed in add-ons: `scripts/`, full runtime trees, or any file type not in the allowlist.

### Enforcement

- **E2E testing:** Install to a temporary folder and assert that only allowlisted file types and directories appear in add-on-derived output. This is the primary enforcement (e.g. R8 mitigation).
- **Installer:** The installer does **not** validate the allowlist at install time. It only fails if it cannot find something it expects or if file copy operations fail.

---

## Config-Fragment Contract

### Format and location

Config fragments use each tool’s **native format** (no single format across tools). They live in `{tool}-template/`, **co-located** with the artifact they configure:

- **Tool-level config** → template root (e.g. `codex-template/config.toml`).
- **Skill-level config** → next to the skill in that template (e.g. `codex-template/skills/ai-learning/config.json`).

Config fragments are **not** under `metadata/` so the relationship between config and artifact stays obvious.

### Merge behavior

1. **Back up** the user’s existing config file.
2. **Merge** the fragment into the user’s config. Exact merge semantics (overlay by key, concatenation, etc.) are **per-tool** and must be defined in the installer or tool support map.

### Per-tool example

| Tool   | Fragment path (repo)                               | Target (user)              | Format | Merge |
|--------|----------------------------------------------------|----------------------------|--------|--------|
| Codex  | `codex-template/config.toml`                       | `~/.codex/config.toml`     | TOML   | Backup target; merge fragment keys into user config (or write `.mdt.toml` when preserving user file). |
| Codex  | `codex-template/skills/ai-learning/config.json`    | skill config at install dest | JSON | Backup then overlay by key. |
| Cursor | `cursor-template/...` (tool/skill config)           | tool config root / skill dir | per Cursor | Backup then merge; semantics per Cursor contract. |

Implementers should resolve exact target paths and merge rules from the tool support map or installer docs per tool.

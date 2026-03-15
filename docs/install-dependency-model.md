# Install Dependency and Tool Support Model

This document is the implementer-facing summary of the dependency sidecar schema, vocabulary, and merge/precedence rules. It is derived from the [Install Schema and Location Discovery](plans/details/20260314.02.04.install-schema-and-location-discovery.md) plan and is the source of truth for resolver and validator behavior.

## Vocabulary (v0.0.1)

- **Dependency types (requires):** `rule`, `skill`, `command`, `agent` — MDT artifacts that must be present.
- **Capability types (capabilities):** `hooks`, `runtimeScripts`, `sessionData`, `tools`, `mcp` — what the tool must support. Support maps use the same IDs and assign a status per tool (`official`, `experimental`, `repo-adapter`, `unsupported`).
- **Tool IDs:** `claude`, `cursor`, `codex`.

## Dependency Sidecar Schema (v0.0.1)

- **Co-located** with the artifact (e.g. `package.deps.json` next to `package.json`, or `skill.deps.json` next to skill dir).
- **Top-level:** `version` (string, e.g. `"0.0.1"`), `requires` (array), `capabilities` (array), optional `tools` (object keyed by tool id).
- **Entry shape:** Each entry has at most: `type` (required), `optional` (boolean, default false), `id` (optional), `params` (optional, type-specific). No type-specific top-level keys.
- **Per-tool overrides:** `tools.<toolId>` may contain `requires` and/or `capabilities` arrays. **Key-level replacement:** if `tools.codex` has `capabilities`, that array replaces the default `capabilities` entirely for Codex; keys absent in the override inherit the default array. No array union.
- **Capability optional:** Capability entries may set `optional: true`. Optional capabilities trigger warn+skip when unsupported or experimental; required capabilities follow the fail hierarchy below.

## Fail Hierarchy

- **Required + unsupported** → hard fail (install rejected).
- **Required + experimental** → fail unless `--experimental` flag (non-zero exit; distinct message from "capability absent").
- **Optional + unsupported or experimental** → warn and skip (install continues).
- **MCP exception:** The installer **warns but never hard-fails** for MCP capability requirements, regardless of `featureStatus.mcp` in the tool support map. Document this in tool support map validators (e.g. `scripts/ci/validate-support-maps.js`) and in resolver/installer logic. Rationale: MCP is instance-dependent — users configure their own MCP servers and MDT cannot know at install time which servers are available.

## Merge and Precedence Rules

- **Package vs sidecar requires/capabilities:** Union across closure. Required = union; optional = union; both express intent.
- **Tool support map vs required:** The tool support map is **authoritative for installability**. Package/sidecar express intent. When a required capability is unsupported on the tool → fail install. When required capability is experimental → require `--experimental` to install.
- **Resolver order:** (1) packages → (2) transitive sidecar closure → (3) tool baseline → (4) per-tool add-ons.

## Tool Support Maps

- **Location:** `metadata/tools/<tool>.json` (e.g. `metadata/tools/claude.json`).
- **Structure:** `baseline` (e.g. `skills`, `commands`, `rules` arrays) and `featureStatus` (per capability/artifact type: `status`, optional `toolRealization`). Status values align with `docs/tools/capability-matrix.md`.

## Load-Bearing Entrypoints

An entrypoint is **load-bearing** (and gets a dependency sidecar) if and only if it is referenced by a package manifest (`rules`, `commands`, `skills`, or `tools.<tool>.scripts`), by a hook configuration, or by a tool support map baseline. Scripts only invoked by other scripts are not load-bearing unless something else references them.

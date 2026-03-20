# MDT Authoring Guide

Use this page when you are adding or changing MDT contributor-owned surfaces for Claude Code, Cursor, or Codex.

Read this page with:

- [capability-matrix.md](./capability-matrix.md) for audited support status
- [workflow-matrix.md](./workflow-matrix.md) for workflow-level mappings
- [surfaces/README.md](./surfaces/README.md) for surface-by-surface cross-tool comparisons
- the per-tool pages when a tool has important limits or exceptions

Repo structure note:

- root [AGENTS.md](../../AGENTS.md) is the repo-wide contract
- nearest local `AGENTS.md` files add subtree-specific guidance for directories such as `docs/`, `commands/`, `skills/`, `hooks/`, and `workflow-contracts/`
- nearby `README.md` files stay the deeper human-facing reference; local `AGENTS.md` files stay short and operational
- these layered repo `AGENTS.md` files are for MDT maintainers working in this repository; they are not generic end-user install assets

## What To Create

Start from the workflow outcome, not the tool-native name.

| If you need to add... | Primary MDT surface | Source of truth |
| --- | --- | --- |
| broad reusable policy or standards | rule | `rules/`, plus tool-specific rule overlays where needed |
| a user-invoked workflow prompt | command | `commands/*.md` plus `commands/*.meta.json`; optional Cursor override in `cursor-template/commands/` |
| deeper reusable task guidance | skill | `skills/<name>/SKILL.md` plus `skill.meta.json` |
| a specialized delegated role or agent behavior | agent guidance | `agents/*.md` for shared prompt assets, plus tool-native realization docs |
| event-driven automation | hook | `claude-template/hooks.json` for Claude, `cursor-template/hooks.json` plus `hooks/scripts/` for the Cursor adapter |
| a cross-tool workflow outcome | workflow contract | `workflow-contracts/workflows/*.json` plus the docs/tooling that realize it |

## Surface Matrix

| Surface | Canonical repo files | Claude | Cursor | Codex | Do not assume |
| --- | --- | --- | --- | --- | --- |
| Rules | Shared source in `rules/`; Cursor overlay in `cursor-template/rules/`; Codex flat rule files in `codex-template/rules/` | Native rule/guidance docs and `CLAUDE.md` | Native project rules in `.cursor/rules/` only | Native Codex rules plus layered `AGENTS.md` | Cursor does not read `~/.cursor/rules/`; Codex rule files are not Claude rules |
| Commands | `commands/*.md` plus `commands/*.meta.json`; optional `cursor-template/commands/*.md` override | Native markdown slash commands | Native custom commands | No Claude-style markdown command surface; use skills, `AGENTS.md`, and explicit `mdt` flows | Codex built-in slash commands are session controls, not MDT command files |
| Hooks | `claude-template/hooks.json`; Cursor adapter in `cursor-template/hooks.json` and `hooks/scripts/` | Native | Experimental MDT adapter only | Unsupported as Claude-style hooks | Do not treat Cursor hooks as vendor-native or document hooks for Codex |
| Skills | `skills/<name>/SKILL.md`, `skills/<name>/skill.meta.json`, optional add-on files; Codex add-ons under `codex-template/skills/` when needed | Native skill docs | Native skills | Native skills | A shared skill may still need Codex-specific add-on files or config |
| Agents / sub-agents | `agents/*.md` for shared prompt assets; Codex skill-local agent metadata under `codex-template/skills/<name>/agents/openai.yaml` where applicable | Native subagents | Cursor delegation is via modes/background agents/terminal agent, not Claude subagent files | Codex delegation is driven by `AGENTS.md` and experimental multi-agent support, not `agents/*.md` | Do not describe shared `agents/*.md` as the universal tool-facing agent format |
| Workflows | `workflow-contracts/workflows/*.json`, docs in `docs/tools/`, smoke scripts, manual verification pages | Native or MDT-mapped depending on workflow | MDT-mapped | MDT-mapped | Tool-native surface names are secondary; the workflow outcome is primary |

## How To Author Each Surface

## Rules

Create or update shared rules in `rules/` first.

- Use `rules/common/` for language-agnostic policy.
- Use `rules/<language>/` for language-specific extensions.
- For Cursor, add or update matching files under `cursor-template/rules/` when Cursor needs a different filename, extension, or frontmatter shape.
- For Codex, add or update the flat add-on files under `codex-template/rules/` when the installed Codex surface needs a Codex-specific copy.
- Keep current truth in docs aligned with the audited rule model in [cursor.md](./cursor.md) and [codex.md](./codex.md).

When a new rule becomes install-relevant, also check package manifests under `packages/` and any affected tool support docs.

## Commands

Create shared commands in `commands/`.

- Add `commands/<name>.md`.
- Add `commands/<name>.meta.json` with the supported tool list.
- If Cursor needs different wording or affordances, add `cursor-template/commands/<name>.md` as an override, but keep `commands/<name>.md` as the shared source.
- If the command is installable through packages, add it to the relevant package manifest `commands` arrays.
- Keep command references valid: shared commands can reference `agents/*.md` and `skills/<name>/` paths that actually exist.

Use commands for user-invoked workflow prompts, not for passive guidance.

For a cross-tool comparison, see [surfaces/commands.md](./surfaces/commands.md).

## Hooks

Only author hooks for Claude and the Cursor adapter.

- Update `claude-template/hooks.json` for Claude-native hook behavior.
- Update `cursor-template/hooks.json` only for the experimental Cursor adapter.
- Keep Cursor wrappers small in `hooks/scripts/`.
- Put reusable logic in shared hook/runtime code, not in tool-specific wrappers.
- Run `node scripts/sync-hook-mirrors.js` after changing hook source files so the checked-in mirrors stay aligned.

Do not create hook docs or behavior for Codex unless the audited support status changes and the tool docs are re-verified.

For a cross-tool comparison, see [surfaces/hooks.md](./surfaces/hooks.md).

## Skills

Create skills in `skills/<name>/`.

Required baseline:

- `skills/<name>/SKILL.md`
- `skills/<name>/skill.meta.json`

Optional companions:

- `config.json`
- `agents/`
- tool add-ons such as `codex-template/skills/<name>/`

Rules for skills:

- `SKILL.md` must contain a heading and a `When to Use` or `When to Activate` section.
- `skill.meta.json` must keep `requires.rules`, `requires.skills`, and runtime requirements accurate.
- If Codex needs tool-specific metadata such as `codex-template/skills/<name>/agents/openai.yaml` or a tool-specific config overlay, add it in `codex-template/skills/<name>/`.
- Template add-on directories are allowlisted: docs, metadata, config, `agents/`, and `rules/`; do not add full runtime trees there.

Use skills for reusable reference material and guided task execution, not for one-off command wrappers.

For a cross-tool comparison, see [surfaces/skills.md](./surfaces/skills.md).

## Agents / Sub-Agents

Use `agents/*.md` only when the target behavior needs a shared MDT prompt asset and at least one tool realization actually uses that asset directly.

- Add `agents/<name>.md` with valid frontmatter, including `model` and `tools`, when a shared prompt asset is justified.
- Reference the agent from commands or docs only when that agent file exists.
- If a workflow is Claude-native, document the agent as a Claude surface.
- If Cursor or Codex realize the same workflow differently, document their native surfaces separately instead of implying they consume `agents/*.md` directly.
- If the behavior is only a role concept and not a shared prompt asset, document it at the workflow/tool level instead of forcing a new top-level `agents/*.md` file.

For Codex skill-local metadata, keep `codex-template/skills/<name>/agents/openai.yaml` inside the relevant skill add-on rather than adding a top-level Codex `agents/` story that the audited docs do not support.

For a cross-tool comparison, see [surfaces/agents.md](./surfaces/agents.md).

## Workflows

Add or update a workflow contract when you are defining or materially changing an MDT workflow outcome.

Minimum follow-through:

1. Add or update `workflow-contracts/workflows/<name>.json`.
2. Update [workflow-matrix.md](./workflow-matrix.md) so the docs match the machine-readable contract.
3. Update any per-tool page whose realization changed.
4. Update smoke or compatibility coverage if the required files or mappings changed.
5. Update the matching manual-verification page if the runtime behavior changed.

Use workflows to describe cross-tool outcomes such as `plan`, `tdd`, or `verify`. Do not use a tool-native command file as the only definition of a workflow.

## Tool-Specific Notes

### Claude Code

- Shared MDT `agents/*.md`, `commands/*.md`, `skills/*/SKILL.md`, and `claude-template/hooks.json` are real Claude-facing authoring surfaces.
- Keep Claude-specific docs vendor-specific; do not project them onto Cursor or Codex.

See [claude-code.md](./claude-code.md).

### Cursor

- Rules only work from the currently opened project's `.cursor/rules/`; the global install is not a rule-consumption surface.
- Commands are native, but may need Cursor-specific overrides in `cursor-template/commands/`.
- Skills are native.
- Hooks are experimental MDT adapter behavior, not audited vendor-native truth.
- Cursor delegation should be documented in terms of modes, background agents, terminal agent, and `AGENTS.md`, not as direct consumption of `agents/*.md`.

See [cursor.md](./cursor.md).

### Codex

- Use layered `AGENTS.md`, Codex rules, Codex skills, and explicit `mdt` verification/workflow surfaces.
- Shared markdown commands are not a native Codex authoring surface.
- Claude-style hooks are unsupported.
- Codex-specific skill metadata belongs in Codex skill add-ons when required.

See [codex.md](./codex.md).

## Contributor Checklist

When you add a new contributor-facing surface, update the related machine-readable files and docs as needed:

- package manifests under `packages/`
- `commands/*.meta.json`
- `skills/*/skill.meta.json`
- `cursor-template/commands/` override files when Cursor needs different wording
- `cursor-template/rules/` or `codex-template/rules/` when a tool needs a different installed rule shape
- `codex-template/skills/` add-ons when Codex needs tool-specific skill metadata or config
- `workflow-contracts/workflows/*.json`
- `metadata/tools/*.json` if the supported baseline or feature status changed
- `docs/tools/*.md` and `docs/testing/manual-verification/*.md`

## Verification

Run the normal checks for docs that change contributor-facing contracts:

```bash
npm run lint
npm test
mdt verify tool-setups
```

If you changed a workflow mapping or install surface, also run the relevant smoke/manual verification flow from [local-verification.md](./local-verification.md).

## Purpose

Define MDT's shared authoring surfaces and how they map differently onto Claude Code, Cursor, and Codex without collapsing repo assets, tool-native behavior, and MDT adapters into the same concept.

## Requirements

### Requirement: Shared Surface Families Remain Distinct
MDT MUST model its shared authoring surfaces as distinct families rather than flattening them into one generic feature type.

#### Scenario: Surface family is identified explicitly
- **WHEN** MDT documents or implements a shared artifact family
- **THEN** it treats rules, commands, skills, agents, hooks, workflow contracts, and related tool-specific config layers as distinct surface types
- **AND** it does not assume that one surface type can stand in for another without an explicit workflow mapping

### Requirement: Surface Comparison Pages Are Comparison Material
MDT MUST treat the `docs/tools/surfaces/` pages as comparison material rather than as the primary source of truth for support status.

#### Scenario: Comparison page does not override tool page
- **WHEN** a support claim in a surface comparison page conflicts with a per-tool page
- **THEN** the per-tool page remains the source of truth
- **AND** the comparison page is aligned to that per-tool page rather than treated as the stronger authority

### Requirement: Rule Surface Model
MDT MUST treat rules as a first-class contributor surface with a shared source and tool-specific install shapes where required.

#### Scenario: Shared rules start in the shared rules tree
- **WHEN** MDT adds or updates broad reusable policy or standards
- **THEN** the shared source starts in `rules/`
- **AND** tool-specific rule overlays are only added where the audited tool model requires a different installed shape

#### Scenario: Cursor and Codex rule realizations remain distinct
- **WHEN** MDT realizes rule behavior for Cursor or Codex
- **THEN** it preserves their tool-specific installed rule shapes
- **AND** it does not describe Cursor or Codex rule files as the same authoring model as Claude guidance docs

### Requirement: Surface Realization Is Tool-Specific
MDT MUST document and implement each surface family according to the tool's audited native or adapter model.

#### Scenario: Same concept is realized differently across tools
- **WHEN** MDT needs the same workflow outcome on Claude, Cursor, and Codex
- **THEN** it preserves the tool-specific realization for that surface instead of forcing uniform file parity across tools

### Requirement: Agent Surface Boundaries
MDT MUST preserve the distinction between Claude-native agent files and the different delegation models used by Cursor and Codex.

#### Scenario: Claude agent files are not projected onto other tools
- **WHEN** a shared `agents/*.md` file exists
- **THEN** MDT treats it as part of the Claude realization
- **AND** it does not describe that file as direct native consumption by Cursor or Codex

#### Scenario: Codex agent realization uses Codex-native guidance layers
- **WHEN** MDT realizes delegation behavior for Codex
- **THEN** it uses layered `AGENTS.md` guidance and skill-local Codex metadata when needed
- **AND** it does not invent a top-level Claude-style Codex agent file model unless audited support changes

### Requirement: Command Surface Boundaries
MDT MUST preserve the distinction between markdown workflow commands for Claude and Cursor and non-command realizations for Codex.

#### Scenario: Shared markdown commands remain the canonical source for Claude and Cursor
- **WHEN** a user-invoked MDT workflow prompt is modeled for Claude and Cursor
- **THEN** the shared source starts in `commands/*.md`
- **AND** the command has adjacent machine-readable command metadata
- **AND** Cursor-specific overrides are treated as overrides rather than the canonical shared source

#### Scenario: Codex does not use MDT markdown command files as a native surface
- **WHEN** MDT needs the same workflow outcome in Codex
- **THEN** it realizes that outcome through skills, `AGENTS.md`, workflow contracts, or explicit `mdt` flows
- **AND** it does not describe a markdown command file as a native Codex workflow command

#### Scenario: Command metadata declares install targeting
- **WHEN** MDT ships a shared command under `commands/`
- **THEN** adjacent command metadata records the supported tool targeting for that command
- **AND** install or realization logic does not infer cross-tool command support from the markdown file alone

### Requirement: Skill Surface Model
MDT MUST treat the shared skill layout as the baseline skill model and keep Codex overlays minimal and justified.

#### Scenario: Shared skill baseline is authoritative
- **WHEN** MDT creates an installable reusable skill
- **THEN** the skill begins in `skills/<name>/`
- **AND** the shared skill includes the required machine-readable metadata expected by the repo validators

#### Scenario: Codex overlay is additive, not duplicative
- **WHEN** Codex needs extra skill metadata or installed config shape
- **THEN** MDT adds the smallest necessary overlay under `codex-template/skills/<name>/`
- **AND** it does not duplicate a full shared runtime tree there without a documented Codex-specific need

#### Scenario: Skill metadata stays truthful about dependencies and runtime needs
- **WHEN** MDT defines or updates a shared skill
- **THEN** the skill's machine-readable metadata keeps dependency and runtime requirements accurate
- **AND** install or runtime behavior does not rely on undocumented assumptions outside that metadata

### Requirement: Hook Surface Is Not A Cross-Tool Baseline
MDT MUST not treat hook-like automation as a stable cross-tool default.

#### Scenario: Claude hook support remains tool-specific
- **WHEN** MDT authors hook-driven behavior for Claude
- **THEN** it uses the Claude hook surface as a native tool-specific realization

#### Scenario: Cursor hook support remains an adapter
- **WHEN** MDT authors hook-like behavior for Cursor
- **THEN** it treats that behavior as an MDT adapter layer rather than vendor-native parity with Claude hooks

#### Scenario: Codex excludes Claude-style hooks
- **WHEN** the target tool is Codex
- **THEN** MDT does not create or claim support for Claude-style hooks
- **AND** it redesigns the workflow using Codex-native surfaces instead

### Requirement: Workflow Contracts Remain A Separate Surface Family
MDT MUST keep cross-tool workflow contracts separate from the lower-level surfaces that realize them.

#### Scenario: Workflow is not defined only by a command, skill, or rule
- **WHEN** MDT defines or changes a cross-tool workflow outcome
- **THEN** that workflow is captured in `workflow-contracts/workflows/*.json`
- **AND** lower-level surfaces such as commands, skills, rules, or guidance files are treated as realizations of the workflow rather than as its only definition

### Requirement: Workflow Outcome Comes Before Surface Parity
MDT MUST choose surfaces based on the intended workflow outcome rather than on pressure to preserve identical file types across tools.

#### Scenario: Outcome-first design selects different surfaces
- **WHEN** contributors need to realize one MDT workflow across multiple tools
- **THEN** they start from the intended workflow outcome
- **AND** they choose the audited per-tool surface that best realizes that outcome instead of forcing surface parity

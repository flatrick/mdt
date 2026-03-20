## Purpose

Define MDT's ai-learning capability: how learning is packaged and installed, how observation and analysis differ between hook-enabled and hook-free environments, how project-scoped learning state is stored, and how users interact with the supported learning runtime.

## Requirements

### Requirement: AI-Learning Is A First-Class Installable MDT Capability
MDT MUST provide ai-learning as an installable package and shared skill rather than as an ad hoc repo-only workflow.

#### Scenario: Package and skill exist
- **WHEN** ai-learning is offered as part of MDT
- **THEN** it is represented by an installable package manifest and a shared reusable skill

#### Scenario: Runtime requirements are declared
- **WHEN** ai-learning is defined in package and skill metadata
- **THEN** it declares the runtime and session-data requirements needed by the learning system

### Requirement: Shared AI-Learning Skill Is The Canonical Capability Home
MDT MUST keep the shared `skills/ai-learning/` tree as the canonical home of the ai-learning capability.

#### Scenario: Shared skill remains the primary source
- **WHEN** maintainers update ai-learning behavior, guidance, scripts, hooks, or metadata
- **THEN** the primary capability definition lives under `skills/ai-learning/`
- **AND** ai-learning is not split into multiple competing top-level capability homes

#### Scenario: Package manifest selects the capability rather than redefining it
- **WHEN** `packages/ai-learning/package.json` includes ai-learning
- **THEN** it selects and composes the shared ai-learning capability for installation
- **AND** it does not act as a second canonical definition of ai-learning behavior

### Requirement: Codex AI-Learning Overlay Is Additive
MDT MUST treat `codex-template/skills/ai-learning/` as a Codex-specific overlay rather than as a separate ai-learning implementation.

#### Scenario: Codex overlay adjusts Codex-specific shape only
- **WHEN** Codex needs ai-learning-specific metadata, config, or agent add-ons
- **THEN** those differences are expressed in the Codex ai-learning overlay
- **AND** the overlay remains additive to the shared ai-learning capability rather than a competing source model

#### Scenario: Codex overlay does not reintroduce unsupported capture semantics
- **WHEN** Codex-specific ai-learning files differ from the shared skill
- **THEN** those differences preserve the manual-first Codex model
- **AND** they do not reintroduce hook-style automatic capture as if Codex supported it

### Requirement: Tool Mode Split For Observation
MDT MUST preserve the different observation models for hook-enabled and hook-free environments.

#### Scenario: Hook-enabled tools use passive observation
- **WHEN** ai-learning runs in a hook-enabled environment such as Claude or Cursor
- **THEN** observation is designed around passive hook capture
- **AND** the observer can analyze accumulated observations through the supported runtime

#### Scenario: Hook-free tools use explicit capture
- **WHEN** ai-learning runs in Codex or another hook-free environment
- **THEN** observation is explicit and manual
- **AND** the supported flow uses `mdt learning capture` and `mdt learning analyze` rather than pretending passive hook capture exists

### Requirement: Supported Runtime Entry Points
MDT MUST route ai-learning actions through the supported runtime entry points instead of encouraging direct file authoring.

#### Scenario: Learn command uses the supported pipeline
- **WHEN** a user invokes `/learn`
- **THEN** MDT treats it as the user-facing entrypoint to the supported ai-learning runtime
- **AND** it does not bypass the runtime by drafting instinct or learned-skill files directly

#### Scenario: Instinct management and learning analysis stay separated
- **WHEN** a user requests instinct management actions such as status, export, import, promote, evolve, or projects
- **THEN** MDT routes those actions through the instinct-management entrypoints
- **AND** analysis and capture actions remain part of the `mdt learning ...` runtime flow

#### Scenario: Runtime entrypoints stay coherent across install surfaces
- **WHEN** ai-learning is invoked through commands, skill guidance, or installed-home equivalents
- **THEN** those surfaces route to the same supported runtime model
- **AND** maintainers do not document parallel ad hoc entrypoints that bypass the shared ai-learning flow

### Requirement: Project-Scoped Learning State
MDT MUST store ai-learning state in a project-scoped structure with a documented global fallback model.

#### Scenario: Project-specific state is isolated
- **WHEN** ai-learning records observations, instincts, retrospectives, or evolved artifacts for a detected project
- **THEN** it stores that state under the project's directory within MDT-owned learning data

#### Scenario: Global fallback remains available
- **WHEN** no project-specific distinction applies or a global artifact is needed
- **THEN** ai-learning uses the documented global learning state areas under MDT-owned data

### Requirement: Project Detection Determines Learning Scope
MDT MUST use project detection to anchor project-scoped learning state.

#### Scenario: Explicit project root wins
- **WHEN** ai-learning receives an explicit project-root style environment signal
- **THEN** it uses that signal to anchor the project context

#### Scenario: Git identity is preferred over cwd fallback
- **WHEN** no explicit project-root signal is provided and git metadata is available
- **THEN** ai-learning prefers git-backed project identity before falling back to cwd-based identity

### Requirement: Optional Codex Observer Helper
MDT MUST treat the Codex observer process as an optional helper rather than as the baseline Codex learning flow.

#### Scenario: Codex observer remains optional
- **WHEN** ai-learning runs in Codex
- **THEN** the external observer helper can watch and analyze project observations
- **AND** the documented baseline still treats explicit capture and analysis as the primary Codex flow

#### Scenario: Observer role stays analysis-only for Codex baseline
- **WHEN** the optional Codex observer is enabled
- **THEN** it augments background analysis after observations exist
- **AND** it is not treated as the baseline capture mechanism for Codex

### Requirement: Promotion Boundary Between MDT State And Live Tool Surfaces
MDT MUST preserve the boundary between generated learning artifacts and live tool-facing installed surfaces.

#### Scenario: Generated candidates stay in MDT-owned state until approved
- **WHEN** ai-learning produces generated or evolved candidate artifacts
- **THEN** those candidates stay under MDT-owned generated or homunculus state
- **AND** they are not treated as live installed tool-facing assets until an explicit promotion or materialization step occurs

### Requirement: Learning Data Stays Local And Export Controls Are Narrow
MDT MUST keep raw learning observations local and limit export to higher-level learned artifacts.

#### Scenario: Raw observations are not the export surface
- **WHEN** ai-learning exports data
- **THEN** the export surface is limited to learned patterns or higher-level artifacts
- **AND** raw local observations are not treated as the normal export payload

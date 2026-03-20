## Purpose

Define MDT's core workflow contract model: shared workflow outcomes, machine-readable workflow definitions, and explicit per-tool realization across Claude Code, Cursor, and Codex.

## Requirements

### Requirement: Core Workflows Are First-Class MDT Behavior
MDT MUST define core workflows in terms of intended outcomes rather than in terms of any single tool's native surface.

#### Scenario: Workflow is described by shared outcome
- **WHEN** MDT defines a workflow such as `plan`, `tdd`, `code-review`, `verify`, `security`, `e2e`, or `mdt-dev-smoke`
- **THEN** the workflow is described by its intended outcome and success criteria
- **AND** the workflow is not defined solely by a single command, agent, or skill file

#### Scenario: Workflow contracts are limited to the core set
- **WHEN** MDT documents workflow contracts under `workflow-contracts/workflows/`
- **THEN** those contracts are limited to MDT's core workflows
- **AND** the workflow contract layer does not imply full feature parity across tools outside that core set

### Requirement: Machine-Readable Workflow Contracts
MDT MUST store its workflow definitions in machine-readable contract files under `workflow-contracts/`.

#### Scenario: Workflow contract exists as JSON
- **WHEN** a core MDT workflow is part of the supported workflow set
- **THEN** a corresponding machine-readable contract exists under `workflow-contracts/workflows/`
- **AND** that contract identifies the workflow id, outcome, success criteria, and per-tool mappings

#### Scenario: Workflow contract records realization artifacts and verification files
- **WHEN** MDT defines a workflow contract JSON file
- **THEN** it records the per-tool artifact mappings used to realize that workflow
- **AND** it records the required files used for deterministic setup verification

### Requirement: Human-Readable Workflow Matrix Alignment
MDT MUST keep the human-readable workflow matrix aligned with the machine-readable workflow contracts.

#### Scenario: Workflow contract is reflected in the docs matrix
- **WHEN** a workflow contract exists under `workflow-contracts/workflows/`
- **THEN** `docs/tools/workflow-matrix.md` includes a corresponding workflow row
- **AND** the row reflects the current documented tool statuses and realization paths

#### Scenario: Workflow matrix remains a human-readable view of the contracts
- **WHEN** MDT maintainers consult `docs/tools/workflow-matrix.md`
- **THEN** that page is treated as the human-readable view of the machine-readable workflow contracts
- **AND** maintainers do not treat the matrix as an unrelated or competing workflow definition layer

### Requirement: Per-Tool Realization Remains Explicit
MDT MUST document how each supported tool realizes each workflow instead of assuming cross-tool equivalence.

#### Scenario: Workflow is mapped per tool
- **WHEN** MDT documents a workflow
- **THEN** the workflow contract identifies the Claude, Cursor, and Codex realization separately
- **AND** those mappings can use different surface types such as commands, agents, skills, rules, guidance, config, scripts, or manual verification artifacts

#### Scenario: Repo adapter stays distinct from native support
- **WHEN** a workflow is realized through MDT guidance, templates, or installed repo artifacts rather than a vendor-native workflow surface
- **THEN** the workflow mapping preserves that distinction in its per-tool status

#### Scenario: Workflow status uses the workflow-specific label model
- **WHEN** MDT records per-tool workflow status in the workflow contract layer
- **THEN** it uses the workflow status model documented for the workflow matrix
- **AND** it does not silently import unsupported status meanings from a different docs-pack layer

### Requirement: Required Artifacts Are Declared For Workflow Verification
MDT MUST declare the files required for each workflow/tool realization so setup verification can check them deterministically.

#### Scenario: Required files are listed
- **WHEN** a workflow contract defines a tool mapping
- **THEN** it includes the required files needed for that mapping to exist
- **AND** those files are suitable for deterministic local verification

#### Scenario: Verification checks both documentation and files
- **WHEN** MDT runs `mdt verify tool-setups`
- **THEN** it verifies both the workflow-matrix documentation layer and the required-file layer derived from workflow contracts
- **AND** workflow contracts remain compatible with that deterministic verification model

### Requirement: Workflow Changes Update Both Contract Layers
MDT MUST update both the machine-readable and human-readable workflow definitions when a workflow changes materially.

#### Scenario: Workflow realization changes
- **WHEN** an MDT workflow is added or materially changed
- **THEN** the machine-readable workflow contract is updated
- **AND** `docs/tools/workflow-matrix.md` is updated to match the changed realization
- **AND** affected per-tool documentation is updated when the tool-specific behavior changes

#### Scenario: Workflow change updates verification coverage when needed
- **WHEN** a workflow change alters required files, local smoke behavior, or runtime verification expectations
- **THEN** MDT updates the relevant smoke or compatibility coverage
- **AND** updates the matching manual-verification material when runtime behavior changes

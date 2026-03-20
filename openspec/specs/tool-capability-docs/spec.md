## Purpose

Define the audited documentation contract for MDT tool capability claims, including source-of-truth boundaries, support labels, verification stamping, and explicit differences across Claude Code, Cursor, and Codex.

## Requirements

### Requirement: Audited Capability Docs Source Of Truth
MDT MUST treat the audited docs pack as the authoritative source of truth for tool capability claims.

#### Scenario: Capability claim is answered from the docs pack
- **WHEN** a maintainer needs to determine whether Claude Code, Cursor, or Codex supports an MDT feature family
- **THEN** the answer is derived from `docs/supported-tools.md` and `docs/tools/`
- **AND** other repo surfaces are not treated as a stronger authority than the audited docs pack

#### Scenario: Per-tool and matrix docs are read in the documented order
- **WHEN** a maintainer needs current truth about a capability claim
- **THEN** the docs-pack read order begins with the matrix and workflow references
- **AND** continues to the relevant per-tool page before treating a claim as settled

### Requirement: Current-State Docs And Comparison Material Stay Distinct
MDT MUST keep current-state capability truth separate from contributor guidance and comparison material.

#### Scenario: Comparison page does not define capability truth
- **WHEN** a maintainer reads `docs/tools/surfaces/` or `docs/tools/authoring.md`
- **THEN** those pages are treated as contributor guidance or comparison material
- **AND** they do not override the current-state capability truth recorded in `docs/supported-tools.md`, the matrices, and the per-tool pages

### Requirement: Capability Status Labels
MDT MUST classify tool capability claims using the documented support labels.

#### Scenario: Support claim is labeled
- **WHEN** MDT records or updates a capability claim
- **THEN** the claim uses a status label from the audited docs model
- **AND** the label distinguishes between vendor-native support, repo adapters, experimental support, unsupported behavior, and local verification state

#### Scenario: Only documented labels are used
- **WHEN** MDT records capability status in the audited docs pack
- **THEN** it uses the documented label set
- **AND** it does not invent a new support label without updating the audited docs model

### Requirement: Vendor-Native And Repo-Adapter Separation
MDT MUST distinguish vendor-native tool capabilities from MDT-defined adapter behavior.

#### Scenario: Repo adapter is not promoted to native support
- **WHEN** a workflow or surface is realized through MDT guidance, templates, or layered instructions rather than a vendor-native surface
- **THEN** MDT documents that realization as a repo adapter or equivalent non-native classification
- **AND** it does not present that behavior as vendor-native support

#### Scenario: Template presence does not prove support
- **WHEN** a file exists under `cursor-template/` or `codex-template/`
- **THEN** MDT does not treat that file's presence alone as proof of native vendor capability

#### Scenario: Official claims require vendor-backed evidence
- **WHEN** MDT promotes a capability claim to `official`
- **THEN** the claim is supported by vendor documentation or audited vendor-native evidence
- **AND** repo-local templates or adapters alone are insufficient evidence for that promotion

### Requirement: Tool-Specific Differences Remain Explicit
MDT MUST keep meaningful differences between Claude Code, Cursor, and Codex explicit in capability documentation.

#### Scenario: Same surface name does not imply same behavior
- **WHEN** multiple tools expose similarly named concepts such as hooks, commands, or skills
- **THEN** MDT documents tool-specific behavior and limitations instead of assuming the concepts are equivalent

#### Scenario: Manual-only verification remains explicit
- **WHEN** a tool requires human runtime verification for part of the documented claim
- **THEN** the docs mark that boundary explicitly instead of implying that CLI probing fully verifies the tool

#### Scenario: Tool-agnostic default is preserved
- **WHEN** MDT capability docs describe supported behavior across tools
- **THEN** they keep MDT tool-agnostic by default
- **AND** they only elevate a tool-specific difference when the audited native surface actually requires it

### Requirement: Version-Stamped Verification Claims
MDT MUST stamp verification-oriented capability claims with exact tested versions or an explicit unverified marker.

#### Scenario: Local verification is recorded
- **WHEN** MDT publishes or refreshes a locally verified capability claim
- **THEN** the docs record the exact tested tool version

#### Scenario: Unverified surface is called out
- **WHEN** a tool surface has not been locally re-verified in the current audit
- **THEN** MDT marks it as `not-locally-verified` instead of guessing

#### Scenario: Current-state pages keep required verification footer data
- **WHEN** MDT maintains a current-state page in `docs/tools/`
- **THEN** that page keeps the verification metadata required by the current docs-pack contract
- **AND** current-state docs use audit-oriented stamping rather than the manual-verification page format

### Requirement: Capability Docs Stay Aligned Across The Docs Pack
MDT MUST keep the capability matrix, workflow matrix, and per-tool pages aligned when capability facts change.

#### Scenario: Support label changes
- **WHEN** a support label or capability boundary changes
- **THEN** MDT updates the affected per-tool page
- **AND** updates the capability matrix
- **AND** updates the workflow matrix when workflow realization is affected

#### Scenario: Stale docs are refreshed through the verification workflow
- **WHEN** a docs-pack page appears stale or local behavior conflicts with the recorded claim
- **THEN** MDT uses the local verification workflow to refresh or challenge the claim
- **AND** does not silently preserve the older capability statement

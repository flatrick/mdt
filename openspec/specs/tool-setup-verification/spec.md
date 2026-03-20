## Purpose

Define how MDT verifies that documented tool setups and workflow surfaces are present, how local CLI checks and manual verification fit together, and how verification claims are recorded.

## Requirements

### Requirement: Deterministic Tool Setup Verification Command
MDT MUST provide a deterministic verification command for checking documented workflow setup surfaces.

#### Scenario: Tool setup verification command exists
- **WHEN** a maintainer verifies the documented MDT workflow setup
- **THEN** MDT provides `mdt verify tool-setups` as the verification entry point

#### Scenario: Verification checks docs and required files
- **WHEN** `mdt verify tool-setups` runs
- **THEN** it checks that the workflow matrix contains the expected workflow/tool entries
- **AND** it checks that required files for workflow realizations exist

#### Scenario: Verification is about setup presence, not full runtime proof
- **WHEN** `mdt verify tool-setups` succeeds
- **THEN** it confirms that the documented setup surface and workflow contract files are present and aligned
- **AND** it does not by itself prove full in-tool runtime behavior

### Requirement: Dev Smoke Verification Surface
MDT MUST provide dev-install smoke workflows for maintainer verification beyond the normal install baseline.

#### Scenario: Dev smoke tool-setups exists
- **WHEN** a maintainer verifies a `--dev` installation
- **THEN** MDT provides `mdt dev smoke tool-setups`
- **AND** supports tool-scoped smoke checks for Claude, Cursor, and Codex

#### Scenario: Dev smoke workflows are tool-specific
- **WHEN** a maintainer validates workflow behavior for one supported tool
- **THEN** MDT provides `mdt dev smoke workflows --tool <claude|cursor|codex>`

#### Scenario: Dev smoke remains outside the normal end-user baseline
- **WHEN** MDT documents or installs dev smoke verification surfaces
- **THEN** those surfaces are treated as maintainer-only `--dev` helpers
- **AND** they are not described as part of the normal end-user install baseline

### Requirement: Verification Order
MDT MUST treat local verification as an ordered process rather than a single probe.

#### Scenario: Verification follows the documented playbook
- **WHEN** a maintainer refreshes or challenges a claim in the MDT tool docs
- **THEN** the process begins with the relevant docs page
- **AND** proceeds through local installation checks, CLI probes, setup verification scripts, and manual verification checklists before treating the tool as fully verified

#### Scenario: Vendor docs are not the first verification step
- **WHEN** a maintainer verifies or challenges a current capability claim
- **THEN** MDT uses local docs, local probes, and local verification flows first
- **AND** vendor docs are only consulted after the documented local verification order reaches that step

### Requirement: Manual Verification Boundary
MDT MUST preserve the distinction between scripted verification and runtime behaviors that require manual verification.

#### Scenario: Scripted smoke is not treated as complete runtime proof
- **WHEN** scripted smoke checks pass for a tool
- **THEN** the matching page under `docs/testing/manual-verification/` is still required for runtime behaviors that cannot be proven well by CLI probes alone

#### Scenario: Manual verification pages are named runtime checklists
- **WHEN** MDT refers maintainers to manual verification material
- **THEN** it uses the named checklist pages under `docs/testing/manual-verification/`
- **AND** those pages act as the authoritative runtime-completion boundary for the covered tool behaviors

#### Scenario: Cursor IDE remains manual-only
- **WHEN** MDT documents verification for Cursor IDE behavior
- **THEN** it treats Cursor IDE as a manual verification surface rather than implying that CLI probing fully verifies it

### Requirement: Version-Stamped Verification Metadata
MDT MUST record verification claims with explicit tested versions or explicit local verification gaps.

#### Scenario: Verified claim is stamped
- **WHEN** MDT records an environment-specific verification claim
- **THEN** the relevant docs use the verification stamp format required for that docs layer
- **AND** current-state docs and manual-verification pages are not forced into the same literal heading format

#### Scenario: Unverified claim is not carried forward silently
- **WHEN** a surface cannot be checked in the current audit
- **THEN** MDT marks it as `not-locally-verified` instead of reusing an older value without qualification

#### Scenario: Required footer data stays on current-state docs pages
- **WHEN** MDT maintains current-state verification-oriented docs under `docs/tools/`
- **THEN** those pages keep the verification metadata required by the current docs-pack contract
- **AND** audit-oriented current-state docs remain distinct from manual-verification page headings such as `Last verified`

### Requirement: Codex Windows Apply Patch Verification Boundary
MDT MUST treat real Codex `apply_patch` behavior as authoritative when evaluating Codex workspace patchability on Windows.

#### Scenario: Shell-level probes do not override Codex patch behavior
- **WHEN** Codex on Windows reports an internal `apply_patch` failure
- **THEN** raw shell or Node.js filesystem probes are not treated as stronger evidence of patchability
- **AND** the documented Codex manual verification path is used instead

#### Scenario: Direct-child reproduction remains part of the Codex manual path
- **WHEN** Codex Windows patchability is in doubt
- **THEN** the manual verification path includes the disposable direct-child reproduction and ACL inspection flow
- **AND** MDT treats the real `apply_patch` outcome as the authoritative success signal

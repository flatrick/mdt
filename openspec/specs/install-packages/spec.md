## Purpose

Define the MDT package manifest contract: how installable packages are declared, how package composition and dependency closure are resolved, and how package manifests relate to shared assets and tool-specific install surfaces.

## Requirements

### Requirement: Package Manifests Define Installable Capability Slices
MDT MUST define each installable package through a manifest under `packages/<name>/package.json`.

#### Scenario: Package manifest is the install contract
- **WHEN** an MDT package is installable through `mdt install`
- **THEN** it has a manifest under `packages/<name>/package.json`
- **AND** the manifest name matches the package directory name

### Requirement: Package Manifests Describe Composition, Not Source Replacement
MDT package manifests MUST describe what gets installed together without replacing the shared source asset directories.

#### Scenario: Shared asset directories remain authoritative
- **WHEN** a package manifest references rules, agents, commands, or skills
- **THEN** those references point to assets in the shared source directories
- **AND** the package manifest does not replace those source directories as the authoritative asset location

### Requirement: Package Manifest Field Contract
MDT MUST support the documented manifest field model for package composition and validation.

#### Scenario: Shared asset fields are present
- **WHEN** a package manifest is valid
- **THEN** it includes the documented shared asset arrays for `rules`, `agents`, `commands`, and `skills`
- **AND** it includes the required metadata fields needed by the current package schema

#### Scenario: Tool-specific install surfaces are explicit
- **WHEN** a package manifest declares per-tool install behavior
- **THEN** it uses the documented `tools` object
- **AND** only supported install surfaces are represented there

#### Scenario: Shared command targeting does not live in the package manifest
- **WHEN** a package manifest includes shared commands
- **THEN** those commands are selected from the package `commands` list for all tools
- **AND** per-command install targeting remains defined beside each shared command rather than inside the package manifest

### Requirement: Package Extension And Merge Semantics
MDT MUST resolve `extends` chains and merged package content using the documented merge rules.

#### Scenario: Parent packages resolve first
- **WHEN** a package manifest uses `extends`
- **THEN** parent packages resolve before child package additions
- **AND** arrays merge by stable union while preserving first-seen order

#### Scenario: Requires tools merge by intersection
- **WHEN** both parent and child manifests declare `requires.tools`
- **THEN** the effective `requires.tools` value is the intersection of the declared tool sets

#### Scenario: Cycles are rejected
- **WHEN** package extension or dependency resolution would create a cycle
- **THEN** validation fails instead of producing an install closure

### Requirement: Resolver Owns Install Closure
MDT MUST compute install closure through the shared resolver model rather than through parallel opt-out install paths.

#### Scenario: Resolver computes closure
- **WHEN** MDT resolves a selected package set for installation
- **THEN** it expands selected packages, follows `extends`, applies dependency sidecars, validates tool support, and computes the effective install closure

#### Scenario: Resolver is the only install path
- **WHEN** MDT installs selected packages
- **THEN** the shared resolver is the install path
- **AND** there is no separate flag that bypasses the resolver model

#### Scenario: Tool support maps are authoritative for installability
- **WHEN** the resolver evaluates whether a package set can be installed for a target tool
- **THEN** machine-readable tool support maps under `metadata/tools/` are authoritative for installability decisions
- **AND** package or sidecar capability declarations express intent rather than overriding those support maps

#### Scenario: Resolver output remains a closure summary
- **WHEN** the resolver succeeds or fails
- **THEN** it reports the resolved target, package closure, and any warnings or errors for that install attempt

### Requirement: Package Validation Guards Structural Integrity
MDT MUST validate package manifests against the documented schema and asset constraints.

#### Scenario: Package validation checks references
- **WHEN** package manifest validation runs
- **THEN** it verifies referenced shared assets exist
- **AND** it verifies referenced tool-specific assets exist
- **AND** it verifies referenced skills satisfy the documented metadata requirements

#### Scenario: Package validation checks manifest structure
- **WHEN** package manifest validation runs
- **THEN** it enforces the documented field schema, allowed values, and package reference rules

#### Scenario: Validation reflects the current asymmetric tool model
- **WHEN** package validation checks tool-specific fields
- **THEN** it uses the currently documented per-tool subfield allowlist
- **AND** it does not assume that every tool exposes the same install surface shape

### Requirement: Dependency Sidecars And Package Manifests Stay Distinct
MDT MUST keep package manifests and dependency sidecars as separate but cooperating layers of the install model.

#### Scenario: Package manifest is not the only dependency source
- **WHEN** MDT resolves or validates install dependencies
- **THEN** it uses package manifests together with co-located dependency sidecars where applicable
- **AND** package manifests alone are not treated as the full dependency or capability model

#### Scenario: Load-bearing entries can contribute sidecar requirements
- **WHEN** an artifact is load-bearing in the install model
- **THEN** co-located dependency sidecars may contribute dependency or capability requirements for install resolution
- **AND** the resolver includes those requirements in closure evaluation

### Requirement: Package Support Does Not Replace Capability Docs
MDT MUST keep install composition and audited capability documentation as separate sources of truth.

#### Scenario: Package manifest does not define public capability truth
- **WHEN** a maintainer needs current truth about tool support or capability claims
- **THEN** package manifests are treated as install composition metadata
- **AND** audited capability claims are still taken from `docs/tools/` and related current-state docs

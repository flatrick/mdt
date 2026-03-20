## Purpose

Define the public MDT installation contract: how MDT is invoked, where it installs, which options are supported, and which tool-specific boundaries must remain explicit.

## Requirements

### Requirement: Public MDT CLI Installation Entry Point
MDT MUST expose `mdt` as the public entry point for installation and verification workflows.

#### Scenario: Standard install uses the MDT CLI
- **WHEN** a user follows the documented install flow
- **THEN** the documented command path uses `mdt install ...`
- **AND** installation guidance does not require invoking internal implementation scripts directly

#### Scenario: Verification uses the MDT CLI
- **WHEN** a user verifies an MDT setup after installation
- **THEN** the documented verification command path uses `mdt verify tool-setups`

#### Scenario: Internal scripts remain internal implementation details
- **WHEN** MDT documents installation or bridge workflows for normal users
- **THEN** it presents `mdt ...` as the public contract
- **AND** raw `scripts/*.js` entrypoints are treated as internal backing implementations or verification equivalents rather than the primary public interface

### Requirement: Global-Only Tool Installation Model
MDT MUST install into the selected tool's user/global configuration root and MUST NOT treat repo-local installation as the default model.

#### Scenario: Normal installation targets a tool config root
- **WHEN** a user runs `mdt install` for `claude`, `cursor`, or `codex`
- **THEN** the target location is the tool's user/global config root
- **AND** MDT-owned runtime state is placed under the corresponding `~/.{tool}/mdt/` root

#### Scenario: Repo-local install is not the default
- **WHEN** installation behavior is documented or implemented
- **THEN** repo-local installation is described as an exception or bridge flow
- **AND** normal installation is described as global-only

#### Scenario: Tool-facing assets and MDT-owned runtime stay separated
- **WHEN** MDT installs into a supported tool config root
- **THEN** tool-facing assets are placed where the target tool expects them
- **AND** MDT-owned runtime scripts and state live under the tool-relative MDT root

### Requirement: Installation Option Contract
MDT MUST support the documented installation options and their defined semantics.

#### Scenario: Default install target is Claude
- **WHEN** a user runs `mdt install` without `--tool`
- **THEN** MDT uses `claude` as the default install target

#### Scenario: Install list is supported
- **WHEN** a user runs `mdt install list`
- **THEN** MDT reports the available install targets or package selections without performing an install

#### Scenario: Config root override is supported
- **WHEN** a user supplies `--config-root <tool-config-dir>`
- **THEN** MDT redirects installation to the provided tool config root
- **AND** this override is treated as a testing or isolated-install mechanism

#### Scenario: Global flag is a compatibility no-op
- **WHEN** a user supplies `--global`
- **THEN** MDT accepts the flag as a compatibility no-op
- **AND** does not treat it as enabling a different installation mode from the default

#### Scenario: Development surfaces are opt-in
- **WHEN** a user supplies `--dev`
- **THEN** MDT installs maintainer-only development surfaces in addition to the normal install surface
- **AND** those surfaces are not treated as part of the normal end-user baseline

#### Scenario: Dry run reports the planned installation
- **WHEN** a user supplies `--dry-run`
- **THEN** MDT reports the planned installation behavior without performing the install

#### Scenario: Project-dir is retired
- **WHEN** a user supplies `--project-dir`
- **THEN** MDT exits with a migration-oriented message
- **AND** the option is not treated as a supported installation path

### Requirement: Tool-Specific Installation Boundaries
MDT MUST preserve documented tool-specific installation constraints instead of flattening tools into one generic model.

#### Scenario: Cursor install preserves global-plus-bridge behavior
- **WHEN** installation behavior for Cursor is documented
- **THEN** MDT describes `~/.cursor/` as the primary install surface
- **AND** repo-local Cursor IDE rules are described as an explicit additional bridge step rather than a replacement for the global install

#### Scenario: Bridge materialization stays narrowly scoped
- **WHEN** MDT documents or implements repo-local bridge materialization
- **THEN** it treats bridge materialization as a narrow exception flow rather than a second general install mode
- **AND** the current documented bridge support remains specific to Cursor repo-local rules materialization

#### Scenario: Codex config ownership is preserved
- **WHEN** MDT installs for Codex and `~/.codex/config.toml` already exists
- **THEN** MDT preserves the existing user-owned config
- **AND** MDT writes a reference config instead of overwriting the user's local settings

### Requirement: Pre-V1 Reinstall Policy
MDT MUST document pre-`v1.0.0` installation changes as reinstall-oriented rather than as guaranteed in-place upgrade compatibility.

#### Scenario: Pre-v1 install layout changes prefer reinstall
- **WHEN** install layout changes occur before `v1.0.0`
- **THEN** MDT instructs users to reinstall or start fresh
- **AND** does not promise compatibility migration behavior across intermediate revisions

### Requirement: Shell-Neutral User-Facing Paths
MDT MUST use shell-neutral user-facing path forms in installation documentation and guidance.

#### Scenario: Tool home paths are documented neutrally
- **WHEN** installation documentation refers to tool home directories
- **THEN** it uses shell-neutral forms such as `~/.codex/`, `~/.claude/`, and `~/.cursor/`
- **AND** it avoids spelling out expanded Windows absolute home paths in user-facing output

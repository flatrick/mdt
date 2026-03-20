## Purpose

Define how MDT detects tool context, config roots, data roots, platform details, workspace classification, and session identity for runtime helpers and tests.

## Requirements

### Requirement: Tool Detection Uses Explicit Environment Signals
MDT MUST detect the active tool from explicit environment signals before using fallback filesystem heuristics.

#### Scenario: Cursor wins when its tool signal is present
- **WHEN** `CURSOR_AGENT` is set to `1`
- **THEN** MDT detects the tool as `cursor`

#### Scenario: Claude detection honors session and tool flags
- **WHEN** `CLAUDE_SESSION_ID` is a non-empty string
- **THEN** MDT detects the tool as `claude`

#### Scenario: Claude code flag maps to Claude
- **WHEN** `CLAUDE_CODE` is set to `1` and no higher-precedence tool signal applies
- **THEN** MDT detects the tool as `claude`

#### Scenario: Codex detection is explicit
- **WHEN** `CODEX_AGENT` is set to `1` and no higher-precedence tool signal applies
- **THEN** MDT detects the tool as `codex`

#### Scenario: Unknown tool remains unknown
- **WHEN** no supported tool signal applies
- **THEN** MDT detects the tool as `unknown`

#### Scenario: Tool detection precedence is strict
- **WHEN** multiple supported tool-detection signals are present
- **THEN** MDT applies the shared precedence order defined by the runtime detection implementation
- **AND** lower-precedence signals do not override a higher-precedence detected tool

### Requirement: Config Directory Resolution
MDT MUST resolve the effective config root from explicit overrides first, then tool-aware defaults, then documented fallbacks.

#### Scenario: Existing explicit config override is honored
- **WHEN** `CONFIG_DIR` is set to an existing directory
- **THEN** MDT uses that directory as the config root

#### Scenario: Tool default config root is used
- **WHEN** no valid explicit config override applies and a supported tool is detected
- **THEN** MDT resolves the config root to that tool's standard home directory

#### Scenario: Invalid explicit config override warns and falls back
- **WHEN** `CONFIG_DIR` is set but does not exist
- **THEN** MDT emits a warning
- **AND** falls back to tool-aware config root resolution

#### Scenario: Unknown tool falls back through installed-home heuristics
- **WHEN** no supported tool is explicitly detected
- **THEN** MDT falls back through installed-home heuristics before choosing the final default config root
- **AND** the final default remains deterministic

### Requirement: Data Directory Resolution
MDT MUST resolve MDT-owned data under the effective config root unless a valid explicit data override is provided.

#### Scenario: Existing explicit data override is honored
- **WHEN** `DATA_DIR` is set to an existing directory
- **THEN** MDT uses that directory as the data root

#### Scenario: Default data root is config-root relative
- **WHEN** no valid explicit data override applies
- **THEN** MDT resolves the data root to `<configDir>/mdt`

### Requirement: Derived MDT Paths
MDT MUST derive standard MDT runtime paths from the resolved config and data directories.

#### Scenario: Derived paths are available
- **WHEN** MDT resolves environment paths
- **THEN** it provides derived paths for skills, hooks, MDT runtime state, and homunculus data based on the effective config and data roots

#### Scenario: MDT root aliases the effective data root
- **WHEN** MDT derives runtime paths
- **THEN** the effective MDT runtime root aliases the resolved data root
- **AND** downstream derived paths are anchored from that resolved runtime root

### Requirement: Platform And Workspace Classification
MDT MUST detect platform details and classify WSL workspaces so warnings and path behavior remain consistent.

#### Scenario: WSL is detected from Linux runtime details
- **WHEN** MDT runs on Linux and `/proc/version` indicates a Microsoft environment
- **THEN** MDT classifies the platform as WSL

#### Scenario: Windows-mounted WSL workspaces are flagged
- **WHEN** MDT runs inside WSL on a workspace path under `/mnt/<drive>/`
- **THEN** it classifies the workspace as Windows-mounted
- **AND** marks that workspace as performance-sensitive for warning purposes

#### Scenario: Non-mounted WSL workspaces remain native
- **WHEN** MDT runs inside WSL on a workspace path outside `/mnt/<drive>/`
- **THEN** it classifies the workspace as WSL-native
- **AND** it does not mark that workspace as performance-sensitive

### Requirement: Session Identity Resolution
MDT MUST resolve a stable session identifier from tool-provided signals when available and generate a fallback identifier otherwise.

#### Scenario: Tool-provided session id is preferred
- **WHEN** a supported tool-specific session id environment variable is available
- **THEN** MDT uses that session id

#### Scenario: Session-id precedence is shared and deterministic
- **WHEN** multiple supported session-id signals are available
- **THEN** MDT applies the shared session-id precedence order used by the runtime detection layer
- **AND** callers receive a deterministic session identifier rather than tool-specific ambiguity

#### Scenario: Fallback session id is generated
- **WHEN** no supported session id environment variable is available
- **THEN** MDT generates a fallback session id for logging and observation use

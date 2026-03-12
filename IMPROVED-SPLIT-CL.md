# Improved Continuous Learning Extraction Plan

## Purpose
This document replaces the earlier `continuous-learning-core` split proposal.

The revised recommendation is:

- keep `continuous-learning-manual` and `continuous-learning-automatic` as the
  only public skills
- move shared implementation into a private runtime module under
  `scripts/lib/continuous-learning/`
- preserve existing public entrypoints while removing duplicated runtime
  ownership

The goal is to stop treating `continuous-learning-manual` as both a public skill
surface and the real backend implementation, without introducing a third
user-visible skill that adds installer, validator, and documentation complexity.

## Desired End State
After the extraction:

- shared continuous-learning implementation lives in one private runtime module
- `continuous-learning-manual` remains the public explicit/manual command
  surface
- `continuous-learning-automatic` remains the Claude/Cursor hook surface
- no public `continuous-learning-core` skill exists
- existing user-facing paths remain stable during the migration
- duplicated implementations are removed from:
  - `skills/continuous-learning-manual/`
  - `skills/continuous-learning-automatic/`
  - `codex-template/skills/continuous-learning-manual/`
- package installation behavior stays low-risk:
  - Claude installs `continuous-learning-manual` and
    `continuous-learning-automatic`
  - Cursor installs `continuous-learning-manual` and
    `continuous-learning-automatic`
  - Codex installs `continuous-learning-manual`

## Why This Is Better Than A Public Core Skill
The earlier split was directionally right about ownership, but the public-core
skill approach creates avoidable costs:

1. it adds a third public skill that users and agents can discover even though
   it is infrastructure, not a real workflow surface
2. it forces package manifests, installers, tests, validators, and docs to
   model that extra public abstraction
3. it creates rollout risk because consumers can be rewired to `core` before
   installs actually include `core`
4. it does not solve the real problem by itself, which is duplicated runtime
   code across multiple public and overlay directories

The private-runtime approach fixes the ownership issue while keeping the public
surface small and stable.

## Additional Benefits Worth Naming
The private-runtime approach also creates benefits that are not just about
reducing rollout risk:

1. it establishes a reusable MDT pattern: private runtime under `scripts/lib/`
   plus stable public wrappers
2. it immediately removes maintenance surface because several Codex overlay
   copies are already identical to the shared manual implementation
3. it keeps future tool-specific manual workflows open without adding another
   public infrastructure skill

## Design Principles

### 1. Shared implementation is private infrastructure
Anything that is not inherently a public skill surface should live under
`scripts/lib/continuous-learning/`, not in a new installable skill.

### 2. Public skills expose workflows, not backend ownership
`continuous-learning-manual` should document and expose explicit/manual
workflows.

`continuous-learning-automatic` should document and expose hook-driven
observation workflows.

Neither should be the long-term owner of shared backend code.

### 3. Stable public entrypoints matter more than perfect internal paths
Keep current command and script entrypoints working while the implementation is
rewired behind them.

### 4. Fix contract drift before moving code
The current docs do not fully match actual behavior. Freeze the real contract in
tests and docs before or during extraction so the migration does not move stale
assumptions into a new location.

### 5. Keep installer semantics narrow in this migration
Do not widen Codex shared-skill inheritance behavior in the same change. That is
separate work with separate blast radius.

### 6. Remove duplication only after wrappers and tests are green
Switch real implementations first. Trim duplicate files only after installed
layouts and runtime behavior are verified.

### 7. Make shared code location-agnostic before relocating it
Current runtime code infers behavior from where its own files live. Break that
coupling before moving code into `scripts/lib/continuous-learning/`.

## Important Constraints From Current Repo Behavior

### Runtime scripts already have a private install surface
The installer already copies `scripts/lib/` and `scripts/hooks/` into the tool
runtime root under `<tool-config>/mdt/scripts/`.

That means shared continuous-learning runtime code can be moved into
`scripts/lib/continuous-learning/` without inventing a new public skill surface.

### Codex still does not inherit top-level shared package skills
Current installer behavior excludes top-level package `skills` for Codex and
only installs `tools.codex.skills`.

This means the migration should not rely on new shared skill selection semantics
for Codex.

### Codex overlay installation merges shared and overlay directories
Codex installs merge shared skills with `codex-template/skills/` overlays.

That means:

- shared `continuous-learning-manual` files can still provide the main public
  surface
- the overlay should only retain true Codex-specific differences plus metadata
  that current validators require

### Validator behavior still treats overlay metadata conservatively
If a Codex overlay directory exists for a skill, current package validation
checks the overlay-resolved directory for `skill.meta.json`.

That means overlay metadata cannot be dropped until validator behavior is
intentionally changed and tested.

### Current docs and code disagree on some core behavior
The current implementation preserves cwd-scoped non-git project fallback, while
some docs still describe a global fallback model.

The current implementation also uses the existing project ID behavior from code,
while some docs still describe 12-character `sha256` identifiers.

The manual skill docs also still contain stale hook examples even though the
hook surface belongs to `continuous-learning-automatic`.

These mismatches are in scope for correction as part of the migration.

### Current runtime behavior is still file-location-sensitive
Several current scripts infer tool/config roots, runtime lookup paths, or
default config paths from `__dirname` and the existing public skill layout.

This means the migration cannot safely be only a file move. Shared runtime code
must first accept explicit context such as entrypoint directory, config root, or
config path so the wrappers can preserve current behavior after extraction.

### Tests encode public file layout and wrapper exports
Current tests do not only execute public scripts as CLIs. They also import named
exports directly from public files and build fake installed layouts that mirror
the current `skills/...` and `scripts/lib/...` arrangement.

This means compatibility work must preserve both:

- public script paths
- public module export behavior used by tests and any repo-local consumers

### Current compatibility suites do not yet prove real tool-runtime execution
The current `tests/compatibility-testing/` suites are useful, but they mostly
prove install shape, direct Node invocations, and mocked smoke paths. They do
not yet prove that Codex, Claude Code, Cursor Agent, and Cursor IDE all invoke
the same surfaces the same way in their real runtimes.

This means current green compatibility coverage should be treated as strong
repo-side confidence, not as full tool-runtime proof.

### One stale runtime path still exists in instinct-cli
Current project detection writes projects directly under
`homunculus/<project-id>/`, but `instinct-cli projects` still assumes the old
`homunculus/projects/<project-id>/` layout.

This means the migration plan should explicitly fix and lock this path contract
before treating the continuous-learning CLI surface as fully stable.

### Codex overlay docs are validator-constrained, not just metadata-constrained
Current validators enforce Codex-specific documentation boundaries for
`codex-template/skills/continuous-learning-manual/SKILL.md`, including concrete
Codex paths rather than abstract placeholders.

This means the overlay cannot be treated as metadata-only while those validator
rules remain in place.

### Observer config is currently owned by the public manual skill surface
The observer runtime currently loads `config.json` from the public
`continuous-learning-manual` skill root.

This means the migration should not silently move config ownership into the
private runtime. Shared code should consume config supplied by public wrappers.

## Decision Log
These decisions should be treated as defaults for the migration:

- do not create a public `continuous-learning-core` skill
- extract shared implementation into `scripts/lib/continuous-learning/`
- keep existing public command and script entrypoints stable during migration
- preserve current public wrapper exports where tests rely on them
- keep current Codex shared-skill installer semantics unchanged
- treat `continuous-learning-manual` as the public explicit/manual CLI surface
  across supported tools, not as the shared backend owner
- treat `continuous-learning-automatic` as a thin hook surface only
- migrate the optional Codex observer in the same program of work
- keep overlay metadata until validators are deliberately updated
- keep observer config owned by the public manual skill surface in this
  migration

## Proposed Ownership Model

### `scripts/lib/continuous-learning/`
This becomes the single owner of shared implementation.

Recommended contents:

- project detection implementation
- shared config loading helpers
- instinct CLI internals
- retrospective generation logic
- observer runtime helpers
- shared observer prompt/assets
- any shared path-resolution helpers

This module is private runtime infrastructure, not a user-facing skill.

### `skills/continuous-learning-manual/`
This remains a public skill.

It should own:

- `SKILL.md`
- `skill.meta.json`
- `config.json`
- public explicit/manual entrypoints such as `scripts/codex-learn.js`
- public CLI wrappers such as `scripts/instinct-cli.js`
- compatibility wrappers for any temporarily preserved paths

It should document:

- explicit/manual learning workflows
- public commands and when to use them
- how the public manual commands relate to the automatic hook layer

It should not remain the real owner of shared runtime code.

Its wrappers should continue to preserve current module exports where tests rely
on those exports.

### `skills/continuous-learning-automatic/`
This remains a public skill.

It should own:

- `SKILL.md`
- `skill.meta.json`
- `hooks/observe.js`
- only thin wrappers that are truly needed for compatibility

It should document:

- hook-based observation for Claude/Cursor
- required hook wiring
- what is intentionally not owned here

It should not remain the owner of shared project detection or shared backend
logic.

### `codex-template/skills/continuous-learning-manual/`
This should contain only true Codex-specific differences plus currently required
metadata.

Initial safe target contents:

- `SKILL.md`
- `skill.meta.json`
- `agents/openai.yaml`
- any other Codex-only metadata required by current validation
- only Codex-specific wrappers or docs that cannot live in shared
  `skills/continuous-learning-manual/`

It should not keep duplicated shared implementations after the migration is
complete, but it may still need to retain Codex-specific docs while current
validator rules remain in place.

## File-Level Refactor Plan

### Phase 0: Freeze The Real Contract

#### 1. Correct contract drift in docs and tests
Review and update the current continuous-learning docs and tests so they reflect
real behavior before the extraction continues.

Correct at minimum:

- non-git fallback behavior
- project ID behavior
- ownership of hook entrypoints
- stale public examples that point to nonexistent manual hook paths

Acceptance criteria:

- core docs no longer contradict current code on project detection behavior
- manual docs no longer claim ownership of hook entrypoints
- tests encode the real current contract before extraction

### Phase 1: Stabilize Runtime Resolution And Extract Shared Runtime

#### 2. Introduce location-agnostic runtime context helpers
Before moving shared code, add a small runtime context/resolution layer that
lets shared implementation accept explicit inputs such as:

- entrypoint directory
- config root
- data root
- config path

Use the current public wrapper paths as the compatibility boundary. Public
scripts and agents should keep the existing path- and layout-sensitive behavior
by passing explicit context into shared code.

Acceptance criteria:

- shared runtime logic no longer depends on its own final file location
- wrappers remain responsible for preserving current installed-layout behavior
- no new public skill is introduced

#### 3. Create the private shared runtime module
Add `scripts/lib/continuous-learning/` and move shared implementation there once
the context abstraction exists.

Initial candidates:

- project detection logic
- shared config loading
- retrospective generation logic
- shared observer helpers
- shared CLI internals that do not need to remain public entrypoints

Acceptance criteria:

- one private runtime location owns shared implementation
- no new public skill is introduced

#### 4. Convert public entrypoints into thin wrappers
Update public scripts so they import or delegate to the private runtime instead
of owning real implementations themselves.

Targets include:

- `skills/continuous-learning-manual/scripts/instinct-cli.js`
- `skills/continuous-learning-manual/scripts/codex-learn.js`
- `skills/continuous-learning-manual/scripts/detect-project.js`
- `skills/continuous-learning-manual/scripts/retrospect-week.js`
- `skills/continuous-learning-manual/agents/start-observer.js`
- `skills/continuous-learning-automatic/hooks/observe.js`
- any automatic or overlay duplicates that still own real logic

Acceptance criteria:

- public paths keep working
- current named exports used by tests still work
- real implementation lives in the private runtime
- wrappers are minimal and explicit

#### 5. Add installed-layout fixture helpers and compatibility coverage
Before duplicate cleanup, update tests/helpers so they can construct realistic
installed layouts that include both:

- `skills/...`
- `mdt/scripts/lib/continuous-learning/...`

Acceptance criteria:

- tests no longer rely on outdated fake layouts that omit the extracted runtime
- compatibility coverage explicitly protects wrapper exports and installed-layout
  inference

#### 6. Rewire the optional Codex observer
Update `scripts/codex-observer.js` so it resolves the private runtime first.

If needed during transition, it may fall back to stable manual wrappers, but the
new preferred runtime owner should be private shared runtime code rather than the
manual skill directory.

Acceptance criteria:

- Codex observer behavior still works
- it no longer depends on manual being the backend owner

### Phase 2: Re-state Skill Boundaries

#### 7. Rewrite `continuous-learning-manual` docs around its real role
Update manual-skill docs so they describe:

- explicit/manual commands
- public CLI workflows
- the relationship to automatic observation

Remove:

- backend-ownership language
- stale hook-path examples
- any wording that says manual is the shared runtime owner

Acceptance criteria:

- manual is clearly a public workflow surface
- docs do not imply it owns the backend
- docs make clear that config remains public-surface-owned even though runtime
  code is private

#### 8. Rewrite `continuous-learning-automatic` docs around thin ownership
Update automatic-skill docs so they describe:

- hook capture
- hook prerequisites
- how hook events flow into shared runtime

Remove:

- duplicated backend explanations that belong elsewhere
- any implication that automatic owns project detection

Acceptance criteria:

- automatic is clearly a thin hook layer
- shared concepts are referenced without duplicating ownership claims

### Phase 3: Keep Install Composition Stable

#### 9. Preserve current package selection semantics
Do not add a new public skill to `packages/continuous-learning/package.json`.

The migration target remains:

- shared `skills`: `documentation-steward`, `continuous-learning-manual`
- `tools.claude.skills`: `continuous-learning-automatic`
- `tools.cursor.skills`: `continuous-learning-automatic`
- `tools.codex.skills`: `documentation-steward`, `continuous-learning-manual`

Acceptance criteria:

- no `continuous-learning-core` manifest entry exists
- current installer semantics remain valid

#### 10. Ensure runtime installation is sufficient
Verify that runtime installation already places the new private module under the
tool runtime root through the existing `scripts/lib` copy behavior.

Only change installer code if the new runtime location is not actually included
by current runtime-script installation.

Acceptance criteria:

- the new private runtime is installed anywhere the public wrappers need it
- no continuous-learning-specific installer special-case is introduced unless
  strictly necessary

### Phase 4: Update Commands, Docs, And Integrations

#### 11. Keep public command docs pointed at public manual entrypoints
Do not repoint command docs to private runtime paths.

Review and keep or refine public entrypoint usage in:

- `commands/evolve.md`
- `commands/instinct-export.md`
- `commands/instinct-import.md`
- `commands/instinct-status.md`
- `commands/projects.md`
- `commands/promote.md`

Acceptance criteria:

- user-facing commands still reference stable public scripts
- docs do not expose private runtime paths

#### 12. Update descriptive docs that describe ownership
Review files such as:

- `skills/continuous-learning-manual/SKILL.md`
- `skills/continuous-learning-automatic/SKILL.md`
- `docs/tools/codex.md`
- manual verification docs
- migration notes or parity docs

Replace wording that still treats manual as the backend owner.

Acceptance criteria:

- user-facing language matches the extracted architecture

### Phase 5: Trim Duplicate Implementations

#### 13. Remove duplicate implementations from automatic
After wrappers and tests are in place, remove duplicated shared logic from
automatic-owned scripts.

Key target:

- `skills/continuous-learning-automatic/scripts/detect-project.js`

Acceptance criteria:

- automatic no longer contains a second real copy of shared runtime logic
- duplicate removal happens only after the shared resolver preserves the
  automatic wrapper's current behavior

#### 14. Remove duplicated shared implementation from the Codex overlay
After installation and validator behavior are confirmed, remove duplicated
shared implementations from:

- `codex-template/skills/continuous-learning-manual/scripts/`
- `codex-template/skills/continuous-learning-manual/agents/`
- any duplicated shared config that can live in shared runtime or shared manual

Keep:

- Codex-specific docs
- Codex-specific metadata
- Codex-only wrappers if still necessary

Acceptance criteria:

- overlay contains true Codex differences only
- required metadata is still present
- Codex-specific docs remain where validator rules still require them

#### 15. Trim shared manual to its real public role
After the new runtime is stable, remove any remaining shared backend ownership
from `skills/continuous-learning-manual/` except:

- public wrappers
- public CLI entrypoints
- docs and metadata

Acceptance criteria:

- manual is small and understandable
- manual remains public surface, not backend owner

### Phase 6: Update Tests And Validators

#### 16. Add or update private-runtime tests
Add focused tests for:

- project detection behavior
- shared config loading
- retrospective behavior
- shared observer helper behavior
- runtime context/path-resolution behavior

Acceptance criteria:

- the private runtime is directly tested
- shared behavior is no longer validated only through duplicated public files

#### 17. Keep compatibility tests for public entrypoints
Update tests so they distinguish between:

- shared runtime behavior tests
- public wrapper compatibility tests
- installed-layout fixture tests

At minimum verify:

- manual CLI entrypoints still work
- named exports from public wrappers still work
- automatic hook entrypoint still works
- Codex observer still works
- installed layout inference still works for `.claude`, `.cursor`, and `.codex`

Acceptance criteria:

- tests protect both new ownership and stable public entrypoints

#### 18. Update install and validator expectations
Review and update:

- install tests
- validator tests
- package validation expectations

Expected install contract remains:

- Claude: `manual + automatic`
- Cursor: `manual + automatic`
- Codex: `manual`
- no public `continuous-learning-core`

Acceptance criteria:

- tests encode the unchanged public install contract
- validators still pass with overlay metadata preserved
- validators still pass with any retained Codex-specific overlay docs

### Phase 7: Documentation Sweep And Cleanup

#### 19. Sweep for stale backend-ownership references
Search for wording that still implies:

- manual owns the backend
- automatic owns project detection
- a public `continuous-learning-core` skill exists

Acceptance criteria:

- repo-wide ownership language is consistent

#### 20. Sweep for stale path references carefully
Search for old implementation-path references and decide case by case whether
they should:

- remain as stable public entrypoints
- move to a different public wrapper
- be removed because they expose private runtime details

Acceptance criteria:

- public docs only expose stable public paths
- private runtime paths are not leaked into command docs

## Recommended Delivery Strategy
This should still be a staged migration, but the stages need different
boundaries than the earlier plan.

### PR 1: Contract freeze, context abstraction, and fixture groundwork
Scope:

- correct doc and test drift for current behavior
- add the location-agnostic runtime context/resolution layer
- add or update test helpers for extracted-runtime installed layouts
- preserve current wrapper exports as an explicit contract

Why first:

- this removes the biggest hidden migration risk before any code move happens
- it turns the later extraction into a relocation behind a defined
  compatibility boundary

### PR 2: Private runtime extraction and wrapper cutover
Scope:

- add `scripts/lib/continuous-learning/`
- move shared implementation there
- turn existing public scripts into wrappers
- update `scripts/codex-observer.js`

Why second:

- this changes the real ownership model only after the compatibility boundary is
  already explicit
- it avoids moving path-sensitive code before layout resolution is stabilized

### PR 3: Skill-doc rewrite and test alignment
Scope:

- rewrite manual and automatic docs around the new boundaries
- update tests to distinguish private runtime from public wrappers
- update validators only where needed for the extracted architecture

Why third:

- once extraction is done, the docs and tests can describe the stable structure
  instead of a moving target

### PR 4: Duplicate removal and final cleanup
Scope:

- remove duplicated implementations from automatic
- trim the Codex overlay
- trim shared manual to public wrappers and docs only
- do final stale-reference cleanup

Why fourth:

- duplicate removal is safest after the new ownership model is already green

## Testing Plan

### Targeted automated tests
Run at minimum:

```bash
node tests/scripts/install-mdt-unit.test.js
node tests/scripts/install-mdt.test.js
node tests/scripts/detect-project.test.js
node tests/scripts/instinct-cli.test.js
node tests/scripts/node-runtime-scripts.test.js
node tests/scripts/codex-observer.test.js
node tests/scripts/continuous-learning-observer.test.js
node tests/scripts/continuous-learning-retrospective.test.js
node tests/hooks/cursor-lifecycle.test.js
node tests/ci/validators.test.js
```

Add focused tests for the new private runtime module as part of the extraction.

Treat wrapper export compatibility and installed-layout fixture coverage as part
of the required test surface, not optional cleanup.

### Execution-surface compatibility suite
Because hooks, skills, commands, and rules are executed by different tool
runtimes, add a dedicated compatibility suite that exercises each supported
execution surface through the same installed-layout contract.

Recommended home:

- `tests/compatibility-testing/`

This folder should be treated as a first-class suite for tool-runtime
compatibility rather than as an overflow location for script tests.

This suite should explicitly cover:

- direct module import of public wrappers
- in-repo execution of public entrypoints
- installed-layout execution from tool config roots
- hook execution under Claude and Cursor-compatible environments
- command execution under Codex, Claude Code, and `cursor-agent`-style env/cwd
- rule materialization or wrapper flows where the tool uses repo-local rule
  files rather than global config files

The goal is not only to keep tests green. It is to surface tool-specific launch
differences early enough that they can be documented as supported behavior,
known limitations, or installer/wrapper requirements.

Current limitation to keep explicit:

- green compatibility tests do not currently mean full end-to-end proof inside
  the real vendor tools
- skipped subprocess-dependent suites must be recorded as uncovered execution
  surfaces, not treated as equivalent to a passing tool-runtime check

Minimum first-pass matrix:

- Codex:
  - public manual script wrappers
  - `scripts/codex-observer.js`
  - installed command surfaces
- Claude Code:
  - public manual wrappers
  - automatic hook path and observer path execution
  - installed layout under `.claude`
- Cursor Agent:
  - public manual wrappers
  - automatic hook-compatible execution where applicable
  - command and rule flows under `~/.cursor/`
- Cursor IDE:
  - repo-local `.cursor/rules/` materialization flow
  - real opened-workspace verification, distinct from Cursor Agent

Suggested initial files:

- `tests/compatibility-testing/README.md`
- `tests/compatibility-testing/codex-compatibility.test.js`
- `tests/compatibility-testing/claude-code-compatibility.test.js`
- `tests/compatibility-testing/cursor-agent-compatibility.test.js`
- `tests/compatibility-testing/cursor-ide-compatibility.test.js`
- `tests/compatibility-testing/shared-fixtures.js`

Where useful, these tests should call the installed smoke surfaces as part of
the check instead of only asserting file presence. For example:

- Codex: installed `smoke` skill plus `smoke-tool-setups.js` and
  `smoke-codex-workflows.js`
- Claude Code: installed `/smoke` command plus `smoke-claude-workflows.js`
- Cursor Agent: installed `/smoke` and `/install-rules` commands plus
  rule-materialization checks

Add a stricter second-pass matrix after the initial suite exists:

- Codex:
  - run the installed Codex surface against a temp repo and verify real
    observation capture and analysis artifacts
- Claude Code:
  - run the installed hook/command surface against a temp repo and verify that
    a real hook event writes project-scoped observations
- Cursor Agent:
  - run the installed command surface through `agent` / `cursor-agent`
    directly, not only via backing Node scripts
- Cursor IDE:
  - verify `/install-rules` against a real opened repo and confirm the
    repo-local `.cursor/rules/` bridge is the path the IDE consumes

For Cursor specifically, lock this command equivalence into the plan:

- `agent` and `cursor-agent` are the same Cursor Agent surface
- on Windows this may resolve through `agent.cmd` or `cursor-agent.cmd`
- tests and wrapper logic should treat those command names as equivalent shims,
  not as separate runtimes

Document any failures found by this suite in the relevant tool docs before
changing ownership assumptions in later extraction PRs.

### Full suite
Before considering the refactor complete:

```bash
node tests/run-all.js
```

### Manual verification
Dry-run installs:

```bash
node scripts/install-mdt.js --target claude --dry-run continuous-learning
node scripts/install-mdt.js --target cursor --dry-run continuous-learning
node scripts/install-mdt.js --target codex --dry-run continuous-learning
node scripts/install-mdt.js --target codex --dry-run continuous-learning-observer
```

Expected results:

- Claude/Cursor still install `continuous-learning-manual` and
  `continuous-learning-automatic`
- Codex still installs `continuous-learning-manual`
- no dry-run mentions a public `continuous-learning-core` skill
- Codex observer dry-run still includes `codex-observer.js`

Also verify:

- automatic hooks still point at `skills/continuous-learning-automatic/hooks/observe.js`
- public instinct commands still work through stable public manual entrypoints
- public wrappers resolve shared behavior from private runtime
- `scripts/codex-observer.js` resolves shared behavior from private runtime or
  an intentional temporary wrapper during the transition
- installed Codex overlay still includes required metadata files
- retained Codex overlay docs still satisfy current validator expectations

### Installed-layout verification
In addition to source-tree tests, verify installed layouts under temporary
override roots for each target:

- Claude override root contains:
  - `skills/continuous-learning-manual/`
  - `skills/continuous-learning-automatic/`
  - runtime scripts under `mdt/scripts/lib/continuous-learning/`
- Cursor override root contains:
  - `skills/continuous-learning-manual/`
  - `skills/continuous-learning-automatic/`
  - runtime scripts under `mdt/scripts/lib/continuous-learning/`
- Codex override root contains:
  - `skills/continuous-learning-manual/`
  - runtime scripts under `mdt/scripts/lib/continuous-learning/`
- Codex override root still contains any required overlay metadata files

### Execution-surface acceptance rule
No migrated hook, skill, command, rule bridge, or observer path should be
considered stable until it has been verified through:

- a direct import contract
- an in-repo wrapper contract
- an installed-layout contract
- the relevant tool execution surface contract if launched by Codex, Claude
  Code, or `cursor-agent`

## Risks And Mitigations

### Risk: Rewiring to private runtime breaks installed layouts
Mitigation:

- rely on the existing runtime-script install surface under `mdt/scripts/lib/`
- verify installed-layout tests in the same PR as extraction

### Risk: Shared code is moved before path-sensitive behavior is removed
Mitigation:

- add a context/resolution layer before relocating shared code
- keep wrappers responsible for installed-layout inference

### Risk: Wrapper location changes behavior across tools
Hooks, commands, and skills often infer config roots, repo roots, or tool
identity from `__dirname`, `process.argv[1]`, or sibling paths.

Mitigation:

- forbid private runtime code from inferring ownership from its own file
  location
- require wrappers to pass explicit context such as `entrypointDir`,
  `configDir`, `configPath`, `cwd`, and tool identity where relevant
- add tests that compare wrapper behavior before and after installed relocation

### Risk: Compatibility tests overstate confidence
Install-shape checks, mocked smoke flows, and direct Node execution can all pass
even when the real external tool runtime would invoke the feature differently.

Mitigation:

- clearly separate repo-side compatibility coverage from real tool-runtime
  verification
- add second-pass tests that execute the installed surface through the actual
  tool command where available
- do not describe the feature as fully verified in a tool until the real tool
  surface has been exercised

### Risk: A stale path contract survives behind wrappers
Even after extraction, a CLI or adapter can continue reading an old layout such
as `homunculus/projects/<id>` while the runtime writes to `homunculus/<id>`.

Mitigation:

- add explicit regression tests for current project storage layout
- audit CL commands for old `projects/` assumptions before calling the split
  complete
- treat path-contract mismatches as release blockers because they create false
  status output even when storage is working

### Risk: Wrapper module exports regress even if CLI behavior stays green
Mitigation:

- treat current public wrapper exports as part of the compatibility contract
- add direct import/require compatibility tests for public wrappers

### Risk: A new migration accidentally exposes private runtime paths to users
Mitigation:

- keep command docs pointed at stable public manual entrypoints
- treat private runtime paths as internal-only

### Risk: Installed-layout drift breaks delegation
Wrappers may work in-repo but fail after install if private runtime files are
not copied into the installed tree or if wrappers rely on the wrong relative
layout.

Mitigation:

- treat installed-layout fixtures as first-class test infrastructure
- verify that installer outputs include all delegated runtime files
- keep extraction and install-layout validation in the same PR when wrappers
  are rewired

### Risk: Subprocess invocation differs between tools and operating systems
Codex, Claude Code, and `cursor-agent` do not all launch child processes the
same way. PATH, shell choice, Windows shims, and nested subprocess restrictions
can break otherwise-correct JS logic.

Mitigation:

- preserve and extend subprocess-focused tests for observer and command flows
- test Windows shim resolution and shell-neutral spawning behavior explicitly
- treat restricted nested-subprocess environments as a known coverage gap to
  document, not as proof that the tool surface is safe
- treat `agent`, `cursor-agent`, `agent.cmd`, and `cursor-agent.cmd` as the
  same Cursor Agent runtime surface when validating command execution

### Risk: Environment inheritance differs by hook, command, and agent surface
Different launch surfaces may provide different `cwd`, PATH, HOME, and
tool-specific environment variables.

Mitigation:

- pass explicit runtime context from public wrappers into private modules
- add agent-surface tests that vary `cwd` and env for Codex, Claude Code, and
  `cursor-agent`
- document any launch assumptions that remain tool-specific after extraction

### Risk: Tool adapters assume public-file ownership or colocated assets
External tool adapters may point at public files that used to own the full
implementation and may implicitly depend on nearby assets or relative docs.

Mitigation:

- audit hook, command, and rule entrypoints before moving their internals
- keep public adapter paths stable while moving ownership behind wrappers
- verify colocated asset access through installed-layout tests

### Risk: Global and project-local surfaces diverge
Some tools split behavior across global config roots and repo-local files. A
wrapper that works for one surface may fail for the other.

Mitigation:

- test both global and repo-local install surfaces where the tool supports both
- keep bridge flows explicit in docs and installer expectations
- do not assume a working global wrapper implies repo-local rule or command
  parity

### Risk: Automatic still owns a duplicated real implementation
Mitigation:

- explicitly remove duplicate ownership from automatic after wrappers are green
- add direct tests for private runtime instead of trusting duplicate files

### Risk: Codex overlay trimming breaks validation
Mitigation:

- keep overlay metadata until validators are deliberately changed
- trim shared implementation only after install and validator tests are green

### Risk: Codex-specific overlay docs get over-trimmed
Mitigation:

- treat validator-required Codex docs as a persistent overlay responsibility
- remove duplicated code independently from doc retention decisions

### Risk: Current contract drift gets carried forward
Mitigation:

- fix doc and test drift in Phase 0
- use current code behavior as the source of truth for this migration

### Risk: Codex observer regresses independently
Mitigation:

- migrate `scripts/codex-observer.js` in the same extraction PR
- keep dedicated observer tests and dry-run verification

### Risk: Observer config ownership becomes ambiguous during extraction
Mitigation:

- keep `config.json` public-surface-owned in this migration
- have shared runtime consume config passed in by wrappers

### Risk: Test environment skips hide real tool-runtime regressions
Some command and subprocess tests may skip or behave differently in constrained
Codex sessions even when the real tool surface would fail.

Mitigation:

- maintain an execution-surface suite that can run outside constrained
  sandboxes
- record which tests are skipped due to runner limitations
- document uncovered launch paths until they are exercised by a less-restricted
  harness

## Acceptance Checklist
- [ ] no public `continuous-learning-core` skill exists
- [ ] shared continuous-learning implementation lives in
      `scripts/lib/continuous-learning/`
- [ ] `continuous-learning-manual` is a public workflow surface, not the backend
      owner
- [ ] `continuous-learning-automatic` is a thin hook surface, not a second
      backend owner
- [ ] current package install behavior remains:
      Claude `manual + automatic`, Cursor `manual + automatic`, Codex `manual`
- [ ] public command and script entrypoints remain stable during migration
- [ ] current named exports from public wrappers remain compatible where tests
      depend on them
- [ ] private runtime code does not depend on its own file location to infer
      public ownership, config ownership, or tool identity
- [ ] installed config-root inference still works for `.claude`, `.cursor`, and
      `.codex`
- [ ] current project storage layout is locked to `homunculus/<project-id>/`
      and no CL command still assumes `homunculus/projects/<project-id>/`
- [ ] migrated hooks, commands, rules, and observers are verified through
      direct import, in-repo wrapper, and installed-layout execution
- [ ] execution-surface compatibility tests exist for Codex, Claude Code, and
      `cursor-agent`-style launches where those surfaces are supported
- [ ] Cursor IDE execution-surface verification is tracked separately from
      Cursor Agent verification
- [ ] any skipped compatibility suites are reported as uncovered rather than
      treated as equivalent to full tool-runtime verification
- [ ] discovered tool-runtime differences are documented in the relevant tool
      docs before duplicate ownership is removed
- [ ] `scripts/codex-observer.js` works with the extracted runtime
- [ ] duplicate implementations are removed from automatic
- [ ] duplicate shared implementations are removed from the Codex overlay
- [ ] required Codex overlay metadata is still present
- [ ] required Codex-specific overlay docs are still present while validators
      require them
- [ ] observer config remains owned by the public manual skill surface
- [ ] docs no longer misstate non-git fallback, hook ownership, or backend
      ownership
- [ ] tests and validators pass with updated expectations

## Recommended Implementation Order
Use this order to minimize breakage:

1. fix contract drift in docs and tests
2. add the shared context/resolution layer
3. add extracted-runtime fixture helpers and compatibility coverage
4. create `scripts/lib/continuous-learning/`
5. move shared implementation there
6. convert public entrypoints into thin wrappers
7. update `scripts/codex-observer.js`
8. rewrite manual and automatic docs around the new ownership model
9. update tests and validators
10. remove duplicated implementations from automatic
11. remove duplicated shared implementation from the Codex overlay
12. do a final stale-reference sweep

## Practical Recommendation
Treat this as a 4-PR runtime extraction, not as a public-skill split.

The safest long-term structure is:

- private shared runtime in `scripts/lib/continuous-learning/`
- public explicit/manual surface in `skills/continuous-learning-manual/`
- public hook surface in `skills/continuous-learning-automatic/`

That structure fixes the real duplication problem, avoids introducing an
infrastructure skill as a user-facing concept, and fits the current installer
and validator architecture with much lower rollout risk.

The key revision to this plan is sequencing: remove path-sensitive coupling
first, then extract the runtime, then trim duplicates only after compatibility
tests and validator expectations are green.

---
name: configure-mdt
description: Interactive installer for ModelDev Toolkit — guides users through selecting and installing skills and rules to user-level or project-level directories, verifies paths, and optionally optimizes installed files.
---

# Configure ModelDev Toolkit (MDT)

An interactive, step-by-step installation wizard for the ModelDev Toolkit project. Uses `AskUserQuestion` to guide users through selective installation of skills and rules, then verifies correctness and offers optimization.

## When to Activate

- User says "configure MDT", "install MDT", "setup ModelDev Toolkit", or similar
- User wants to selectively install skills or rules from this project
- User wants to verify or fix an existing MDT installation
- User wants to optimize installed skills or rules for their project

## Prerequisites

This skill must be accessible to Claude Code before activation. Two ways to bootstrap:
1. **Via Plugin**: `/plugin install modeldev-toolkit` — the plugin loads this skill automatically
2. **Manual**: Copy only this skill to `<config>/skills/configure-mdt/SKILL.md`, then activate by saying "configure MDT"

---

## Step 0: Clone MDT Repository

Before any installation, clone the latest MDT source to `/tmp`:

```bash
rm -rf /tmp/modeldev-toolkit
git clone https://github.com/flatrick/modeldev-toolkit.git /tmp/modeldev-toolkit
```

Set `MDT_ROOT=/tmp/modeldev-toolkit` as the source for all subsequent copy operations.

If the clone fails (network issues, etc.), use `AskUserQuestion` to ask the user to provide a local path to an existing MDT clone.

---

## Step 1: Choose Installation Level

Use `AskUserQuestion` to ask the user where to install:

```
Question: "Where should MDT components be installed?"
Options:
  - "User-level (<config>/)" — "Applies to all projects for the active tool"
  - "Project-level (<project-config>/)" — "Applies only to the current project"
  - "Both" — "Common/shared items user-level, project-specific items project-level"
```

Store the choice as `INSTALL_LEVEL`. Set the target directory:
- User-level: `TARGET=<config>` (for example `~/.claude` or `~/.cursor`)
- Project-level: `TARGET=<project-config>` (for example `./.claude` or `./.cursor`)
- Both: `TARGET_USER=<config>`, `TARGET_PROJECT=<project-config>`

Create the target directories if they don't exist:
```bash
mkdir -p $TARGET/skills $TARGET/rules
```

---

## Step 2: Select & Install Skills

### 2a: Choose Scope (Core vs Niche)

Default to **Core (recommended for new users)** — copy `.agents/skills/*` plus `skills/search-first/` for research-first workflows. This bundle covers engineering, evals, verification, security, strategic compaction, and frontend design.

Use `AskUserQuestion` (single select):
```
Question: "Install core skills only, or include niche/framework packs?"
Options:
  - "Core only (recommended)" — "tdd, e2e, evals, verification, research-first, security, frontend patterns, compacting, cross-functional Anthropic skills"
  - "Core + selected niche" — "Add framework/domain-specific skills after core"
  - "Niche only" — "Skip core, install specific framework/domain skills"
Default: Core only
```

If the user chooses niche or core + niche, continue to category selection below and only include those niche skills they pick.

### 2b: Choose Skill Categories

There are 21 skills organized into 3 categories. Use `AskUserQuestion` with `multiSelect: true`:

```
Question: "Which skill categories do you want to install?"
Options:
  - "Framework & Language" — "Django, Spring Boot, Python, Java, .NET, Rust, Bash, Frontend, Backend patterns"
  - "Database" — "PostgreSQL, JPA/Hibernate patterns"
  - "Workflow & Quality" — "TDD, verification, learning, security review, compaction"
  - "All skills" — "Install every available skill"
```

### 2c: Confirm Individual Skills

For each selected category, print the full list of skills below and ask the user to confirm or deselect specific ones. If the list exceeds 4 items, print the list as text and use `AskUserQuestion` with an "Install all listed" option plus "Other" for the user to paste specific names.

**Category: Framework & Language (17 skills)**

| Skill | Description |
|-------|-------------|
| `backend-patterns` | Backend architecture, API design, server-side best practices for Node.js/Express/Next.js |
| `coding-standards` | Universal coding standards for TypeScript, JavaScript, React, Node.js |
| `django-patterns` | Django architecture, REST API with DRF, ORM, caching, signals, middleware |
| `django-security` | Django security: auth, CSRF, SQL injection, XSS prevention |
| `django-tdd` | Django testing with pytest-django, factory_boy, mocking, coverage |
| `django-verification` | Django verification loop: migrations, linting, tests, security scans |
| `frontend-patterns` | React, Next.js, state management, performance, UI patterns |
| `frontend-slides` | Zero-dependency HTML presentations, style previews, and PPTX-to-web conversion |
| `java-coding-standards` | Java coding standards for Spring Boot: naming, immutability, Optional, streams |
| `python-patterns` | Pythonic idioms, PEP 8, type hints, best practices |
| `python-testing` | Python testing with pytest, TDD, fixtures, mocking, parametrization |
| `springboot-patterns` | Spring Boot architecture, REST API, layered services, caching, async |
| `springboot-security` | Spring Security: authn/authz, validation, CSRF, secrets, rate limiting |
| `springboot-tdd` | Spring Boot TDD with JUnit 5, Mockito, MockMvc, Testcontainers |
| `springboot-verification` | Spring Boot verification: build, static analysis, tests, security scans |

**Category: Database (2 skills)**

| Skill | Description |
|-------|-------------|
| `jpa-patterns` | JPA/Hibernate entity design, relationships, query optimization, transactions |
| `postgres-patterns` | PostgreSQL query optimization, schema design, indexing, security |

**Category: Workflow & Quality (8 skills)**

| Skill | Description |
|-------|-------------|
| `continuous-learning` | Auto-extract reusable patterns from sessions as learned skills |
| `continuous-learning-v2` | Instinct-based learning with confidence scoring, evolves into skills/commands/agents |
| `eval-harness` | Formal evaluation framework for eval-driven development (EDD) |
| `iterative-retrieval` | Progressive context refinement for subagent context problem |
| `security-review` | Security checklist: auth, input, secrets, API, payment features |
| `strategic-compact` | Suggests manual context compaction at logical intervals |
| `tdd-workflow` | Enforces TDD with 80%+ coverage: unit, integration, E2E |
| `verification-loop` | Verification and quality loop patterns |

**Standalone**

| Skill | Description |
|-------|-------------|
| `project-guidelines-example` | Template for creating project-specific skills |

### 2d: Execute Installation

For each selected skill, copy the entire skill directory:
```bash
cp -r $MDT_ROOT/skills/<skill-name> $TARGET/skills/
```

Note: `continuous-learning` and `continuous-learning-v2` have extra files (config.json, hooks, scripts) — ensure the entire directory is copied, not just SKILL.md.

---

## Step 3: Select & Install Rules

Use `AskUserQuestion` with `multiSelect: true`:

```
Question: "Which rule sets do you want to install?"
Options:
  - "Common rules (Recommended)" — "Language-agnostic principles: coding style, git workflow, testing, security, etc. (8 files)"
  - "TypeScript/JavaScript" — "TS/JS patterns, hooks, testing with Playwright (5 files)"
  - "Python" — "Python patterns, pytest, black/ruff formatting (5 files)"
  - "Bash" — "Bash scripting patterns, safety, portability, bats-core testing (5 files)"
```

Execute installation:
```bash
# Common rules (flat copy into rules/)
cp -r $MDT_ROOT/rules/common/* $TARGET/rules/

# Language-specific rules (flat copy into rules/)
cp -r $MDT_ROOT/rules/typescript/* $TARGET/rules/   # if selected
cp -r $MDT_ROOT/rules/python/* $TARGET/rules/        # if selected
cp -r $MDT_ROOT/rules/bash/* $TARGET/rules/          # if selected
```

**Important**: If the user selects any language-specific rules but NOT common rules, warn them:
> "Language-specific rules extend the common rules. Installing without common rules may result in incomplete coverage. Install common rules too?"

---

## Step 4: Post-Installation Verification

After installation, perform these automated checks:

### 4a: Verify File Existence

List all installed files and confirm they exist at the target location:
```bash
ls -la $TARGET/skills/
ls -la $TARGET/rules/
```

### 4b: Check Path References

Scan all installed `.md` files for path references:
```bash
grep -rn "~/.claude/" $TARGET/skills/ $TARGET/rules/
grep -rn "../common/" $TARGET/rules/
grep -rn "skills/" $TARGET/skills/
```

**For project-level installs**, flag any legacy `~/.claude/` references:
- If a skill references `~/.claude/settings.json` — update it to your tool's config dir if needed
- If a skill references `~/.claude/skills/` or `~/.claude/rules/` — this may be broken if installed only at project level
- If a skill references another skill by name — check that the referenced skill was also installed

### 4c: Check Cross-References Between Skills

Some skills reference others. Verify these dependencies:
- `django-tdd` may reference `django-patterns`
- `springboot-tdd` may reference `springboot-patterns`
- `continuous-learning-v2` references `<data>/homunculus/`
- `python-testing` may reference `python-patterns`
- Language-specific rules reference `common/` counterparts

### 4d: Report Issues

For each issue found, report:
1. **File**: The file containing the problematic reference
2. **Line**: The line number
3. **Issue**: What's wrong (e.g., "references legacy ~/.claude/skills/python-patterns but python-patterns was not installed")
4. **Suggested fix**: What to do (e.g., "install python-patterns skill" or "update path to <project-config>/skills/")

---

## Step 5: Optimize Installed Files (Optional)

Use `AskUserQuestion`:

```
Question: "Would you like to optimize the installed files for your project?"
Options:
  - "Optimize skills" — "Remove irrelevant sections, adjust paths, tailor to your tech stack"
  - "Optimize rules" — "Adjust coverage targets, add project-specific patterns, customize tool configs"
  - "Optimize both" — "Full optimization of all installed files"
  - "Skip" — "Keep everything as-is"
```

### If optimizing skills:
1. Read each installed SKILL.md
2. Ask the user what their project's tech stack is (if not already known)
3. For each skill, suggest removals of irrelevant sections
4. Edit the SKILL.md files in-place at the installation target (NOT the source repo)
5. Fix any path issues found in Step 4

### If optimizing rules:
1. Read each installed rule .md file
2. Ask the user about their preferences:
   - Test coverage target (default 80%)
   - Preferred formatting tools
   - Git workflow conventions
   - Security requirements
3. Edit the rule files in-place at the installation target

**Critical**: Only modify files in the installation target (`$TARGET/`), NEVER modify files in the source MDT repository (`$MDT_ROOT/`).

---

## Step 6: Installation Summary

Clean up the cloned repository from `/tmp`:

```bash
rm -rf /tmp/modeldev-toolkit
```

Then print a summary report:

```
## MDT Installation Complete

### Installation Target
- Level: [user-level / project-level / both]
- Path: [target path]

### Skills Installed ([count])
- skill-1, skill-2, skill-3, ...

### Rules Installed ([count])
- common (8 files)
- typescript (5 files)
- ...

### Verification Results
- [count] issues found, [count] fixed
- [list any remaining issues]

### Optimizations Applied
- [list changes made, or "None"]
```

---

## Troubleshooting

### "Skills not being picked up by Claude Code"
- Verify the skill directory contains a `SKILL.md` file (not just loose .md files)
- For user-level: check `<config>/skills/<skill-name>/SKILL.md` exists
- For project-level: check `<project-config>/skills/<skill-name>/SKILL.md` exists

### "Rules not working"
- Rules are flat files, not in subdirectories: `$TARGET/rules/coding-style.md` (correct) vs `$TARGET/rules/common/coding-style.md` (incorrect for flat install)
- Restart Claude Code after installing rules

### "Path reference errors after project-level install"
- Some skills may still assume legacy `~/.claude/` paths. Run Step 4 verification to find and fix these.
- For `continuous-learning-v2`, the `<data>/homunculus/` directory is always user-level — this is expected and not an error.

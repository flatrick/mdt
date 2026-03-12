#!/usr/bin/env node
/**
 * ModelDev Toolkit installer.
 * Node-only installer for rules, agents, skills, commands, hooks, and configs.
 *
 * Usage:
 *   node scripts/install-mdt.js [--target claude|cursor|codex|gemini] [--global] [--override <tool-config-dir>] [--dev] [package ...]
 *
 * Examples:
 *   node scripts/install-mdt.js typescript
 *   node scripts/install-mdt.js --target cursor typescript
 *   node scripts/install-mdt.js --target cursor --override C:\temp\.cursor typescript
 *   node scripts/install-mdt.js --target cursor --global typescript
 *   node scripts/install-mdt.js --target codex typescript continuous-learning
 *
 * Targets:
 *   claude (default) — Install to ~/.claude/
 *   cursor           — Install to ~/.cursor/
 *   codex            — Install to ~/.codex/
 *   gemini           — Install to ~/.gemini/
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getHookPlatform } = require('./lib/hook-platforms');
const { loadSkillMetadataByName } = require('./lib/skill-metadata');

const REPO_ROOT = path.join(__dirname, '..');
const RULES_DIR = path.join(REPO_ROOT, 'rules');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');
const CURSOR_SRC = path.join(REPO_ROOT, 'cursor-template');
const CODEX_SRC = path.join(REPO_ROOT, 'codex-template');
const CODEX_SKILLS_SRC = path.join(CODEX_SRC, 'skills');
const CODEX_RULES_SRC = path.join(CODEX_SRC, 'rules');
const SHARED_SKILLS_SRC = path.join(REPO_ROOT, 'skills');
const SHARED_COMMANDS_SRC = path.join(REPO_ROOT, 'commands');
const RUNTIME_CI_FILES = [
  'markdown-utils.js',
  'validate-markdown-links.js',
  'validate-markdown-path-refs.js'
];
const CLAUDE_WORKFLOW_SCRIPTS = ['smoke-claude-workflows.js'];
const DEV_SMOKE_SCRIPT_FILES = ['smoke-tool-setups.js'];
const CURSOR_WORKFLOW_SCRIPT_FILES = ['materialize-mdt-local.js', 'smoke-cursor-workflows.js'];
const CODEX_DEV_SKILL_NAMES = ['tool-setup-verifier', 'smoke'];
const BASELINE_SHARED_SKILL_NAMES = [
  'api-design',
  'autonomous-loops',
  'backend-patterns',
  'coding-standards',
  'content-hash-cache-pattern',
  'database-migrations',
  'deployment-patterns',
  'eval-harness',
  'frontend-patterns',
  'iterative-retrieval',
  'project-guidelines-example',
  'regex-vs-llm-structured-text',
  'search-first',
  'security-review',
  'security-scan',
  'skill-stocktake',
  'strategic-compact',
  'tdd-workflow',
  'verification-loop'
];
const WORKFLOW_CONTRACTS_DIR = path.join(REPO_ROOT, 'workflow-contracts');
const TARGET_CAPABILITIES = {
  claude: { hooks: 'official', runtimeScripts: true, sessionData: true },
  cursor: { hooks: 'experimental', runtimeScripts: true, sessionData: true },
  gemini: { hooks: false, runtimeScripts: false, sessionData: false },
  codex: { hooks: false, runtimeScripts: true, sessionData: true }
};

function mergeUniqueOrdered(...arrays) {
  const seen = new Set();
  const merged = [];

  for (const values of arrays) {
    if (!Array.isArray(values)) {
      continue;
    }
    for (const value of values) {
      if (seen.has(value)) {
        continue;
      }
      seen.add(value);
      merged.push(value);
    }
  }

  return merged;
}

function parseArgs() {
  const args = process.argv.slice(2);
  return parseArgsFrom(args);
}

function createDefaultCliArgs() {
  return {
    target: 'claude',
    globalScope: false,
    listMode: false,
    dryRun: false,
    devMode: false,
    projectDir: null,
    overrideDir: null,
    packageNames: []
  };
}

const SIMPLE_CLI_FLAGS = {
  '--global': 'globalScope',
  '--list': 'listMode',
  '--dry-run': 'dryRun',
  '--dev': 'devMode'
};

function applyCliPairArg(state, arg, nextArg) {
  if (arg === '--target' && nextArg) {
    state.target = nextArg === 'antigravity' ? 'gemini' : nextArg;
    return true;
  }
  if (arg === '--project-dir' && nextArg) {
    state.projectDir = path.resolve(nextArg);
    return true;
  }
  if (arg === '--override' && nextArg) {
    state.overrideDir = path.resolve(nextArg);
    return true;
  }
  return false;
}

function applyCliArg(state, args, index) {
  const arg = args[index];
  const nextArg = args[index + 1];

  if (applyCliPairArg(state, arg, nextArg)) {
    return index + 1;
  }

  if (SIMPLE_CLI_FLAGS[arg]) {
    state[SIMPLE_CLI_FLAGS[arg]] = true;
    return index;
  }
  if (!arg.startsWith('-')) {
    state.packageNames.push(arg);
  }
  return index;
}

function parseArgsFrom(args) {
  const state = createDefaultCliArgs();
  for (let i = 0; i < args.length; i++) {
    i = applyCliArg(state, args, i);
  }
  return state;
}

function normalizePackageRequires(requiresValue) {
  if (!requiresValue || typeof requiresValue !== 'object' || Array.isArray(requiresValue)) {
    return {};
  }

  const normalized = {};
  for (const key of ['hooks', 'runtimeScripts', 'sessionData']) {
    if (requiresValue[key] === true) {
      normalized[key] = true;
    }
  }

  if (Array.isArray(requiresValue.tools)) {
    normalized.tools = requiresValue.tools.filter((toolName) => typeof toolName === 'string' && toolName.trim().length > 0);
  }

  return normalized;
}

function getAvailablePackages() {
  if (!fs.existsSync(PACKAGES_DIR)) {
    return [];
  }

  return fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(PACKAGES_DIR, entry.name, 'package.json')))
    .map((entry) => entry.name)
    .sort();
}

function normalizeManifestList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeManifestTools(parsed) {
  return typeof parsed.tools === 'object' && parsed.tools ? parsed.tools : {};
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object';
}

function loadPackageManifest(packageName, options = {}) {
  const packagesDir = options.packagesDir || PACKAGES_DIR;
  const packagePath = path.join(packagesDir, packageName, 'package.json');
  if (!fs.existsSync(packagePath)) {
    throw new Error(`Unknown package '${packageName}'`);
  }

  const parsed = readJsonFile(packagePath, null);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid package manifest for '${packageName}'`);
  }

  return {
    name: parsed.name || packageName,
    description: parsed.description || '',
    ruleDirectory: parsed.ruleDirectory || packageName,
    extends: normalizeManifestList(parsed.extends),
    kind: typeof parsed.kind === 'string' ? parsed.kind : 'language',
    rules: normalizeManifestList(parsed.rules),
    agents: normalizeManifestList(parsed.agents),
    commands: normalizeManifestList(parsed.commands),
    skills: normalizeManifestList(parsed.skills),
    requires: normalizePackageRequires(parsed.requires),
    tools: normalizeManifestTools(parsed)
  };
}

function mergeToolConfigEntry(parentConfig, childConfig) {
  if (!parentConfig && childConfig) {
    return childConfig;
  }
  if (parentConfig && !childConfig) {
    return parentConfig;
  }
  if (!(isObject(parentConfig) && isObject(childConfig))) {
    return childConfig !== undefined ? childConfig : parentConfig;
  }

  const mergedConfig = {};
  const configKeys = mergeUniqueOrdered(Object.keys(parentConfig), Object.keys(childConfig));
  for (const key of configKeys) {
    const parentValue = parentConfig[key];
    const childValue = childConfig[key];
    if (Array.isArray(parentValue) || Array.isArray(childValue)) {
      mergedConfig[key] = mergeUniqueOrdered(parentValue, childValue);
    } else {
      mergedConfig[key] = childValue !== undefined ? childValue : parentValue;
    }
  }
  return mergedConfig;
}

function mergeToolConfigs(parentTools, childTools) {
  const mergedTools = {};
  const toolNames = mergeUniqueOrdered(
    Object.keys(parentTools || {}),
    Object.keys(childTools || {})
  );

  for (const toolName of toolNames) {
    mergedTools[toolName] = mergeToolConfigEntry(parentTools?.[toolName], childTools?.[toolName]);
  }

  return mergedTools;
}

function mergeRequiredToolLists(parentTools, childTools) {
  if (parentTools && childTools) {
    return parentTools.filter((toolName) => childTools.includes(toolName));
  }
  if (parentTools) {
    return [...parentTools];
  }
  if (childTools) {
    return [...childTools];
  }
  return null;
}

function mergePackageRequires(parentRequires, childRequires) {
  const merged = {};

  for (const key of ['hooks', 'runtimeScripts', 'sessionData']) {
    if (parentRequires?.[key] || childRequires?.[key]) {
      merged[key] = true;
    }
  }

  const parentTools = Array.isArray(parentRequires?.tools) ? parentRequires.tools : null;
  const childTools = Array.isArray(childRequires?.tools) ? childRequires.tools : null;
  const mergedTools = mergeRequiredToolLists(parentTools, childTools);
  if (mergedTools) {
    merged.tools = mergedTools;
  }

  return merged;
}

function resolvePackageManifest(packageName, options = {}, state = {}) {
  const cache = state.cache || new Map();
  const stack = state.stack || [];

  if (cache.has(packageName)) {
    return cache.get(packageName);
  }

  if (stack.includes(packageName)) {
    throw new Error(`Package extends cycle detected: ${[...stack, packageName].join(' -> ')}`);
  }

  const rawManifest = loadPackageManifest(packageName, options);
  const nextState = { cache, stack: [...stack, packageName] };
  const inheritedManifests = rawManifest.extends.map((extendedName) => resolvePackageManifest(extendedName, options, nextState));

  const inheritedManifest = inheritedManifests.reduce((mergedManifest, parentManifest) => ({
    ...mergedManifest,
    ruleDirectory: mergedManifest.ruleDirectory || parentManifest.ruleDirectory,
    rules: mergeUniqueOrdered(mergedManifest.rules, parentManifest.rules),
    agents: mergeUniqueOrdered(mergedManifest.agents, parentManifest.agents),
    commands: mergeUniqueOrdered(mergedManifest.commands, parentManifest.commands),
    skills: mergeUniqueOrdered(mergedManifest.skills, parentManifest.skills),
    requires: mergePackageRequires(mergedManifest.requires, parentManifest.requires),
    tools: mergeToolConfigs(mergedManifest.tools, parentManifest.tools)
  }), {
    ruleDirectory: '',
    rules: [],
    agents: [],
    commands: [],
    skills: [],
    requires: {},
    tools: {}
  });

  const resolvedManifest = {
    ...rawManifest,
    ruleDirectory: rawManifest.ruleDirectory || inheritedManifest.ruleDirectory,
    rules: mergeUniqueOrdered(inheritedManifest.rules, rawManifest.rules),
    agents: mergeUniqueOrdered(inheritedManifest.agents, rawManifest.agents),
    commands: mergeUniqueOrdered(inheritedManifest.commands, rawManifest.commands),
    skills: mergeUniqueOrdered(inheritedManifest.skills, rawManifest.skills),
    requires: mergePackageRequires(inheritedManifest.requires, rawManifest.requires),
    tools: mergeToolConfigs(inheritedManifest.tools, rawManifest.tools)
  };

  cache.set(packageName, resolvedManifest);
  return resolvedManifest;
}

function resolveSelectedPackages(packageNames, options = {}) {
  return packageNames.map((packageName) => resolvePackageManifest(packageName, options));
}

function getSelectedPackageSummary(selectedPackages) {
  if (!selectedPackages.length) {
    return '(none provided)';
  }

  return selectedPackages.map((pkg) => pkg.name).join(', ');
}

function getManifestRuleSelections(selectedPackages) {
  return mergeUniqueOrdered(
    ...selectedPackages.map((pkg) => Array.isArray(pkg.rules) ? pkg.rules : [])
  );
}

function getManifestSelections(selectedPackages, key) {
  return mergeUniqueOrdered(
    ...selectedPackages.map((pkg) => Array.isArray(pkg[key]) ? pkg[key] : [])
  );
}

function getToolManifestSelections(selectedPackages, toolName, key) {
  return mergeUniqueOrdered(
    ...selectedPackages.map((pkg) => {
      const toolConfig = pkg.tools && typeof pkg.tools === 'object' ? pkg.tools[toolName] : null;
      return Array.isArray(toolConfig?.[key]) ? toolConfig[key] : [];
    })
  );
}

function getPackageRequirementWarnings(target, selectedPackages) {
  const capabilities = TARGET_CAPABILITIES[target];
  if (!capabilities) {
    return [];
  }

  const warnings = [];
  for (const selectedPackage of selectedPackages) {
    const requires = selectedPackage.requires || {};
    if (requires.hooks && capabilities.hooks === 'experimental') {
      warnings.push(
        `package '${selectedPackage.name}' requires hooks. Cursor hook support is experimental in this repo today.`
      );
    }
  }

  return warnings;
}

function getDevSkillNamesForTarget(target, devMode = false) {
  if (!devMode) {
    return [];
  }

  if (target === 'codex') {
    return ['tool-doc-maintainer', ...CODEX_DEV_SKILL_NAMES];
  }

  return ['tool-doc-maintainer'];
}

function getSelectedSkillNamesForTarget(target, selectedPackages, devMode = false) {
  const sharedSkillNames = target === 'codex'
    ? []
    : getManifestSelections(selectedPackages, 'skills');
  const toolSkillNames = getToolManifestSelections(selectedPackages, target, 'skills');
  const devSkillNames = getDevSkillNamesForTarget(target, devMode);
  return mergeUniqueOrdered(sharedSkillNames, toolSkillNames, devSkillNames);
}

function loadSelectedSkillMetadata(target, skillName) {
  if (target === 'codex') {
    return loadSkillMetadataByName(skillName, { skillsDir: CODEX_SKILLS_SRC }) || loadSkillMetadataByName(skillName);
  }

  if (target === 'cursor') {
    return loadSkillMetadataByName(skillName, { skillsDir: path.join(CURSOR_SRC, 'skills') }) || loadSkillMetadataByName(skillName);
  }

  return loadSkillMetadataByName(skillName);
}

function getSelectedRuleNamesForTarget(target, selectedPackages) {
  if (target === 'cursor') {
    return mergeUniqueOrdered(
      getManifestRuleSelections(selectedPackages),
      getToolManifestSelections(selectedPackages, 'cursor', 'rules')
    );
  }

  if (target === 'codex') {
    return mergeUniqueOrdered(
      getManifestRuleSelections(selectedPackages),
      getToolManifestSelections(selectedPackages, 'codex', 'rules')
    );
  }

  if (target === 'gemini') {
    return mergeUniqueOrdered(
      getManifestRuleSelections(selectedPackages),
      getToolManifestSelections(selectedPackages, 'gemini', 'rules')
    );
  }

  return getManifestRuleSelections(selectedPackages);
}

function collectSkillDependencyErrors(skillName, skillMetadata, selectedRuleNames, selectedSkillNames) {
  const errors = [];
  for (const requiredRule of skillMetadata.requires.rules) {
    if (!selectedRuleNames.has(requiredRule)) {
      errors.push(`skill '${skillName}' declares rule dependency '${requiredRule}', but the selected package set does not include it`);
    }
  }
  for (const companionSkill of skillMetadata.requires.skills) {
    if (!selectedSkillNames.has(companionSkill)) {
      errors.push(`skill '${skillName}' declares companion skill '${companionSkill}', but it is not part of this install selection`);
    }
  }
  return errors;
}

function collectSkillCapabilityErrors(skillName, skillMetadata, target, capabilities) {
  const errors = [];
  if (skillMetadata.requires.runtime.runtimeScripts && !capabilities.runtimeScripts) {
    errors.push(`skill '${skillName}' expects runtime scripts, but target '${target}' does not install MDT runtime scripts`);
  }
  if (skillMetadata.requires.runtime.sessionData && !capabilities.sessionData) {
    errors.push(`skill '${skillName}' expects session data support, but target '${target}' does not provide it`);
  }
  return errors;
}

function collectSkillHookWarnings(skillName, skillMetadata, target, capabilities) {
  const errors = [];
  const warnings = [];
  const hookMode = skillMetadata.requires.runtime.hooks.mode;
  const hookTools = skillMetadata.requires.runtime.hooks.tools;

  if (!hookTools.includes(target)) {
    return { errors, warnings };
  }
  if (hookMode === 'required' && !capabilities.hooks) {
    errors.push(`skill '${skillName}' requires hooks for target '${target}', but that target does not support MDT hook installs`);
  } else if (hookMode === 'required' && capabilities.hooks === 'experimental') {
    warnings.push(`skill '${skillName}' depends on hooks for target '${target}', but that hook support is experimental in this repo`);
  }
  return { errors, warnings };
}

function validateSelectedSkillMetadata(target, skillName, selectedRuleNames, selectedSkillNames, capabilities) {
  const skillMetadata = loadSelectedSkillMetadata(target, skillName);
  const errors = [];
  const warnings = [];

  if (!skillMetadata) {
    errors.push(`skill '${skillName}' is selected for target '${target}', but no skill directory exists under skills/`);
    return { errors, warnings };
  }

  if (!skillMetadata.hasMetaFile) {
    errors.push(`skill '${skillName}' is selected for target '${target}', but ${path.relative(REPO_ROOT, skillMetadata.skillDir).replace(/\\/g, '/')} is missing skill.meta.json`);
    return { errors, warnings };
  }
  errors.push(...collectSkillDependencyErrors(skillName, skillMetadata, selectedRuleNames, selectedSkillNames));
  errors.push(...collectSkillCapabilityErrors(skillName, skillMetadata, target, capabilities));
  const hookResult = collectSkillHookWarnings(skillName, skillMetadata, target, capabilities);
  errors.push(...hookResult.errors);
  warnings.push(...hookResult.warnings);

  return { errors, warnings };
}

function evaluateSkillRequirements(target, selectedPackages, devMode = false) {
  const capabilities = TARGET_CAPABILITIES[target];
  if (!capabilities) {
    return { errors: [], warnings: [] };
  }

  const selectedRuleNames = new Set(getSelectedRuleNamesForTarget(target, selectedPackages));
  const selectedSkillNames = new Set(getSelectedSkillNamesForTarget(target, selectedPackages, devMode));
  const errors = [];
  const warnings = [];

  for (const skillName of selectedSkillNames) {
    const result = validateSelectedSkillMetadata(target, skillName, selectedRuleNames, selectedSkillNames, capabilities);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return { errors, warnings };
}

function getSkillRequirementWarnings(target, selectedPackages, devMode = false) {
  return evaluateSkillRequirements(target, selectedPackages, devMode).warnings;
}

function assertSkillRequirements(target, selectedPackages, devMode = false) {
  const { errors, warnings } = evaluateSkillRequirements(target, selectedPackages, devMode);
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }
  return warnings;
}

function assertInstallRequirements(target, selectedPackages, devMode = false) {
  return [
    ...assertPackageRequirements(target, selectedPackages),
    ...assertSkillRequirements(target, selectedPackages, devMode)
  ];
}

function assertPackageRequirements(target, selectedPackages) {
  const capabilities = TARGET_CAPABILITIES[target];
  if (!capabilities) {
    throw new Error(`Unknown target '${target}'`);
  }

  for (const selectedPackage of selectedPackages) {
    assertSinglePackageRequirements(target, selectedPackage, capabilities);
  }

  return getPackageRequirementWarnings(target, selectedPackages);
}

function assertSinglePackageRequirements(target, selectedPackage, capabilities) {
  const requires = selectedPackage.requires || {};
  const allowedTools = Array.isArray(requires.tools) ? requires.tools : null;
  if (allowedTools && !allowedTools.includes(target)) {
    throw new Error(`Package '${selectedPackage.name}' does not support target '${target}'`);
  }
  if (requires.hooks && !capabilities.hooks) {
    throw new Error(`Package '${selectedPackage.name}' requires hooks, but target '${target}' does not support MDT hook installs`);
  }
  if (requires.runtimeScripts && !capabilities.runtimeScripts) {
    throw new Error(`Package '${selectedPackage.name}' requires runtime scripts, but target '${target}' does not install MDT runtime scripts`);
  }
  if (requires.sessionData && !capabilities.sessionData) {
    throw new Error(`Package '${selectedPackage.name}' requires session data support, but target '${target}' does not provide it`);
  }
}

function printAvailableOptions(_target) {
  console.log('Available targets: claude, cursor, codex, gemini');
  const packages = getAvailablePackages();
  console.log('Available packages:');
  if (packages.length === 0) {
    console.log('  (none found under packages/)');
  } else {
    packages.forEach((packageName) => console.log('  - ' + packageName));
  }
}

function resolveInstallRoot(target, overrideDir = null) {
  if (overrideDir) {
    return overrideDir;
  }

  if (target === 'claude') {
    return process.env.CLAUDE_BASE_DIR || path.join(os.homedir(), '.claude');
  }
  if (target === 'cursor') {
    return path.join(os.homedir(), '.cursor');
  }
  if (target === 'codex') {
    return path.join(os.homedir(), '.codex');
  }
  if (target === 'gemini') {
    return path.join(os.homedir(), '.gemini');
  }

  throw new Error(`Unsupported target '${target}'`);
}

function resolveMdtRoot(installRoot) {
  return path.join(installRoot, 'mdt');
}

function getDryRunHeader(target, overrideDir = null) {
  const installRoot = resolveInstallRoot(target, overrideDir);
  return [
    `[dry-run] Target: ${target} (global)`,
    `[dry-run] Tool config root: ${installRoot}`,
    `[dry-run] MDT root: ${resolveMdtRoot(installRoot)}`
  ];
}

function buildCodexInstallPlan(lines, selectedPackages, overrideDir, devMode) {
  const packages = getSelectedPackageSummary(selectedPackages);
  const userCodexDir = resolveInstallRoot('codex', overrideDir);
  const mdtRoot = resolveMdtRoot(userCodexDir);
  const codexScripts = getToolManifestSelections(selectedPackages, 'codex', 'scripts');
  return [
    ...lines,
    `[dry-run] Packages: ${packages}`,
    `[dry-run] Would install Codex config to ${path.join(userCodexDir, 'config.toml')}`,
    `[dry-run] Would install Codex AGENTS.md to ${path.join(userCodexDir, 'AGENTS.md')}`,
    `[dry-run] Would install Codex rules to ${path.join(userCodexDir, 'rules')}`,
    `[dry-run] Would install Codex skills to ${path.join(userCodexDir, 'skills')}`,
    `[dry-run] Would install Codex runtime scripts to ${path.join(mdtRoot, 'scripts')}`,
    ...(devMode
      ? [
        `[dry-run] Would install Codex dev smoke skill to ${path.join(userCodexDir, 'skills')}`,
        `[dry-run] Would install Codex dev smoke workflow scripts to ${path.join(mdtRoot, 'scripts')}`
      ]
      : []),
    ...(codexScripts.length > 0
      ? [`[dry-run] Would install package-selected Codex workflow scripts to ${path.join(mdtRoot, 'scripts')}`]
      : [])
  ];
}

function buildGeminiInstallPlan(lines, selectedPackages, overrideDir) {
  const geminiRoot = resolveInstallRoot('gemini', overrideDir);
  const agentsDest = path.join(geminiRoot, 'antigravity', '.agents');
  const cmdsDest = path.join(geminiRoot, 'commands');
  const nextLines = [
    ...lines,
    `[dry-run] Packages: ${getSelectedPackageSummary(selectedPackages)}`,
    `[dry-run] Would install agents and skills to ${agentsDest}`,
    `[dry-run] Would install custom commands to ${cmdsDest}`,
    `[dry-run] Would install runtime state under ${resolveMdtRoot(geminiRoot)}`
  ];

  if (selectedPackages.length === 0) {
    return nextLines;
  }

  const packageNames = selectedPackages.map((pkg) => pkg.name);
  return [
    ...nextLines,
    `[dry-run] Would append rules for packages [${packageNames.join(', ')}] to ${path.join(geminiRoot, 'GEMINI.md')}`
  ];
}

function buildClaudeInstallPlan(lines, selectedPackages, overrideDir, devMode = false) {
  const packages = getSelectedPackageSummary(selectedPackages);
  const claudeBase = resolveInstallRoot('claude', overrideDir);
  const mdtRoot = resolveMdtRoot(claudeBase);

  return [
    ...lines,
    `[dry-run] Packages: ${packages}`,
    `[dry-run] Would install into ${claudeBase}`,
    `[dry-run] Would copy rules, package-selected agents/commands/skills, hooks, and runtime scripts to ${mdtRoot}`,
    `[dry-run] Would grant Edit/Write permissions for ${mdtRoot}/ in settings.json`,
    ...(devMode ? [
      `[dry-run] Would install Claude dev smoke command to ${path.join(claudeBase, 'commands')}`,
      `[dry-run] Would install Claude dev smoke scripts to ${path.join(mdtRoot, 'scripts')}`
    ] : [])
  ];
}

function buildCursorInstallPlan(lines, selectedPackages, overrideDir, devMode = false) {
  const packages = getSelectedPackageSummary(selectedPackages);
  const cursorBase = resolveInstallRoot('cursor', overrideDir);
  const mdtRoot = resolveMdtRoot(cursorBase);
  return [
    ...lines,
    `[dry-run] Packages: ${packages}`,
    `[dry-run] Would install into ${cursorBase}`,
    `[dry-run] Would install Cursor rules, package-selected agents/skills/commands, hook config, mcp config, and runtime scripts under ${mdtRoot}`,
    ...(devMode ? [`[dry-run] Would install Cursor dev smoke command to ${path.join(cursorBase, 'commands')}`] : []),
    `[dry-run] Local exception bridges, if needed later, would materialize only the missing surface into the active repo`
  ];
}

function buildInstallPlan({ target, devMode, overrideDir, packageNames }) {
  const header = getDryRunHeader(target, overrideDir);
  const selectedPackages = target === 'codex' && packageNames.length === 0
    ? []
    : resolveSelectedPackages(packageNames);
  const warnings = selectedPackages.length === 0
    ? []
    : [
      ...assertInstallRequirements(target, selectedPackages, devMode).map((warning) => `[dry-run] Warning: ${warning}`)
    ];

  if (target === 'codex') return [...warnings, ...buildCodexInstallPlan(header, selectedPackages, overrideDir, devMode)];
  if (target === 'gemini') return [...warnings, ...buildGeminiInstallPlan(header, selectedPackages, overrideDir)];
  if (target === 'claude') return [...warnings, ...buildClaudeInstallPlan(header, selectedPackages, overrideDir, devMode)];

  return [...warnings, ...buildCursorInstallPlan(header, selectedPackages, overrideDir, devMode)];
}

function copyRecursiveSync(srcDir, destDir, filter = () => true) {
  if (!fs.existsSync(srcDir)) return;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  fs.mkdirSync(destDir, { recursive: true });
  for (const e of entries) {
    const srcPath = path.join(srcDir, e.name);
    const destPath = path.join(destDir, e.name);
    if (e.isDirectory()) {
      copyRecursiveSync(srcPath, destPath, filter);
    } else if (e.isFile() && filter(e.name)) {
      copyFileAtomicSync(srcPath, destPath);
    }
  }
}

function copyFileAtomicSync(srcPath, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const tempPath = `${destPath}.tmp-${process.pid}-${Date.now()}`;
  fs.copyFileSync(srcPath, tempPath);

  if (process.platform === 'win32' && fs.existsSync(destPath)) {
    fs.unlinkSync(destPath);
  }

  fs.renameSync(tempPath, destPath);
}

function copyRuntimeScripts(destScriptsDir) {
  const runtimeDirs = ['hooks', 'lib'];
  for (const dirName of runtimeDirs) {
    const srcDir = path.join(REPO_ROOT, 'scripts', dirName);
    const destDir = path.join(destScriptsDir, dirName);
    if (fs.existsSync(srcDir)) {
      copyRecursiveSync(srcDir, destDir);
    }
  }

  const ciSrcDir = path.join(REPO_ROOT, 'scripts', 'ci');
  const ciDestDir = path.join(destScriptsDir, 'ci');
  if (copyExplicitFiles(ciSrcDir, ciDestDir, RUNTIME_CI_FILES, 'Runtime CI script') > 0) {
    // Installed docs-health workflows rely on these validator scripts.
  }

  copyExplicitFiles(path.join(REPO_ROOT, 'scripts'), destScriptsDir, ['mdt.js'], 'Runtime CLI script');
}

function ensureMdtRoot(installRoot) {
  const mdtRoot = resolveMdtRoot(installRoot);
  fs.mkdirSync(mdtRoot, { recursive: true });
  return mdtRoot;
}

function copyRuntimeScriptsToMdtRoot(installRoot) {
  const scriptsDest = path.join(ensureMdtRoot(installRoot), 'scripts');
  copyRuntimeScripts(scriptsDest);
  return scriptsDest;
}

function usage(_target) {
  console.error('Usage: node scripts/install-mdt.js [--target claude|cursor|codex|gemini] [--global] [--override <tool-config-dir>] [--list] [--dry-run] [package ...]');
  console.error('');
  console.error('Targets:');
  console.error('  claude (default) — Install to ~/.claude/');
  console.error('  cursor           — Install to ~/.cursor/');
  console.error('  codex            — Install to ~/.codex/');
  console.error('  gemini           — Install to ~/.gemini/');
  console.error('');
  console.error('Options:');
  console.error('  --global         — Compatibility alias; installs are global by default.');
  console.error('  --override       — Install into the provided tool-config dir instead of the real ~/.tool root.');
  console.error('  --list           — Show available targets/packages and exit.');
  console.error('  --dry-run        — Print planned install actions without writing files.');
  console.error('');
  console.error('Available packages:');
  getAvailablePackages().forEach((packageName) => console.error('  - ' + packageName));
  process.exit(1);
}

function copySelectedMarkdownFiles(srcDir, destDir, fileNames, missingContext = '') {
  if (!fs.existsSync(srcDir) || fileNames.length === 0) return 0;
  fs.mkdirSync(destDir, { recursive: true });
  let copied = 0;
  for (const fileName of fileNames) {
    const srcPath = path.join(srcDir, fileName);
    const destPath = path.join(destDir, fileName);
    if (!fs.existsSync(srcPath)) {
      if (missingContext) {
        console.error(`Warning: ${missingContext} '${fileName}' does not exist, skipping.`);
      }
      continue;
    }
    copyFileAtomicSync(srcPath, destPath);
    copied++;
  }
  return copied;
}

function copySelectedDirectories(srcDir, destDir, dirNames, missingContext = '') {
  if (!fs.existsSync(srcDir) || dirNames.length === 0) return 0;
  let copied = 0;
  for (const dirName of dirNames) {
    const dirSrc = path.join(srcDir, dirName);
    const dirDest = path.join(destDir, dirName);
    if (!fs.existsSync(dirSrc)) {
      if (missingContext) {
        console.error(`Warning: ${missingContext} '${dirName}' does not exist, skipping.`);
      }
      continue;
    }
    copyRecursiveSync(dirSrc, dirDest);
    copied++;
  }
  return copied;
}

function installMergedSkillDirectories(baseSkillsDir, overlaySkillsDir, destDir, skillNames, missingContext = '') {
  if (!Array.isArray(skillNames) || skillNames.length === 0) {
    return 0;
  }

  const uniqueSkillNames = mergeUniqueOrdered(skillNames);
  let installed = 0;

  for (const skillName of uniqueSkillNames) {
    const baseSkillDir = path.join(baseSkillsDir, skillName);
    const overlaySkillDir = path.join(overlaySkillsDir, skillName);
    const hasBase = fs.existsSync(baseSkillDir);
    const hasOverlay = fs.existsSync(overlaySkillDir);

    if (!hasBase && !hasOverlay) {
      if (missingContext) {
        console.error(`Warning: ${missingContext} '${skillName}' does not exist, skipping.`);
      }
      continue;
    }

    const skillDest = path.join(destDir, skillName);
    if (hasBase) {
      copyRecursiveSync(baseSkillDir, skillDest);
    }
    if (hasOverlay) {
      copyRecursiveSync(overlaySkillDir, skillDest);
    }
    installed += 1;
  }

  return installed;
}

function copyExplicitFiles(srcDir, destDir, fileNames, missingContext = '') {
  if (!fs.existsSync(srcDir) || !Array.isArray(fileNames) || fileNames.length === 0) {
    return 0;
  }

  fs.mkdirSync(destDir, { recursive: true });
  let copied = 0;

  for (const fileName of fileNames) {
    const srcPath = path.join(srcDir, fileName);
    const destPath = path.join(destDir, fileName);

    if (!fs.existsSync(srcPath)) {
      console.error(`Warning: ${missingContext || 'File'} '${fileName}' does not exist, skipping.`);
      continue;
    }

    copyFileAtomicSync(srcPath, destPath);
    copied += 1;
  }

  return copied;
}

function resolveClaudePaths(overrideDir) {
  const claudeBase = resolveInstallRoot('claude', overrideDir);
  const rulesDest = process.env.CLAUDE_RULES_DIR || path.join(claudeBase, 'rules');
  return { claudeBase, rulesDest };
}

function warnExistingRulesDir(rulesDest) {
  if (!(fs.existsSync(rulesDest) && fs.readdirSync(rulesDest).length > 0)) return;
  console.log('Note: ' + rulesDest + '/ already exists. Existing files will be overwritten.');
  console.log('      Back up any local customizations before proceeding.');
}

function installClaudeRules(selectedPackages, rulesDest) {
  const selectedRules = getManifestRuleSelections(selectedPackages);
  if (selectedRules.length === 0) {
    console.log('No package-selected rules to install.');
    return;
  }

  const installedDirectories = new Set();
  for (const rulePath of selectedRules) {
    const normalizedRulePath = typeof rulePath === 'string' ? rulePath.replace(/\\/g, '/') : '';
    if (!normalizedRulePath || normalizedRulePath.startsWith('/') || normalizedRulePath.includes('..')) {
      console.error(`Warning: invalid rule path '${rulePath}', skipping.`);
      continue;
    }

    const srcPath = path.join(RULES_DIR, ...normalizedRulePath.split('/'));
    if (!fs.existsSync(srcPath)) {
      console.error(`Warning: package-selected rule '${normalizedRulePath}' does not exist, skipping.`);
      continue;
    }

    const destPath = path.join(rulesDest, ...normalizedRulePath.split('/'));
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    copyFileAtomicSync(srcPath, destPath);
    const ruleDir = normalizedRulePath.split('/')[0];
    if (ruleDir) {
      installedDirectories.add(ruleDir);
    }
  }

  for (const ruleDir of [...installedDirectories].sort()) {
    console.log('Installing package-selected rules -> ' + path.join(rulesDest, ruleDir) + '/');
  }
}

function installDevSharedSkills(destDir) {
  if (!fs.existsSync(SHARED_SKILLS_SRC)) {
    return 0;
  }

  const skillsDest = path.join(destDir, 'skills');
  return copySelectedDirectories(SHARED_SKILLS_SRC, skillsDest, ['tool-doc-maintainer'], 'Dev-only shared skill');
}

function installBaselineSharedSkills(destDir) {
  if (!fs.existsSync(SHARED_SKILLS_SRC)) {
    return 0;
  }

  const skillsDest = path.join(destDir, 'skills');
  return copySelectedDirectories(SHARED_SKILLS_SRC, skillsDest, BASELINE_SHARED_SKILL_NAMES, 'Baseline shared skill');
}

function installClaudeContentDirs(claudeBase, selectedPackages, devMode = false) {
  installClaudeAgents(claudeBase, selectedPackages);
  installClaudeCommands(claudeBase, selectedPackages, devMode);
  installClaudeSkills(claudeBase, selectedPackages, devMode);
}

function installClaudeAgents(claudeBase, selectedPackages) {
  const agentsSrc = path.join(REPO_ROOT, 'agents');
  const agentsDest = path.join(claudeBase, 'agents');
  if (fs.existsSync(agentsSrc) && path.resolve(agentsSrc) !== path.resolve(agentsDest)) {
    const agentFiles = getManifestSelections(selectedPackages, 'agents');
    if (copySelectedMarkdownFiles(agentsSrc, agentsDest, agentFiles, 'Package-selected agent') > 0) {
      console.log('Installing package-selected agents -> ' + agentsDest + '/');
    }
  }
}

function installClaudeCommands(claudeBase, selectedPackages, devMode) {
  const commandsDest = path.join(claudeBase, 'commands');
  if (fs.existsSync(SHARED_COMMANDS_SRC) && path.resolve(SHARED_COMMANDS_SRC) !== path.resolve(commandsDest)) {
    const commandFiles = mergeUniqueOrdered(
      getManifestSelections(selectedPackages, 'commands'),
      devMode ? ['smoke.md'] : []
    );
    if (copySelectedMarkdownFiles(SHARED_COMMANDS_SRC, commandsDest, commandFiles, 'Package-selected command') > 0) {
      console.log('Installing package-selected commands -> ' + commandsDest + '/');
    }
  }
}

function installClaudeSkills(claudeBase, selectedPackages, devMode) {
  const skillsDest = path.join(claudeBase, 'skills');
  if (!(fs.existsSync(SHARED_SKILLS_SRC) && path.resolve(SHARED_SKILLS_SRC) !== path.resolve(skillsDest))) {
    return;
  }
  if (installBaselineSharedSkills(claudeBase) > 0) {
    console.log('Installing baseline shared skills -> ' + skillsDest + '/');
  }
  const skillNames = getManifestSelections(selectedPackages, 'skills');
  if (copySelectedDirectories(SHARED_SKILLS_SRC, skillsDest, skillNames, 'Package-selected skill') > 0) {
    console.log('Installing package-selected skills -> ' + skillsDest + '/');
  }
  const claudeSkillNames = getToolManifestSelections(selectedPackages, 'claude', 'skills');
  if (copySelectedDirectories(SHARED_SKILLS_SRC, skillsDest, claudeSkillNames, 'Claude package-selected skill') > 0) {
    console.log('Installing Claude package skills -> ' + skillsDest + '/');
  }
  if (devMode && installDevSharedSkills(claudeBase) > 0) {
    console.log('Installing dev-only shared skills -> ' + skillsDest + '/');
  }
}

function readJsonFile(jsonPath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {
    return fallback;
  }
}

function installClaudeHooks(claudeBase) {
  const hooksJsonSrc = getHookPlatform('claude').sourceConfig;
  if (!fs.existsSync(hooksJsonSrc)) return;

  const settingsPath = path.join(claudeBase, 'settings.json');
  const hooksData = readJsonFile(hooksJsonSrc, {});
  const pluginRoot = resolveMdtRoot(claudeBase).replace(/\\/g, '/');
  const hooksJson = JSON.stringify(hooksData).replace(/\$\{MDT_ROOT\}/g, pluginRoot);
  const parsedHooks = JSON.parse(hooksJson);

  let settings = {};
  if (fs.existsSync(settingsPath)) {
    const backupPath = settingsPath + '.bkp';
    fs.copyFileSync(settingsPath, backupPath);
    console.log('Backed up existing settings.json -> ' + backupPath);
    settings = readJsonFile(settingsPath, {});
  }
  settings.hooks = parsedHooks.hooks;
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  console.log('Installing hooks -> ' + settingsPath + ' (merged into settings.json)');
}

function installClaudePermissions(claudeBase) {
  const settingsPath = path.join(claudeBase, 'settings.json');
  const mdtRoot = resolveMdtRoot(claudeBase).replace(/\\/g, '/');
  const entriesToAdd = [`Edit(${mdtRoot}/**)`, `Write(${mdtRoot}/**)`];

  let settings = fs.existsSync(settingsPath) ? readJsonFile(settingsPath, {}) : {};
  if (!settings.permissions) settings.permissions = {};
  if (!Array.isArray(settings.permissions.allow)) settings.permissions.allow = [];

  let added = 0;
  for (const entry of entriesToAdd) {
    if (!settings.permissions.allow.includes(entry)) {
      settings.permissions.allow.push(entry);
      added++;
    }
  }

  if (added > 0) {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log(`Granting Edit/Write permissions for ${mdtRoot}/ -> ${settingsPath}`);
  }
}

function installClaudeRuntimeScripts(claudeBase) {
  const scriptsDest = copyRuntimeScriptsToMdtRoot(claudeBase);
  console.log('Installing runtime scripts -> ' + scriptsDest + '/');
  if (copyExplicitFiles(path.join(REPO_ROOT, 'scripts'), scriptsDest, CLAUDE_WORKFLOW_SCRIPTS, 'Claude workflow script') > 0) {
    console.log('Installing Claude workflow scripts -> ' + scriptsDest + '/');
  }
}

function installDevSmokeScripts(installRoot, fileNames, logLabel) {
  const scriptsDest = path.join(ensureMdtRoot(installRoot), 'scripts');
  if (copyExplicitFiles(path.join(REPO_ROOT, 'scripts'), scriptsDest, fileNames, `${logLabel} smoke script`) > 0) {
    console.log(`Installing ${logLabel} smoke scripts -> ${scriptsDest}/`);
  }

  const workflowContractsDest = path.join(resolveMdtRoot(installRoot), 'workflow-contracts');
  if (fs.existsSync(WORKFLOW_CONTRACTS_DIR)) {
    copyRecursiveSync(WORKFLOW_CONTRACTS_DIR, workflowContractsDest);
    console.log(`Installing ${logLabel} workflow contracts -> ${workflowContractsDest}/`);
  }
}

function printWindowsHookNote(prefix) {
  if (process.platform !== 'win32') return;
  console.log('');
  console.log(prefix);
  console.log('');
}

function installClaude(packageNames, overrideDir, devMode = false) {
  const { claudeBase, rulesDest } = resolveClaudePaths(overrideDir);
  if (!packageNames.length) usage('claude');
  const selectedPackages = resolveSelectedPackages(packageNames);
  for (const warning of assertInstallRequirements('claude', selectedPackages, devMode)) {
    console.warn('Warning: ' + warning);
  }

  warnExistingRulesDir(rulesDest);
  installClaudeRules(selectedPackages, rulesDest);
  installClaudeContentDirs(claudeBase, selectedPackages, devMode);
  installClaudeHooks(claudeBase);
  installClaudePermissions(claudeBase);
  installClaudeRuntimeScripts(claudeBase);
  if (devMode) {
    installDevSmokeScripts(claudeBase, DEV_SMOKE_SCRIPT_FILES, 'Claude dev');
  }
  printWindowsHookNote('NOTE: Windows — Hook scripts use Node.js; tmux-dependent features are skipped on Windows.');
  console.log('Done. Claude configs installed to ' + claudeBase + '/');
}

function resolveCursorDestDir(overrideDir) {
  return resolveInstallRoot('cursor', overrideDir);
}

function renderCursorGlobalRuleContent(ruleFile, markdownContent) {
  if (ruleFile.endsWith('.mdc')) {
    return markdownContent;
  }

  const titleLine = markdownContent.split(/\r?\n/).find((line) => line.startsWith('# '));
  const description = (titleLine ? titleLine.replace(/^#\s+/, '').trim() : ruleFile.replace(/\.md$/, '')).replace(/"/g, '\\"');
  return [
    '---',
    `description: "${description}"`,
    'alwaysApply: true',
    '---',
    '',
    markdownContent.trim(),
    ''
  ].join('\n');
}

function installCursorRules(destDir, selectedPackages) {
  const cursorRulesSrc = path.join(CURSOR_SRC, 'rules');
  const rulesDest = path.join(destDir, 'rules');
  fs.mkdirSync(rulesDest, { recursive: true });
  if (!fs.existsSync(cursorRulesSrc)) {
    return;
  }

  const copiedRules = new Set();
  for (const selectedPackage of selectedPackages) {
    const cursorRules = Array.isArray(selectedPackage.tools.cursor?.rules)
      ? selectedPackage.tools.cursor.rules
      : [];

    if (cursorRules.length === 0) {
      continue;
    }

    for (const ruleFile of cursorRules) {
      const srcPath = path.join(cursorRulesSrc, ruleFile);
      const destFileName = ruleFile.endsWith('.md') ? ruleFile.replace(/\.md$/, '.mdc') : ruleFile;
      const destPath = path.join(rulesDest, destFileName);
      if (!fs.existsSync(srcPath)) {
        console.error(`Warning: Cursor rule '${ruleFile}' for package '${selectedPackage.name}' does not exist, skipping.`);
        continue;
      }
      const content = fs.readFileSync(srcPath, 'utf8');
      fs.writeFileSync(destPath, renderCursorGlobalRuleContent(ruleFile, content), 'utf8');
      copiedRules.add(destFileName);
    }
  }

  if (copiedRules.size > 0) {
    console.log('Installing Cursor package rules -> ' + rulesDest + '/');
  }
}

function installCursorSkills(destDir, selectedPackages) {
  const skillsDest = path.join(destDir, 'skills');
  const sharedSkillsSrc = SHARED_SKILLS_SRC;
  if (installBaselineSharedSkills(destDir) > 0) {
    console.log('Installing baseline shared skills -> ' + skillsDest + '/');
  }
  const sharedSkillNames = getManifestSelections(selectedPackages, 'skills');
  if (copySelectedDirectories(sharedSkillsSrc, skillsDest, sharedSkillNames, 'Package-selected skill') > 0) {
    console.log('Installing package-selected skills -> ' + skillsDest + '/');
  }

  const cursorSkillsSrc = path.join(CURSOR_SRC, 'skills');
  let copiedCursorSkills = 0;
  for (const selectedPackage of selectedPackages) {
    const cursorSkills = Array.isArray(selectedPackage.tools.cursor?.skills)
      ? selectedPackage.tools.cursor.skills
      : [];

    for (const skillName of cursorSkills) {
      const cursorSkillSrc = path.join(cursorSkillsSrc, skillName);
      const sharedSkillSrc = path.join(sharedSkillsSrc, skillName);
      const skillSrc = fs.existsSync(cursorSkillSrc) ? cursorSkillSrc : sharedSkillSrc;
      const skillDest = path.join(skillsDest, skillName);
      if (!fs.existsSync(skillSrc)) {
        console.error(`Warning: Cursor skill '${skillName}' for package '${selectedPackage.name}' does not exist, skipping.`);
        continue;
      }
      copyRecursiveSync(skillSrc, skillDest);
      copiedCursorSkills++;
    }
  }

  if (copiedCursorSkills > 0) {
    console.log('Installing Cursor package skills -> ' + skillsDest + '/');
  }
}

function installCursorCoreDirs(destDir, selectedPackages, devMode = false) {
  installCursorAgents(destDir, selectedPackages);
  installCursorSkills(destDir, selectedPackages);
  installCursorCommands(destDir, selectedPackages, devMode);
  if (devMode && installDevSharedSkills(destDir) > 0) {
    console.log('Installing dev-only shared skills -> ' + path.join(destDir, 'skills') + '/');
  }
}

function installCursorAgents(destDir, selectedPackages) {
  const agentsSrc = path.join(REPO_ROOT, 'agents');
  const agentsDest = path.join(destDir, 'agents');
  if (fs.existsSync(agentsSrc)) {
    const agentFiles = getManifestSelections(selectedPackages, 'agents');
    if (copySelectedMarkdownFiles(agentsSrc, agentsDest, agentFiles, 'Package-selected agent') > 0) {
      console.log('Installing package-selected agents -> ' + agentsDest + '/');
    }
  }
}

function installCursorSharedCommands(commandsDest, selectedPackages, devMode) {
  if (!fs.existsSync(SHARED_COMMANDS_SRC)) {
    return;
  }
  const sharedCommandFiles = mergeUniqueOrdered(
    getManifestSelections(selectedPackages, 'commands'),
    devMode ? ['smoke.md'] : []
  );
  if (copySelectedMarkdownFiles(SHARED_COMMANDS_SRC, commandsDest, sharedCommandFiles, 'Package-selected command') > 0) {
    console.log('Installing package-selected commands -> ' + commandsDest + '/');
  }
}

function installCursorToolCommands(commandsDest, selectedPackages) {
  const commandsSrc = path.join(CURSOR_SRC, 'commands');
  if (!fs.existsSync(commandsSrc)) {
    return;
  }
  if (copySelectedMarkdownFiles(commandsSrc, commandsDest, ['install-rules.md'], 'Cursor utility command') > 0) {
    console.log('Installing Cursor utility commands -> ' + commandsDest + '/');
  }

  let copiedCursorCommands = 0;
  for (const selectedPackage of selectedPackages) {
    const cursorCommands = Array.isArray(selectedPackage.tools.cursor?.commands)
      ? selectedPackage.tools.cursor.commands
      : [];
    for (const commandFile of cursorCommands) {
      const cursorCommandSrc = path.join(commandsSrc, commandFile);
      const sharedCommandSrc = path.join(SHARED_COMMANDS_SRC, commandFile);
      const commandSrc = fs.existsSync(cursorCommandSrc) ? cursorCommandSrc : sharedCommandSrc;
      const commandDest = path.join(commandsDest, commandFile);
      if (!fs.existsSync(commandSrc)) {
        console.error(`Warning: Cursor command '${commandFile}' for package '${selectedPackage.name}' does not exist, skipping.`);
        continue;
      }
      fs.mkdirSync(path.dirname(commandDest), { recursive: true });
      fs.copyFileSync(commandSrc, commandDest);
      copiedCursorCommands++;
    }
  }
  if (copiedCursorCommands > 0) {
    console.log('Installing Cursor package commands -> ' + commandsDest + '/');
  }
}

function installCursorCommands(destDir, selectedPackages, devMode) {
  const commandsDest = path.join(destDir, 'commands');
  installCursorSharedCommands(commandsDest, selectedPackages, devMode);
  installCursorToolCommands(commandsDest, selectedPackages);
}

function installCursorHooksConfig(destDir) {
  const hooksJsonSrc = getHookPlatform('cursor').sourceConfig;
  if (!fs.existsSync(hooksJsonSrc)) return;

  const hooksDestPath = path.join(destDir, 'hooks.json');
  let content = fs.readFileSync(hooksJsonSrc, 'utf8');
  const absoluteHooksDir = path.join(resolveMdtRoot(destDir), 'hooks').replace(/\\/g, '/');
  content = content.replace(/node \.cursor\/hooks\//g, 'node ' + absoluteHooksDir + '/');
  const hooksParsed = JSON.parse(content);
  if (hooksParsed.version === null || hooksParsed.version === undefined) {
    hooksParsed.version = 1;
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(hooksDestPath, JSON.stringify(hooksParsed, null, 2), 'utf8');
  console.log('Installing hooks config -> ' + hooksDestPath);
}

function installCursorHookScripts(destDir) {
  const hooksSrc = getHookPlatform('cursor').sourceScriptsDir;
  if (!fs.existsSync(hooksSrc)) return;

  const hooksDest = path.join(ensureMdtRoot(destDir), 'hooks');
  console.log('Installing hook scripts -> ' + hooksDest + '/');
  copyRecursiveSync(hooksSrc, hooksDest);
}

function installCursorRuntimeScripts(destDir) {
  const scriptsDest = copyRuntimeScriptsToMdtRoot(destDir);
  console.log('Installing runtime scripts -> ' + scriptsDest + '/');
  if (copyExplicitFiles(path.join(REPO_ROOT, 'scripts'), scriptsDest, CURSOR_WORKFLOW_SCRIPT_FILES, 'Cursor workflow script') > 0) {
    console.log('Installing Cursor workflow scripts -> ' + scriptsDest + '/');
  }
}

function installCursorMcp(destDir) {
  const mcpSrc = path.join(CURSOR_SRC, 'mcp.json');
  if (!fs.existsSync(mcpSrc)) return;

  const mcpDest = path.join(destDir, 'mcp.json');
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(mcpSrc, mcpDest);
  console.log('Installing MCP config -> ' + mcpDest);
}

function installCursor(packageNames, overrideDir, devMode = false) {
  const destDir = resolveCursorDestDir(overrideDir);
  if (!packageNames.length) usage('cursor');
  const selectedPackages = resolveSelectedPackages(packageNames);
  for (const warning of assertInstallRequirements('cursor', selectedPackages, devMode)) {
    console.warn('Warning: ' + warning);
  }

  console.log('Installing Cursor configs to ' + destDir + '/');
  installCursorRules(destDir, selectedPackages);
  installCursorCoreDirs(destDir, selectedPackages, devMode);
  const skipHooks = String(process.env.MDT_SKIP_CURSOR_HOOKS || '').trim() === '1';
  if (skipHooks) {
    console.log('Skipping Cursor hooks install because MDT_SKIP_CURSOR_HOOKS=1');
  } else {
    installCursorHooksConfig(destDir);
    installCursorHookScripts(destDir);
  }
  installCursorRuntimeScripts(destDir);
  if (devMode) {
    installDevSmokeScripts(destDir, DEV_SMOKE_SCRIPT_FILES, 'Cursor dev');
  }
  installCursorMcp(destDir);
  printWindowsHookNote('NOTE: Windows — Cursor hooks use Node.js; tmux features are skipped on Windows.');
  console.log('Done. Cursor configs installed to ' + destDir + '/');
}

function installCodexRules(selectedPackages, destDir) {
  const selectedRules = getToolManifestSelections(selectedPackages, 'codex', 'rules');
  if (selectedRules.length === 0) {
    return;
  }

  const rulesDest = path.join(destDir, 'rules');
  if (copySelectedMarkdownFiles(CODEX_RULES_SRC, rulesDest, selectedRules, 'Codex package-selected rule') > 0) {
    console.log('Installing Codex package rules -> ' + rulesDest + '/');
  }
}

function installCodexSkills(selectedPackages, destDir, devMode = false) {
  const skillsDest = path.join(destDir, 'skills');
  if (installBaselineSharedSkills(destDir) > 0) {
    console.log('Installing baseline shared skills -> ' + skillsDest + '/');
  }
  const codexSkillNames = getToolManifestSelections(selectedPackages, 'codex', 'skills');
  if (installMergedSkillDirectories(SHARED_SKILLS_SRC, CODEX_SKILLS_SRC, skillsDest, codexSkillNames, 'Codex tool skill') > 0) {
    console.log('Installing Codex tool skills -> ' + skillsDest + '/');
  }

  if (devMode) {
    if (installMergedSkillDirectories(SHARED_SKILLS_SRC, CODEX_SKILLS_SRC, skillsDest, CODEX_DEV_SKILL_NAMES, 'Codex dev skill') > 0) {
      console.log('Installing Codex dev skills -> ' + skillsDest + '/');
    }
    if (installDevSharedSkills(destDir) > 0) {
      console.log('Installing dev-only shared skills -> ' + skillsDest + '/');
    }
  }
}

function installCodexRuntimeScripts(codexDir) {
  const scriptsDest = copyRuntimeScriptsToMdtRoot(codexDir);
  console.log('Installing Codex runtime scripts -> ' + scriptsDest + '/');
}

function installCodexWorkflowScripts(codexDir, selectedPackages, devMode = false) {
  const scriptsDest = path.join(ensureMdtRoot(codexDir), 'scripts');
  const baselineWorkflowScripts = devMode ? ['smoke-tool-setups.js', 'smoke-codex-workflows.js'] : [];
  const optionalWorkflowScripts = getToolManifestSelections(selectedPackages, 'codex', 'scripts');
  const workflowScripts = mergeUniqueOrdered(baselineWorkflowScripts, optionalWorkflowScripts);
  if (copyExplicitFiles(path.join(REPO_ROOT, 'scripts'), scriptsDest, workflowScripts, 'Codex workflow script') > 0) {
    console.log('Installing Codex workflow scripts -> ' + scriptsDest + '/');
  }
  if (devMode && fs.existsSync(WORKFLOW_CONTRACTS_DIR)) {
    const workflowContractsDest = path.join(resolveMdtRoot(codexDir), 'workflow-contracts');
    copyRecursiveSync(WORKFLOW_CONTRACTS_DIR, workflowContractsDest);
    console.log('Installing Codex workflow contracts -> ' + workflowContractsDest + '/');
  }
}

function installCodexGlobal(selectedPackages, overrideDir, devMode = false) {
  const destDir = resolveInstallRoot('codex', overrideDir);
  console.log('Installing Codex CLI configs to ' + destDir + '/');
  fs.mkdirSync(destDir, { recursive: true });

  const configSrc = path.join(CODEX_SRC, 'config.toml');
  if (fs.existsSync(configSrc)) {
    const configDest = path.join(destDir, 'config.toml');
    if (fs.existsSync(configDest)) {
      const referenceDest = path.join(destDir, 'config.mdt.toml');
      fs.copyFileSync(configSrc, referenceDest);
      console.log('Preserving existing Codex config -> ' + configDest);
      console.log('Installing MDT Codex config reference -> ' + referenceDest);
    } else {
      fs.copyFileSync(configSrc, configDest);
      console.log('Installing Codex config -> ' + configDest);
    }
  }

  const agentsMdSrc = path.join(CODEX_SRC, 'AGENTS.md');
  if (fs.existsSync(agentsMdSrc)) {
    fs.copyFileSync(agentsMdSrc, path.join(destDir, 'AGENTS.md'));
    console.log('Installing Codex AGENTS.md -> ' + path.join(destDir, 'AGENTS.md'));
  }

  installCodexRules(selectedPackages, destDir);
  installCodexSkills(selectedPackages, destDir, devMode);
  installCodexRuntimeScripts(destDir);
  installCodexWorkflowScripts(destDir, selectedPackages, devMode);

  if (process.platform === 'win32') {
    console.log('');
    console.log('NOTE: Existing ~/.codex/config.toml is preserved when present.');
    console.log('      MDT writes config.mdt.toml as a reference file instead of overwriting user Codex settings.');
    console.log('');
  }
  console.log('Done. Codex global configs installed to ' + destDir + '/');
}

function installCodex(packageNames, overrideDir, devMode) {
  if (!fs.existsSync(CODEX_SRC)) {
    console.error('Error: codex-template source directory not found at ' + CODEX_SRC);
    process.exit(1);
  }
  if (!packageNames.length) usage('codex');

  const selectedPackages = resolveSelectedPackages(packageNames);
  for (const warning of assertInstallRequirements('codex', selectedPackages, devMode)) {
    console.warn('Warning: ' + warning);
  }

  installCodexGlobal(selectedPackages, overrideDir, devMode);
}

function convertCommandsToToml(commandsSrc, commandsDest) {
  if (!fs.existsSync(commandsSrc)) return;
  fs.mkdirSync(commandsDest, { recursive: true });
  fs.readdirSync(commandsSrc).forEach(f => {
    if (f.endsWith('.md')) {
      const p = path.join(commandsSrc, f);
      const content = fs.readFileSync(p, 'utf8');

      let description = '';
      let promptContent = content;

      if (content.startsWith('---')) {
        const parts = content.split('---');
        if (parts.length >= 3) {
          const fm = parts[1];
          const descMatch = fm.match(/description:\s*(.*)/);
          if (descMatch) description = descMatch[1].trim();
          promptContent = parts.slice(2).join('---').trim();
        }
      }

      const tomlPath = path.join(commandsDest, f.replace('.md', '.toml'));
      let tomlStr = '';
      if (description) {
        const cleanDesc = description.replace(/"/g, '\\"');
        tomlStr += `description = "${cleanDesc}"\n`;
      }
      const cleanPrompt = promptContent.replace(/"""/g, '""\\"');
      tomlStr += `prompt = """\n${cleanPrompt}\n"""\n`;
      fs.writeFileSync(tomlPath, tomlStr, 'utf8');
    }
  });
}

function resolveGeminiDestinations(overrideDir) {
  const geminiRoot = resolveInstallRoot('gemini', overrideDir);
  return {
    destDirAgent: path.join(geminiRoot, 'antigravity', '.agents'),
    destDirGemini: geminiRoot
  };
}

function getGeminiRuleSelections(selectedPackages) {
  return getToolManifestSelections(selectedPackages, 'gemini', 'rules');
}

function collectGeminiRuleContent(cursorRules, selectedPackages) {
  let combined = '';
  for (const ruleFile of getGeminiRuleSelections(selectedPackages)) {
    const srcPath = path.join(cursorRules, ruleFile);
    if (!fs.existsSync(srcPath)) {
      console.error(`Warning: Gemini rule '${ruleFile}' does not exist, skipping.`);
      continue;
    }
    combined += '\n\n' + fs.readFileSync(srcPath, 'utf8');
  }

  return combined;
}

function appendGeminiGlobalRules(cursorRules, selectedPackages, destDirGemini) {
  const geminiMdPath = path.join(destDirGemini, 'GEMINI.md');
  fs.mkdirSync(destDirGemini, { recursive: true });
  const rulesCombined = collectGeminiRuleContent(cursorRules, selectedPackages);
  if (!rulesCombined.trim()) return;

  const existing = fs.existsSync(geminiMdPath) ? fs.readFileSync(geminiMdPath, 'utf8') : '';
  fs.writeFileSync(geminiMdPath, existing + '\n' + rulesCombined.trim() + '\n', 'utf8');
  console.log('Appended rules for ' + selectedPackages.map((pkg) => pkg.name).join(', ') + ' to ' + geminiMdPath);
}

function installGeminiRules(selectedPackages, destDirAgent, destDirGemini) {
  const cursorRules = path.join(CURSOR_SRC, 'rules');
  if (selectedPackages.length === 0) {
    console.log('No packages provided, skipping rules...');
    return;
  }
  if (!fs.existsSync(cursorRules)) return;
  appendGeminiGlobalRules(cursorRules, selectedPackages, destDirGemini);
}

function installGeminiContent(destDirAgent, destDirGemini, selectedPackages, devMode = false) {
  const skillsSrc = path.join(REPO_ROOT, 'skills');
  if (fs.existsSync(skillsSrc)) {
    const skillsDest = path.join(destDirAgent, 'skills');
    if (installBaselineSharedSkills(destDirAgent) > 0) {
      console.log('Installing baseline shared skills -> ' + skillsDest + '/');
    }
    const skillNames = getManifestSelections(selectedPackages, 'skills');
    if (copySelectedDirectories(skillsSrc, skillsDest, skillNames, 'Package-selected skill') > 0) {
      console.log('Installing package-selected skills -> ' + skillsDest + '/');
    }
  }

  if (devMode && installDevSharedSkills(destDirAgent) > 0) {
    console.log('Installing dev-only shared skills -> ' + path.join(destDirAgent, 'skills') + '/');
  }

  const agentsSrc = path.join(REPO_ROOT, 'agents');
  if (fs.existsSync(agentsSrc)) {
    const workflowsDest = path.join(destDirAgent, 'workflows');
    const agentFiles = getManifestSelections(selectedPackages, 'agents');
    if (copySelectedMarkdownFiles(agentsSrc, workflowsDest, agentFiles, 'Package-selected agent') > 0) {
      console.log('Installing package-selected agents as workflows -> ' + workflowsDest + '/');
    }
  }

  const commandsSrc = path.join(REPO_ROOT, 'commands');
  if (fs.existsSync(commandsSrc)) {
    const selectedCommands = getManifestSelections(selectedPackages, 'commands');
    if (selectedCommands.length > 0) {
      const tempCommandsSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'mdt-gemini-commands-'));
      try {
        copySelectedMarkdownFiles(commandsSrc, tempCommandsSrc, selectedCommands, 'Package-selected command');
        const commandsDest = path.join(destDirGemini, 'commands');
        console.log('Installing package-selected commands -> ' + commandsDest + '/');
        convertCommandsToToml(tempCommandsSrc, commandsDest);
      } finally {
        fs.rmSync(tempCommandsSrc, { recursive: true, force: true });
      }
    }
  }

  copyRuntimeScriptsToMdtRoot(destDirGemini);
}

function installGemini(packageNames, overrideDir, devMode = false) {
  console.log('Installing Gemini CLI / Antigravity configs...');
  const { destDirAgent, destDirGemini } = resolveGeminiDestinations(overrideDir);
  const selectedPackages = resolveSelectedPackages(packageNames);
  for (const warning of assertPackageRequirements('gemini', selectedPackages)) {
    console.warn('Warning: ' + warning);
  }
  for (const warning of getSkillRequirementWarnings('gemini', selectedPackages, devMode)) {
    console.warn('Note: ' + warning);
  }
  installGeminiRules(selectedPackages, destDirAgent, destDirGemini);
  installGeminiContent(destDirAgent, destDirGemini, selectedPackages, devMode);
  console.log('Done. Gemini configs installed.');
}

function isSupportedTarget(target) {
  return target === 'claude' || target === 'cursor' || target === 'codex' || target === 'gemini';
}

function handleRetiredProjectDir(projectDir) {
  if (projectDir !== null) {
    console.error('Error: --project-dir is retired. MDT installs are global-only now.');
    console.error('Use node scripts/materialize-mdt-local.js for repo-local exception bridges when a tool needs them.');
    console.error('For Cursor specifically: use install-mdt.js --target cursor for the global cursor-agent surface, and materialize-mdt-local.js --target cursor --surface rules for Cursor IDE repo-local rules.');
    process.exit(1);
  }
}

function assertSupportedTarget(target) {
  if (!isSupportedTarget(target)) {
    console.error("Error: unknown target '" + target + "'. Must be claude, cursor, codex, or gemini.");
    process.exit(1);
  }
}

function handleListMode(target, listMode) {
  if (listMode) {
    printAvailableOptions(target);
    process.exit(0);
  }
}

function handleDryRun(target, dryRun, devMode, overrideDir, packageNames) {
  if (dryRun) {
    try {
      const plan = buildInstallPlan({ target, devMode, overrideDir, packageNames });
      plan.forEach((line) => console.log(line));
      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      usage(target);
    }
  }
}

function runInstallForTarget(target, packageNames, overrideDir, devMode) {
  if (target === 'claude') installClaude(packageNames, overrideDir, devMode);
  else if (target === 'cursor') installCursor(packageNames, overrideDir, devMode);
  else if (target === 'gemini') installGemini(packageNames, overrideDir, devMode);
  else installCodex(packageNames, overrideDir, devMode);
}

function main() {
  const { target, globalScope, listMode, dryRun, devMode, projectDir, overrideDir, packageNames } = parseArgs();
  handleRetiredProjectDir(projectDir);
  assertSupportedTarget(target);
  handleListMode(target, listMode);
  handleDryRun(target, dryRun, devMode, overrideDir, packageNames);
  try {
    if (globalScope) {
      console.log('Note: --global is now optional; MDT installs globally by default.');
    }
    runInstallForTarget(target, packageNames, overrideDir, devMode);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    usage(target);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getAvailablePackages,
  loadPackageManifest,
  parseArgsFrom,
  resolveSelectedPackages,
  buildInstallPlan,
  assertPackageRequirements,
  assertSkillRequirements,
  assertInstallRequirements,
  getSkillRequirementWarnings,
  installClaudePermissions,
  installClaudeContentDirs,
  installCursorCoreDirs,
  installGeminiContent,
  installCodexSkills
};

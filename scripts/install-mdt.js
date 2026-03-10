#!/usr/bin/env node
/**
 * ModelDev Toolkit installer.
 * Node-only installer for rules, agents, skills, commands, hooks, and configs.
 *
 * Usage:
 *   node scripts/install-mdt.js [--target claude|cursor|codex] [--global] [--project-dir <path>] [--dev] [package ...]
 *
 * Examples:
 *   node scripts/install-mdt.js typescript
 *   node scripts/install-mdt.js --target cursor typescript
 *   node scripts/install-mdt.js --target cursor --project-dir C:\src\my-app typescript
 *   node scripts/install-mdt.js --target cursor --global typescript
 *   node scripts/install-mdt.js --target codex typescript continuous-learning
 *
 * Targets:
 *   claude (default) — Install to ./.claude/ or ~/.claude/ with --global
 *   cursor           — Install to ./.cursor/ or ~/.cursor/ with --global
 *   codex            — Install to ./.agents/ (or ~/.codex/ with --global)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getHookPlatform } = require('./lib/hook-platforms');

const REPO_ROOT = path.join(__dirname, '..');
const RULES_DIR = path.join(REPO_ROOT, 'rules');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');
const CURSOR_SRC = path.join(REPO_ROOT, 'cursor-template');
const CODEX_SRC = path.join(REPO_ROOT, 'codex-template');
const CODEX_SKILLS_SRC = path.join(CODEX_SRC, 'skills');
const CODEX_RULES_SRC = path.join(CODEX_SRC, 'rules');
const RUNTIME_CI_FILES = [
  'markdown-utils.js',
  'validate-markdown-links.js',
  'validate-markdown-path-refs.js'
];
const CLAUDE_WORKFLOW_SCRIPTS = ['smoke-claude-workflows.js'];
const SUPPORTED_PACKAGE_TARGETS = new Set(['claude', 'cursor', 'gemini', 'codex']);
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

function parseArgsFrom(args) {
  let target = 'claude';
  let globalScope = false;
  let listMode = false;
  let dryRun = false;
  let devMode = false;
  let projectDir = null;
  const packageNames = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) {
      target = args[++i];
      if (target === 'antigravity') target = 'gemini';
    } else if (args[i] === '--project-dir' && args[i + 1]) {
      projectDir = path.resolve(args[++i]);
    } else if (args[i] === '--global') {
      globalScope = true;
    } else if (args[i] === '--list') {
      listMode = true;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--dev') {
      devMode = true;
    } else if (!args[i].startsWith('-')) {
      packageNames.push(args[i]);
    }
  }

  return { target, globalScope, listMode, dryRun, devMode, projectDir, packageNames };
}

function assertProjectDir(projectDir) {
  if (!projectDir) {
    throw new Error('Missing project directory');
  }

  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project directory does not exist: ${projectDir}`);
  }

  if (!fs.statSync(projectDir).isDirectory()) {
    throw new Error(`Project directory is not a folder: ${projectDir}`);
  }

  return projectDir;
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
    extends: Array.isArray(parsed.extends) ? parsed.extends : [],
    kind: typeof parsed.kind === 'string' ? parsed.kind : 'language',
    rules: Array.isArray(parsed.rules) ? parsed.rules : [],
    agents: Array.isArray(parsed.agents) ? parsed.agents : [],
    commands: Array.isArray(parsed.commands) ? parsed.commands : [],
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    requires: normalizePackageRequires(parsed.requires),
    tools: typeof parsed.tools === 'object' && parsed.tools ? parsed.tools : {}
  };
}

function mergeToolConfigs(parentTools, childTools) {
  const mergedTools = {};
  const toolNames = mergeUniqueOrdered(
    Object.keys(parentTools || {}),
    Object.keys(childTools || {})
  );

  for (const toolName of toolNames) {
    const parentConfig = parentTools?.[toolName];
    const childConfig = childTools?.[toolName];

    if (!parentConfig && childConfig) {
      mergedTools[toolName] = childConfig;
      continue;
    }

    if (parentConfig && !childConfig) {
      mergedTools[toolName] = parentConfig;
      continue;
    }

    if (parentConfig && childConfig && typeof parentConfig === 'object' && typeof childConfig === 'object') {
      const mergedConfig = {};
      const configKeys = mergeUniqueOrdered(Object.keys(parentConfig), Object.keys(childConfig));
      for (const key of configKeys) {
        const parentValue = parentConfig[key];
        const childValue = childConfig[key];

        if (Array.isArray(parentValue) || Array.isArray(childValue)) {
          mergedConfig[key] = mergeUniqueOrdered(parentValue, childValue);
        } else if (childValue !== undefined) {
          mergedConfig[key] = childValue;
        } else {
          mergedConfig[key] = parentValue;
        }
      }
      mergedTools[toolName] = mergedConfig;
      continue;
    }

    mergedTools[toolName] = childConfig !== undefined ? childConfig : parentConfig;
  }

  return mergedTools;
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
  if (parentTools && childTools) {
    merged.tools = parentTools.filter((toolName) => childTools.includes(toolName));
  } else if (parentTools) {
    merged.tools = [...parentTools];
  } else if (childTools) {
    merged.tools = [...childTools];
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

function getPackageRuleDirectories(selectedPackages) {
  return selectedPackages
    .map((pkg) => pkg.ruleDirectory)
    .filter(Boolean)
    .sort();
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

function assertPackageRequirements(target, selectedPackages) {
  const capabilities = TARGET_CAPABILITIES[target];
  if (!capabilities) {
    throw new Error(`Unknown target '${target}'`);
  }

  for (const selectedPackage of selectedPackages) {
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

  return getPackageRequirementWarnings(target, selectedPackages);
}

function printAvailableOptions(target) {
  console.log('Available targets: claude (supports --global), cursor (supports --global), codex, gemini (supports --global)');
  const packages = getAvailablePackages();
  console.log('Available packages:');
  if (packages.length === 0) {
    console.log('  (none found under packages/)');
  } else {
    packages.forEach((packageName) => console.log('  - ' + packageName));
  }
}

function getDryRunHeader(target, globalScope) {
  const targetDisplay = target + (globalScope ? ' (global)' : '');
  return [`[dry-run] Target: ${targetDisplay}`];
}

function buildCodexInstallPlan(lines, globalScope, selectedPackages, projectDir, devMode) {
  const packages = getSelectedPackageSummary(selectedPackages);
  if (globalScope) {
    const userCodexDir = path.join(os.homedir(), '.codex');
    return [
      ...lines,
      `[dry-run] Packages: ${packages}`,
      `[dry-run] Would install Codex user config to ${userCodexDir}`,
      `[dry-run] Would install Codex user rules to ${path.join(userCodexDir, 'rules')}`
    ];
  }

  const projectAgentsDir = path.join(projectDir, '.agents');
  const codexScripts = getToolManifestSelections(selectedPackages, 'codex', 'scripts');
  return [
    ...lines,
    `[dry-run] Packages: ${packages}`,
    `[dry-run] Project directory: ${projectDir}`,
    `[dry-run] Would install Codex project skills to ${path.join(projectAgentsDir, 'skills')}`,
    `[dry-run] Would install Codex runtime scripts to ${path.join(projectAgentsDir, 'scripts')}`,
    '[dry-run] Would materialize package-selected Codex skills from codex-template/skills into .agents/skills/',
    ...(devMode ? [`[dry-run] Would install Codex dev smoke workflow scripts to ${path.join(projectAgentsDir, 'scripts')}`] : []),
    ...(codexScripts.length > 0
      ? [`[dry-run] Would install package-selected Codex workflow scripts to ${path.join(projectAgentsDir, 'scripts')}`]
      : [])
  ];
}

function buildGeminiInstallPlan(lines, globalScope, selectedPackages, projectDir) {
  const agentsDest = globalScope ? path.join(os.homedir(), '.gemini/antigravity/.agents') : path.join(projectDir, '.agent');
  const cmdsDest = globalScope ? path.join(os.homedir(), '.gemini/commands') : path.join(projectDir, '.gemini/commands');
  const nextLines = [
    ...lines,
    `[dry-run] Packages: ${getSelectedPackageSummary(selectedPackages)}`,
    `[dry-run] Project directory: ${projectDir}`,
    `[dry-run] Would install agents and skills to ${agentsDest}`,
    `[dry-run] Would install custom commands to ${cmdsDest}`
  ];

  if (selectedPackages.length === 0) {
    return nextLines;
  }

  const packageNames = selectedPackages.map((pkg) => pkg.name);
  if (globalScope) {
    return [
      ...nextLines,
      `[dry-run] Would append rules for packages [${packageNames.join(', ')}] to ${path.join(os.homedir(), '.gemini/GEMINI.md')}`
    ];
  }

  return [
    ...nextLines,
    `[dry-run] Would install rules for packages [${packageNames.join(', ')}] to ${path.join(agentsDest, 'rules')}`
  ];
}

function buildClaudeInstallPlan(lines, globalScope, selectedPackages, projectDir) {
  const packages = getSelectedPackageSummary(selectedPackages);
  const claudeBase = globalScope
    ? (process.env.CLAUDE_BASE_DIR || path.join(os.homedir(), '.claude'))
    : path.join(projectDir, '.claude');

  const nextLines = [
    ...lines,
    `[dry-run] Packages: ${packages}`,
    `[dry-run] Project directory: ${projectDir}`,
    `[dry-run] Would install into ${claudeBase}`,
    '[dry-run] Would copy rules, package-selected agents/commands/skills, hooks, and runtime scripts (scripts/hooks + scripts/lib)'
  ];

  if (globalScope) {
    return nextLines;
  }
  return [...nextLines, '[dry-run] Hook script paths will use project-relative references'];
}

function buildCursorInstallPlan(lines, globalScope, selectedPackages, projectDir) {
  const packages = getSelectedPackageSummary(selectedPackages);
  const cursorBase = globalScope ? path.join(os.homedir(), '.cursor') : path.join(projectDir, '.cursor');
  const nextLines = [
    ...lines,
    `[dry-run] Packages: ${packages}`,
    `[dry-run] Project directory: ${projectDir}`,
    `[dry-run] Would install into ${cursorBase}`,
    '[dry-run] Would copy package-selected agents, package-selected skills, hook scripts, hooks config, mcp config, and runtime scripts (scripts/hooks + scripts/lib)'
  ];

  if (globalScope) {
    return [...nextLines, '[dry-run] Would skip file-based rules (Cursor global mode limitation)'];
  }
  return [...nextLines, '[dry-run] Would install Cursor rules and skills declared by the selected packages'];
}

function buildInstallPlan({ target, globalScope, devMode, projectDir, packageNames }) {
  const header = getDryRunHeader(target, globalScope);
  const resolvedProjectDir = assertProjectDir(projectDir || process.cwd());
  const selectedPackages = target === 'codex' && packageNames.length === 0
    ? []
    : resolveSelectedPackages(packageNames);
  const warnings = selectedPackages.length === 0
    ? []
    : assertPackageRequirements(target, selectedPackages).map((warning) => `[dry-run] Warning: ${warning}`);

  if (target === 'codex') return [...warnings, ...buildCodexInstallPlan(header, globalScope, selectedPackages, resolvedProjectDir, devMode)];
  if (target === 'gemini') return [...warnings, ...buildGeminiInstallPlan(header, globalScope, selectedPackages, resolvedProjectDir)];
  if (target === 'claude') return [...warnings, ...buildClaudeInstallPlan(header, globalScope, selectedPackages, resolvedProjectDir)];

  return [...warnings, ...buildCursorInstallPlan(header, globalScope, selectedPackages, resolvedProjectDir)];
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
      fs.copyFileSync(srcPath, destPath);
    }
  }
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
}

function usage(target) {
  console.error('Usage: node scripts/install-mdt.js [--target claude|cursor|codex|gemini] [--global] [--project-dir <path>] [--list] [--dry-run] [package ...]');
  console.error('');
  console.error('Targets:');
  console.error('  claude (default) — Install to ./.claude/ (or ~/.claude/ with --global)');
  console.error('  cursor           — Install to ./.cursor/ (or ~/.cursor/ with --global)');
  console.error('  codex            — Install to ./.agents/ (or ~/.codex/ with --global)');
  console.error('  gemini           — Install Antigravity/Gemini CLI configs to .agent/ and .gemini/ (or ~/.gemini... with --global)');
  console.error('');
  console.error('Options:');
  console.error('  --global         — Install to home directory instead of current project.');
  console.error('  --project-dir    — Install project-level files into the specified repo path.');
  console.error('  --list           — Show available targets/packages and exit.');
  console.error('  --dry-run        — Print planned install actions without writing files.');
  console.error('');
  console.error('Available packages:');
  getAvailablePackages().forEach((packageName) => console.error('  - ' + packageName));
  process.exit(1);
}

function isValidLanguageName(language) {
  return /^[a-zA-Z0-9_-]+$/.test(language);
}

function copyMarkdownFiles(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  fs.readdirSync(srcDir).forEach(fileName => {
    if (fileName.endsWith('.md')) {
      fs.copyFileSync(path.join(srcDir, fileName), path.join(destDir, fileName));
    }
  });
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
    fs.copyFileSync(srcPath, destPath);
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

    fs.copyFileSync(srcPath, destPath);
    copied += 1;
  }

  return copied;
}

function resolveClaudePaths(globalScope, projectDir) {
  const claudeBase = globalScope
    ? (process.env.CLAUDE_BASE_DIR || path.join(os.homedir(), '.claude'))
    : path.join(projectDir, '.claude');
  const rulesDest = globalScope
    ? (process.env.CLAUDE_RULES_DIR || path.join(claudeBase, 'rules'))
    : path.join(claudeBase, 'rules');
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
    fs.copyFileSync(srcPath, destPath);
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
  const skillsSrc = path.join(REPO_ROOT, 'skills');
  if (!fs.existsSync(skillsSrc)) {
    return 0;
  }

  const skillsDest = path.join(destDir, 'skills');
  return copySelectedDirectories(skillsSrc, skillsDest, ['tool-doc-maintainer'], 'Dev-only shared skill');
}

function installClaudeContentDirs(claudeBase, selectedPackages, devMode = false) {
  const agentsSrc = path.join(REPO_ROOT, 'agents');
  const agentsDest = path.join(claudeBase, 'agents');
  if (fs.existsSync(agentsSrc) && path.resolve(agentsSrc) !== path.resolve(agentsDest)) {
    const agentFiles = getManifestSelections(selectedPackages, 'agents');
    if (copySelectedMarkdownFiles(agentsSrc, agentsDest, agentFiles, 'Package-selected agent') > 0) {
      console.log('Installing package-selected agents -> ' + agentsDest + '/');
    }
  }

  const commandsSrc = path.join(REPO_ROOT, 'commands');
  const commandsDest = path.join(claudeBase, 'commands');
  if (fs.existsSync(commandsSrc) && path.resolve(commandsSrc) !== path.resolve(commandsDest)) {
    const commandFiles = getManifestSelections(selectedPackages, 'commands');
    if (copySelectedMarkdownFiles(commandsSrc, commandsDest, commandFiles, 'Package-selected command') > 0) {
      console.log('Installing package-selected commands -> ' + commandsDest + '/');
    }
  }

  const skillsSrc = path.join(REPO_ROOT, 'skills');
  const skillsDest = path.join(claudeBase, 'skills');
  if (fs.existsSync(skillsSrc) && path.resolve(skillsSrc) !== path.resolve(skillsDest)) {
    const skillNames = getManifestSelections(selectedPackages, 'skills');
    if (copySelectedDirectories(skillsSrc, skillsDest, skillNames, 'Package-selected skill') > 0) {
      console.log('Installing package-selected skills -> ' + skillsDest + '/');
    }

    const claudeSkillNames = getToolManifestSelections(selectedPackages, 'claude', 'skills');
    if (copySelectedDirectories(skillsSrc, skillsDest, claudeSkillNames, 'Claude package-selected skill') > 0) {
      console.log('Installing Claude package skills -> ' + skillsDest + '/');
    }

    if (devMode && installDevSharedSkills(claudeBase) > 0) {
      console.log('Installing dev-only shared skills -> ' + skillsDest + '/');
    }
  }
}

function readJsonFile(jsonPath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {
    return fallback;
  }
}

function installClaudeHooks(claudeBase, globalScope) {
  const hooksJsonSrc = getHookPlatform('claude').sourceConfig;
  if (!fs.existsSync(hooksJsonSrc)) return;

  const settingsPath = path.join(claudeBase, 'settings.json');
  const hooksData = readJsonFile(hooksJsonSrc, {});
  const pluginRoot = globalScope ? claudeBase.replace(/\\/g, '/') : '.claude';
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

function installClaudeRuntimeScripts(claudeBase) {
  const scriptsDest = path.join(claudeBase, 'scripts');
  console.log('Installing runtime scripts -> ' + scriptsDest + '/');
  copyRuntimeScripts(scriptsDest);
  if (copyExplicitFiles(path.join(REPO_ROOT, 'scripts'), scriptsDest, CLAUDE_WORKFLOW_SCRIPTS, 'Claude workflow script') > 0) {
    console.log('Installing Claude workflow scripts -> ' + scriptsDest + '/');
  }
}

function printWindowsHookNote(prefix) {
  if (process.platform !== 'win32') return;
  console.log('');
  console.log(prefix);
  console.log('');
}

function installClaude(packageNames, globalScope, projectDir, devMode = false) {
  const { claudeBase, rulesDest } = resolveClaudePaths(globalScope, projectDir);
  if (!packageNames.length) usage('claude');
  const selectedPackages = resolveSelectedPackages(packageNames);
  for (const warning of assertPackageRequirements('claude', selectedPackages)) {
    console.warn('Warning: ' + warning);
  }

  warnExistingRulesDir(rulesDest);
  installClaudeRules(selectedPackages, rulesDest);
  installClaudeContentDirs(claudeBase, selectedPackages, devMode);
  installClaudeHooks(claudeBase, globalScope);
  installClaudeRuntimeScripts(claudeBase);
  printWindowsHookNote('NOTE: Windows — Hook scripts use Node.js; tmux-dependent features are skipped on Windows.');
  console.log('Done. Claude configs installed to ' + claudeBase + '/');
}

function resolveCursorDestDir(globalScope, projectDir) {
  return globalScope ? path.join(os.homedir(), '.cursor') : path.join(projectDir, '.cursor');
}

function printCursorGlobalRulesNote(globalScope) {
  if (!globalScope) return;
  console.log('');
  console.log('NOTE: Cursor does not support file-based rules in ~/.cursor/rules.');
  console.log('      Add global rules in Settings > Cursor Settings > General > Rules for AI');
  console.log('');
}

function installCursorRules(destDir, selectedPackages, globalScope) {
  const cursorRulesSrc = path.join(CURSOR_SRC, 'rules');
  if (globalScope) {
    console.log('Skipping rules (not supported globally by Cursor).');
    return;
  }

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
      const destPath = path.join(rulesDest, ruleFile);
      if (!fs.existsSync(srcPath)) {
        console.error(`Warning: Cursor rule '${ruleFile}' for package '${selectedPackage.name}' does not exist, skipping.`);
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
      copiedRules.add(ruleFile);
    }
  }

  if (copiedRules.size > 0) {
    console.log('Installing Cursor package rules -> ' + rulesDest + '/');
  }
}

function installCursorSkills(destDir, selectedPackages) {
  const skillsDest = path.join(destDir, 'skills');
  const sharedSkillsSrc = path.join(REPO_ROOT, 'skills');
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
  const agentsSrc = path.join(REPO_ROOT, 'agents');
  const agentsDest = path.join(destDir, 'agents');
  if (fs.existsSync(agentsSrc)) {
    const agentFiles = getManifestSelections(selectedPackages, 'agents');
    if (copySelectedMarkdownFiles(agentsSrc, agentsDest, agentFiles, 'Package-selected agent') > 0) {
      console.log('Installing package-selected agents -> ' + agentsDest + '/');
    }
  }

  installCursorSkills(destDir, selectedPackages);

  const commandsSrc = path.join(CURSOR_SRC, 'commands');
  const commandsDest = path.join(destDir, 'commands');
  if (fs.existsSync(commandsSrc)) {
    const cursorCommandFiles = getToolManifestSelections(selectedPackages, 'cursor', 'commands');
    if (cursorCommandFiles.length > 0) {
      if (copySelectedMarkdownFiles(commandsSrc, commandsDest, cursorCommandFiles, 'Cursor package-selected command') > 0) {
        console.log('Installing Cursor package commands -> ' + commandsDest + '/');
      }
    }
  }

  if (devMode && installDevSharedSkills(destDir) > 0) {
    console.log('Installing dev-only shared skills -> ' + path.join(destDir, 'skills') + '/');
  }
}

function installCursorHooksConfig(destDir, globalScope) {
  const hooksJsonSrc = getHookPlatform('cursor').sourceConfig;
  if (!fs.existsSync(hooksJsonSrc)) return;

  const hooksDestPath = path.join(destDir, 'hooks.json');
  let content = fs.readFileSync(hooksJsonSrc, 'utf8');
  if (globalScope) {
    const absoluteHooksDir = path.join(destDir, 'hooks').replace(/\\/g, '/');
    content = content.replace(/node \.cursor\/hooks\//g, 'node ' + absoluteHooksDir + '/');
  }
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

  const hooksDest = path.join(destDir, 'hooks');
  console.log('Installing hook scripts -> ' + hooksDest + '/');
  copyRecursiveSync(hooksSrc, hooksDest);
}

function installCursorRuntimeScripts(destDir) {
  const scriptsDest = path.join(destDir, 'scripts');
  console.log('Installing runtime scripts -> ' + scriptsDest + '/');
  copyRuntimeScripts(scriptsDest);
}

function installCursorMcp(destDir) {
  const mcpSrc = path.join(CURSOR_SRC, 'mcp.json');
  if (!fs.existsSync(mcpSrc)) return;

  const mcpDest = path.join(destDir, 'mcp.json');
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(mcpSrc, mcpDest);
  console.log('Installing MCP config -> ' + mcpDest);
}

function installCursor(packageNames, globalScope, projectDir, devMode = false) {
  const destDir = resolveCursorDestDir(globalScope, projectDir);
  if (!packageNames.length) usage('cursor');
  const selectedPackages = resolveSelectedPackages(packageNames);
  for (const warning of assertPackageRequirements('cursor', selectedPackages)) {
    console.warn('Warning: ' + warning);
  }

  console.log('Installing Cursor configs to ' + destDir + '/');
  printCursorGlobalRulesNote(globalScope);
  installCursorRules(destDir, selectedPackages, globalScope);
  installCursorCoreDirs(destDir, selectedPackages, devMode);
  const skipHooks = String(process.env.MDT_SKIP_CURSOR_HOOKS || '').trim() === '1';
  if (skipHooks) {
    console.log('Skipping Cursor hooks install because MDT_SKIP_CURSOR_HOOKS=1');
  } else {
    installCursorHooksConfig(destDir, globalScope);
    installCursorHookScripts(destDir);
  }
  installCursorRuntimeScripts(destDir);
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
  const sharedSkillNames = getManifestSelections(selectedPackages, 'skills');
  if (copySelectedDirectories(CODEX_SKILLS_SRC, skillsDest, sharedSkillNames, 'Codex package-selected skill') > 0) {
    console.log('Installing Codex package-selected skills -> ' + skillsDest + '/');
  }

  const codexSkillNames = getToolManifestSelections(selectedPackages, 'codex', 'skills');
  if (copySelectedDirectories(CODEX_SKILLS_SRC, skillsDest, codexSkillNames, 'Codex tool skill') > 0) {
    console.log('Installing Codex tool skills -> ' + skillsDest + '/');
  }

  if (devMode) {
    if (copySelectedDirectories(CODEX_SKILLS_SRC, skillsDest, ['tool-setup-verifier'], 'Codex dev skill') > 0) {
      console.log('Installing Codex dev skills -> ' + skillsDest + '/');
    }
    if (installDevSharedSkills(destDir) > 0) {
      console.log('Installing dev-only shared skills -> ' + skillsDest + '/');
    }
  }
}

function installCodexRuntimeScripts(projectAgentsDir) {
  const scriptsDest = path.join(projectAgentsDir, 'scripts');
  console.log('Installing Codex runtime scripts -> ' + scriptsDest + '/');
  copyRuntimeScripts(scriptsDest);
}

function installCodexWorkflowScripts(projectAgentsDir, selectedPackages, devMode = false) {
  const scriptsDest = path.join(projectAgentsDir, 'scripts');
  const baselineWorkflowScripts = devMode ? ['smoke-tool-setups.js', 'smoke-codex-workflows.js'] : [];
  const optionalWorkflowScripts = getToolManifestSelections(selectedPackages, 'codex', 'scripts');
  const workflowScripts = mergeUniqueOrdered(baselineWorkflowScripts, optionalWorkflowScripts);
  if (copyExplicitFiles(path.join(REPO_ROOT, 'scripts'), scriptsDest, workflowScripts, 'Codex workflow script') > 0) {
    console.log('Installing Codex workflow scripts -> ' + scriptsDest + '/');
  }
}

function installCodexGlobal(selectedPackages) {
  const destDir = path.join(os.homedir(), '.codex');
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

  if (process.platform === 'win32') {
    console.log('');
    console.log('NOTE: Existing ~/.codex/config.toml is preserved when present.');
    console.log('      MDT writes config.mdt.toml as a reference file instead of overwriting user Codex settings.');
    console.log('');
  }
  console.log('Done. Codex global configs installed to ' + destDir + '/');
}

function installCodexProject(selectedPackages, projectDir, devMode) {
  const projectAgentsDir = path.join(projectDir, '.agents');
  console.log('Installing Codex project files to ' + projectAgentsDir + '/');
  installCodexSkills(selectedPackages, projectAgentsDir, devMode);
  installCodexRuntimeScripts(projectAgentsDir);
  installCodexWorkflowScripts(projectAgentsDir, selectedPackages, devMode);
  console.log('Done. Codex project files installed to ' + projectAgentsDir + '/');
}

function installCodex(packageNames, globalScope, projectDir, devMode) {
  if (!fs.existsSync(CODEX_SRC)) {
    console.error('Error: codex-template source directory not found at ' + CODEX_SRC);
    process.exit(1);
  }
  if (!packageNames.length) usage('codex');

  const selectedPackages = resolveSelectedPackages(packageNames);
  for (const warning of assertPackageRequirements('codex', selectedPackages)) {
    console.warn('Warning: ' + warning);
  }

  if (globalScope) {
    installCodexGlobal(selectedPackages);
    return;
  }

  installCodexProject(selectedPackages, projectDir, devMode);
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

function resolveGeminiDestinations(globalScope, projectDir) {
  return {
    destDirAgent: globalScope ? path.join(os.homedir(), '.gemini/antigravity/.agents') : path.join(projectDir, '.agent'),
    destDirGemini: globalScope ? path.join(os.homedir(), '.gemini') : path.join(projectDir, '.gemini')
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

function copyGeminiLocalRules(cursorRules, selectedPackages, destDirAgent) {
  const rulesDest = path.join(destDirAgent, 'rules');
  const selectedRules = getGeminiRuleSelections(selectedPackages);
  let foundRules = false;

  fs.mkdirSync(rulesDest, { recursive: true });
  for (const ruleFile of selectedRules) {
    const srcPath = path.join(cursorRules, ruleFile);
    if (!fs.existsSync(srcPath)) {
      console.error(`Warning: Gemini rule '${ruleFile}' does not exist, skipping.`);
      continue;
    }
    fs.copyFileSync(srcPath, path.join(rulesDest, ruleFile));
    foundRules = true;
  }

  if (foundRules) {
    console.log('Installing package-selected Gemini rules -> ' + rulesDest + '/');
  }
}

function installGeminiRules(selectedPackages, globalScope, destDirAgent, destDirGemini) {
  const cursorRules = path.join(CURSOR_SRC, 'rules');
  if (selectedPackages.length === 0) {
    console.log('No packages provided, skipping rules...');
    return;
  }
  if (!fs.existsSync(cursorRules)) return;

  if (globalScope) {
    appendGeminiGlobalRules(cursorRules, selectedPackages, destDirGemini);
    return;
  }
  copyGeminiLocalRules(cursorRules, selectedPackages, destDirAgent);
}

function installGeminiContent(destDirAgent, destDirGemini, selectedPackages, devMode = false) {
  const skillsSrc = path.join(REPO_ROOT, 'skills');
  if (fs.existsSync(skillsSrc)) {
    const skillsDest = path.join(destDirAgent, 'skills');
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
}

function installGemini(packageNames, globalScope, projectDir, devMode = false) {
  console.log('Installing Gemini CLI / Antigravity configs...');
  const { destDirAgent, destDirGemini } = resolveGeminiDestinations(globalScope, projectDir);
  const selectedPackages = resolveSelectedPackages(packageNames);
  for (const warning of assertPackageRequirements('gemini', selectedPackages)) {
    console.warn('Warning: ' + warning);
  }
  installGeminiRules(selectedPackages, globalScope, destDirAgent, destDirGemini);
  installGeminiContent(destDirAgent, destDirGemini, selectedPackages, devMode);
  console.log('Done. Gemini configs installed.');
}

function main() {
  const { target, globalScope, listMode, dryRun, devMode, projectDir, packageNames } = parseArgs();

  if (!dryRun && !listMode && !globalScope && projectDir === null) {
    console.log('No install scope specified. Nothing was installed.');
    console.log('');
    console.log('Specify where to install using one of:');
    console.log('');
    console.log('  --global');
    console.log('      Install to your home directory (~/.claude/, ~/.cursor/, etc.).');
    console.log('      Makes MDT available across all projects for this user.');
    console.log('');
    console.log('  --project-dir <path>');
    console.log('      Install project-level files into the specified repository path.');
    console.log('      Use this to add MDT to a specific project.');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/install-mdt.js --global typescript');
    console.log('  node scripts/install-mdt.js --project-dir /path/to/my-project typescript');
    console.log('  node scripts/install-mdt.js --target cursor --global typescript');
    process.exit(0);
  }

  const resolvedProjectDir = projectDir !== null ? assertProjectDir(projectDir) : null;

  if (target !== 'claude' && target !== 'cursor' && target !== 'codex' && target !== 'gemini') {
    console.error("Error: unknown target '" + target + "'. Must be claude, cursor, codex, or gemini.");
    process.exit(1);
  }
  if (listMode) {
    printAvailableOptions(target);
    process.exit(0);
  }
  if (dryRun) {
    try {
      const plan = buildInstallPlan({ target, globalScope, devMode, projectDir: resolvedProjectDir || process.cwd(), packageNames });
      plan.forEach((line) => console.log(line));
      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      usage(target);
    }
  }
  try {
    if (target === 'claude') installClaude(packageNames, globalScope, resolvedProjectDir, devMode);
    else if (target === 'cursor') installCursor(packageNames, globalScope, resolvedProjectDir, devMode);
    else if (target === 'gemini') installGemini(packageNames, globalScope, resolvedProjectDir, devMode);
    else installCodex(packageNames, globalScope, resolvedProjectDir, devMode);
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
  installClaudeContentDirs,
  installCursorCoreDirs,
  installGeminiContent,
  installCodexSkills
};

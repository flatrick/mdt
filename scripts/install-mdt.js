#!/usr/bin/env node
/**
 * ModelDev Toolkit installer.
 * Node-only installer for rules, agents, skills, commands, hooks, and configs.
 *
 * Usage:
 *   node scripts/install-mdt.js [--target claude|cursor|codex] [--global] [package ...]
 *
 * Examples:
 *   node scripts/install-mdt.js typescript
 *   node scripts/install-mdt.js --target cursor typescript
 *   node scripts/install-mdt.js --target cursor --global typescript
 *   node scripts/install-mdt.js --target codex
 *
 * Targets:
 *   claude (default) — Install to ./.claude/ or ~/.claude/ with --global
 *   cursor           — Install to ./.cursor/ or ~/.cursor/ with --global
 *   codex            — Install to ~/.codex/ (no language args)
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

function parseArgs() {
  const args = process.argv.slice(2);
  return parseArgsFrom(args);
}

function parseArgsFrom(args) {
  let target = 'claude';
  let globalScope = false;
  let listMode = false;
  let dryRun = false;
  const packageNames = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) {
      target = args[++i];
      if (target === 'antigravity') target = 'gemini';
    } else if (args[i] === '--global') {
      globalScope = true;
    } else if (args[i] === '--list') {
      listMode = true;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (!args[i].startsWith('-')) {
      packageNames.push(args[i]);
    }
  }

  return { target, globalScope, listMode, dryRun, packageNames };
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

function loadPackageManifest(packageName) {
  const packagePath = path.join(PACKAGES_DIR, packageName, 'package.json');
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
    agents: Array.isArray(parsed.agents) ? parsed.agents : [],
    commands: Array.isArray(parsed.commands) ? parsed.commands : [],
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    tools: typeof parsed.tools === 'object' && parsed.tools ? parsed.tools : {}
  };
}

function resolveSelectedPackages(packageNames) {
  return packageNames.map(loadPackageManifest);
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

function getManifestSelections(selectedPackages, key) {
  return [...new Set(
    selectedPackages.flatMap((pkg) => Array.isArray(pkg[key]) ? pkg[key] : [])
  )].sort();
}

function printAvailableOptions(target) {
  console.log('Available targets: claude (supports --global), cursor (supports --global), codex, gemini (supports --global)');
  if (target !== 'codex') {
    const packages = getAvailablePackages();
    console.log('Available packages:');
    if (packages.length === 0) {
      console.log('  (none found under packages/)');
    } else {
      packages.forEach((packageName) => console.log('  - ' + packageName));
    }
  }
}

function getDryRunHeader(target, globalScope) {
  const targetDisplay = target + (globalScope ? ' (global)' : '');
  return [`[dry-run] Target: ${targetDisplay}`];
}

function buildCodexInstallPlan(lines) {
  return [
    ...lines,
    `[dry-run] Would install from ${CODEX_SRC} to ${path.join(os.homedir(), '.codex')}`
  ];
}

function buildGeminiInstallPlan(lines, globalScope, selectedPackages) {
  const agentsDest = globalScope ? path.join(os.homedir(), '.gemini/antigravity/.agents') : path.join(process.cwd(), '.agent');
  const cmdsDest = globalScope ? path.join(os.homedir(), '.gemini/commands') : path.join(process.cwd(), '.gemini/commands');
  const nextLines = [
    ...lines,
    `[dry-run] Packages: ${getSelectedPackageSummary(selectedPackages)}`,
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

function buildClaudeInstallPlan(lines, globalScope, selectedPackages) {
  const packages = getSelectedPackageSummary(selectedPackages);
  const claudeBase = globalScope
    ? (process.env.CLAUDE_BASE_DIR || path.join(os.homedir(), '.claude'))
    : path.join(process.cwd(), '.claude');

  const nextLines = [
    ...lines,
    `[dry-run] Packages: ${packages}`,
    `[dry-run] Would install into ${claudeBase}`,
    '[dry-run] Would copy rules, package-selected agents/commands/skills, hooks, and runtime scripts (scripts/hooks + scripts/lib)'
  ];

  if (globalScope) {
    return nextLines;
  }
  return [...nextLines, '[dry-run] Hook script paths will use project-relative references'];
}

function buildCursorInstallPlan(lines, globalScope, selectedPackages) {
  const packages = getSelectedPackageSummary(selectedPackages);
  const cursorBase = globalScope ? path.join(os.homedir(), '.cursor') : path.join(process.cwd(), '.cursor');
  const nextLines = [
    ...lines,
    `[dry-run] Packages: ${packages}`,
    `[dry-run] Would install into ${cursorBase}`,
    '[dry-run] Would copy package-selected agents, package-selected skills, hook scripts, hooks config, mcp config, and runtime scripts (scripts/hooks + scripts/lib)'
  ];

  if (globalScope) {
    return [...nextLines, '[dry-run] Would skip file-based rules (Cursor global mode limitation)'];
  }
  return [...nextLines, '[dry-run] Would install Cursor rules and skills declared by the selected packages'];
}

function buildInstallPlan({ target, globalScope, packageNames }) {
  const header = getDryRunHeader(target, globalScope);
  const selectedPackages = target === 'codex' ? [] : resolveSelectedPackages(packageNames);

  if (target === 'codex') return buildCodexInstallPlan(header);
  if (target === 'gemini') return buildGeminiInstallPlan(header, globalScope, selectedPackages);
  if (target === 'claude') return buildClaudeInstallPlan(header, globalScope, selectedPackages);

  return buildCursorInstallPlan(header, globalScope, selectedPackages);
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
}

function usage(target) {
  console.error('Usage: node scripts/install-mdt.js [--target claude|cursor|codex|gemini] [--global] [--list] [--dry-run] [package ...]');
  console.error('');
  console.error('Targets:');
  console.error('  claude (default) — Install to ./.claude/ (or ~/.claude/ with --global)');
  console.error('  cursor           — Install to ./.cursor/ (or ~/.cursor/ with --global)');
  console.error('  codex            — Install Codex CLI config to ~/.codex/ (no language needed)');
  console.error('  gemini           — Install Antigravity/Gemini CLI configs to .agent/ and .gemini/ (or ~/.gemini... with --global)');
  console.error('');
  console.error('Options:');
  console.error('  --global         — Install to home directory instead of current project.');
  console.error('  --list           — Show available targets/packages and exit.');
  console.error('  --dry-run        — Print planned install actions without writing files.');
  console.error('');
  if (target !== 'codex') {
    console.error('Available packages:');
    getAvailablePackages().forEach((packageName) => console.error('  - ' + packageName));
  }
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

function resolveClaudePaths(globalScope) {
  const claudeBase = globalScope
    ? (process.env.CLAUDE_BASE_DIR || path.join(os.homedir(), '.claude'))
    : path.join(process.cwd(), '.claude');
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

function installClaudeCommonRules(rulesDest) {
  const commonDest = path.join(rulesDest, 'common');
  const commonSrc = path.join(RULES_DIR, 'common');
  console.log('Installing common rules -> ' + commonDest + '/');
  if (fs.existsSync(commonSrc) && path.resolve(REPO_ROOT) !== path.resolve(rulesDest)) {
    copyRecursiveSync(commonSrc, commonDest);
  }
}

function installClaudeLanguageRules(selectedPackages, rulesDest) {
  for (const ruleDirectory of getPackageRuleDirectories(selectedPackages)) {
    const language = ruleDirectory;
    if (!isValidLanguageName(language)) {
      console.error("Error: invalid language name '" + language + "'. Only alphanumeric, dash, underscore allowed.");
      continue;
    }

    const langSrc = path.join(RULES_DIR, language);
    if (!fs.existsSync(langSrc)) {
      console.error('Warning: rules/' + language + '/ does not exist, skipping.');
      continue;
    }

    const langDest = path.join(rulesDest, language);
    console.log('Installing ' + language + ' rules -> ' + langDest + '/');
    if (path.resolve(REPO_ROOT) !== path.resolve(rulesDest)) {
      copyRecursiveSync(langSrc, langDest);
    }
  }
}

function installClaudeContentDirs(claudeBase, selectedPackages) {
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
}

function printWindowsHookNote(prefix) {
  if (process.platform !== 'win32') return;
  console.log('');
  console.log(prefix);
  console.log('');
}

function installClaude(packageNames, globalScope) {
  const { claudeBase, rulesDest } = resolveClaudePaths(globalScope);
  if (!packageNames.length) usage('claude');
  const selectedPackages = resolveSelectedPackages(packageNames);

  warnExistingRulesDir(rulesDest);
  installClaudeCommonRules(rulesDest);
  installClaudeLanguageRules(selectedPackages, rulesDest);
  installClaudeContentDirs(claudeBase, selectedPackages);
  installClaudeHooks(claudeBase, globalScope);
  installClaudeRuntimeScripts(claudeBase);
  printWindowsHookNote('NOTE: Windows — Hook scripts use Node.js; tmux-dependent features are skipped on Windows.');
  console.log('Done. Claude configs installed to ' + claudeBase + '/');
}

function resolveCursorDestDir(globalScope) {
  return globalScope ? path.join(os.homedir(), '.cursor') : path.join(process.cwd(), '.cursor');
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
  const skillsSrc = path.join(CURSOR_SRC, 'skills');
  if (!fs.existsSync(skillsSrc)) {
    return;
  }

  const skillsDest = path.join(destDir, 'skills');
  let copied = 0;
  for (const selectedPackage of selectedPackages) {
    const cursorSkills = Array.isArray(selectedPackage.tools.cursor?.skills)
      ? selectedPackage.tools.cursor.skills
      : [];

    for (const skillName of cursorSkills) {
      const skillSrc = path.join(skillsSrc, skillName);
      const skillDest = path.join(skillsDest, skillName);
      if (!fs.existsSync(skillSrc)) {
        console.error(`Warning: Cursor skill '${skillName}' for package '${selectedPackage.name}' does not exist, skipping.`);
        continue;
      }
      copyRecursiveSync(skillSrc, skillDest);
      copied++;
    }
  }

  if (copied > 0) {
    console.log('Installing Cursor package skills -> ' + skillsDest + '/');
  }
}

function installCursorCoreDirs(destDir, selectedPackages) {
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
    console.log('Installing commands -> ' + commandsDest + '/');
    copyRecursiveSync(commandsSrc, commandsDest);
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

function installCursor(packageNames, globalScope) {
  const destDir = resolveCursorDestDir(globalScope);
  if (!packageNames.length) usage('cursor');
  const selectedPackages = resolveSelectedPackages(packageNames);

  console.log('Installing Cursor configs to ' + destDir + '/');
  printCursorGlobalRulesNote(globalScope);
  installCursorRules(destDir, selectedPackages, globalScope);
  installCursorCoreDirs(destDir, selectedPackages);
  installCursorHooksConfig(destDir, globalScope);
  installCursorHookScripts(destDir);
  installCursorRuntimeScripts(destDir);
  installCursorMcp(destDir);
  printWindowsHookNote('NOTE: Windows — Cursor hooks use Node.js; tmux features are skipped on Windows.');
  console.log('Done. Cursor configs installed to ' + destDir + '/');
}

function installCodex() {
  if (!fs.existsSync(CODEX_SRC)) {
    console.error('Error: codex-template source directory not found at ' + CODEX_SRC);
    process.exit(1);
  }
  const destDir = path.join(os.homedir(), '.codex');
  console.log('Installing Codex CLI configs to ' + destDir + '/');
  fs.mkdirSync(destDir, { recursive: true });

  const configSrc = path.join(CODEX_SRC, 'config.toml');
  if (fs.existsSync(configSrc)) {
    const configDest = path.join(destDir, 'config.toml');
    if (fs.existsSync(configDest)) {
      console.log('Note: ' + configDest + ' already exists. It will be overwritten.');
    }
    fs.copyFileSync(configSrc, configDest);
    console.log('Installing Codex config -> ' + configDest);
  }

  const agentsMdSrc = path.join(CODEX_SRC, 'AGENTS.md');
  if (fs.existsSync(agentsMdSrc)) {
    fs.copyFileSync(agentsMdSrc, path.join(destDir, 'AGENTS.md'));
    console.log('Installing Codex AGENTS.md -> ' + path.join(destDir, 'AGENTS.md'));
  }

  if (process.platform === 'win32') {
    console.log('');
    console.log('NOTE: config.toml may reference macOS-only tools (e.g. terminal-notifier).');
    console.log('      Adjust or remove the [notify] section on Windows.');
    console.log('');
  }
  console.log('Done. Codex configs installed to ' + destDir + '/');
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

function resolveGeminiDestinations(globalScope) {
  return {
    destDirAgent: globalScope ? path.join(os.homedir(), '.gemini/antigravity/.agents') : path.join(process.cwd(), '.agent'),
    destDirGemini: globalScope ? path.join(os.homedir(), '.gemini') : path.join(process.cwd(), '.gemini')
  };
}

function collectGeminiRuleContent(cursorRules, selectedPackages) {
  let combined = '';
  const ruleFiles = fs.readdirSync(cursorRules);

  ruleFiles.forEach(fileName => {
    if (fileName.startsWith('common-') && fileName.endsWith('.md')) {
      combined += '\n\n' + fs.readFileSync(path.join(cursorRules, fileName), 'utf8');
    }
  });

  for (const language of getPackageRuleDirectories(selectedPackages)) {
    if (!isValidLanguageName(language)) continue;
    ruleFiles.forEach(fileName => {
      if (fileName.startsWith(language + '-') && fileName.endsWith('.md')) {
        combined += '\n\n' + fs.readFileSync(path.join(cursorRules, fileName), 'utf8');
      }
    });
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
  const ruleFiles = fs.readdirSync(cursorRules);
  let foundRules = false;

  fs.mkdirSync(rulesDest, { recursive: true });
  ruleFiles.forEach(fileName => {
    if (fileName.startsWith('common-') && fileName.endsWith('.md')) {
      fs.copyFileSync(path.join(cursorRules, fileName), path.join(rulesDest, fileName));
      foundRules = true;
    }
  });

  for (const language of getPackageRuleDirectories(selectedPackages)) {
    if (!isValidLanguageName(language)) continue;
    ruleFiles.forEach(fileName => {
      if (fileName.startsWith(language + '-') && fileName.endsWith('.md')) {
        fs.copyFileSync(path.join(cursorRules, fileName), path.join(rulesDest, fileName));
        foundRules = true;
      }
    });
  }

  if (foundRules) {
    console.log('Installing base & ' + selectedPackages.map((pkg) => pkg.name).join(', ') + ' rules -> ' + rulesDest + '/');
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

function installGeminiContent(destDirAgent, destDirGemini, selectedPackages) {
  const skillsSrc = path.join(REPO_ROOT, 'skills');
  if (fs.existsSync(skillsSrc)) {
    const skillsDest = path.join(destDirAgent, 'skills');
    const skillNames = getManifestSelections(selectedPackages, 'skills');
    if (copySelectedDirectories(skillsSrc, skillsDest, skillNames, 'Package-selected skill') > 0) {
      console.log('Installing package-selected skills -> ' + skillsDest + '/');
    }
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

function installGemini(packageNames, globalScope) {
  console.log('Installing Gemini CLI / Antigravity configs...');
  const { destDirAgent, destDirGemini } = resolveGeminiDestinations(globalScope);
  const selectedPackages = resolveSelectedPackages(packageNames);
  installGeminiRules(selectedPackages, globalScope, destDirAgent, destDirGemini);
  installGeminiContent(destDirAgent, destDirGemini, selectedPackages);
  console.log('Done. Gemini configs installed.');
}

function main() {
  const { target, globalScope, listMode, dryRun, packageNames } = parseArgs();

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
      const plan = buildInstallPlan({ target, globalScope, packageNames });
      plan.forEach((line) => console.log(line));
      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      usage(target);
    }
  }
  if (globalScope && target === 'codex') {
    console.error("Warning: --global is not supported for codex target. Ignored.");
  }

  try {
    if (target === 'claude') installClaude(packageNames, globalScope);
    else if (target === 'cursor') installCursor(packageNames, globalScope);
    else if (target === 'gemini') installGemini(packageNames, globalScope);
    else installCodex();
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
  installClaudeContentDirs,
  installCursorCoreDirs,
  installGeminiContent
};

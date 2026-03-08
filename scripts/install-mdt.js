#!/usr/bin/env node
/**
 * ModelDev Toolkit installer.
 * Node-only installer for rules, agents, skills, commands, hooks, and configs.
 *
 * Usage:
 *   node scripts/install-mdt.js [--target claude|cursor|codex] [--global] [language ...]
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
  const languages = [];

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
      languages.push(args[i]);
    }
  }

  return { target, globalScope, listMode, dryRun, languages };
}

function getAvailableLanguages() {
  if (!fs.existsSync(RULES_DIR)) {
    return [];
  }
  return fs.readdirSync(RULES_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== 'common')
    .map(e => e.name)
    .sort();
}

function printAvailableOptions(target) {
  console.log('Available targets: claude (supports --global), cursor (supports --global), codex, gemini (supports --global)');
  if (target !== 'codex' && target !== 'gemini') {
    const langs = getAvailableLanguages();
    console.log('Available languages:');
    if (langs.length === 0) {
      console.log('  (none found under rules/)');
    } else {
      langs.forEach((lang) => console.log('  - ' + lang));
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

function buildGeminiInstallPlan(lines, globalScope, languages) {
  const agentsDest = globalScope ? path.join(os.homedir(), '.gemini/antigravity/.agents') : path.join(process.cwd(), '.agent');
  const cmdsDest = globalScope ? path.join(os.homedir(), '.gemini/commands') : path.join(process.cwd(), '.gemini/commands');
  const nextLines = [
    ...lines,
    `[dry-run] Would install agents and skills to ${agentsDest}`,
    `[dry-run] Would install custom commands to ${cmdsDest}`
  ];

  if (languages.length === 0) {
    return nextLines;
  }

  if (globalScope) {
    return [
      ...nextLines,
      `[dry-run] Would append rules for [${languages.join(', ')}] to ${path.join(os.homedir(), '.gemini/GEMINI.md')}`
    ];
  }

  return [
    ...nextLines,
    `[dry-run] Would install rules for [${languages.join(', ')}] to ${path.join(agentsDest, 'rules')}`
  ];
}

function buildClaudeInstallPlan(lines, globalScope, languages) {
  const rules = languages.length > 0 ? languages.join(', ') : '(none provided)';
  const claudeBase = globalScope
    ? (process.env.CLAUDE_BASE_DIR || path.join(os.homedir(), '.claude'))
    : path.join(process.cwd(), '.claude');

  const nextLines = [
    ...lines,
    `[dry-run] Languages: ${rules}`,
    `[dry-run] Would install into ${claudeBase}`,
    '[dry-run] Would copy rules, agents, commands, skills, hooks, and runtime scripts (scripts/hooks + scripts/lib)'
  ];

  if (globalScope) {
    return nextLines;
  }
  return [...nextLines, '[dry-run] Hook script paths will use project-relative references'];
}

function buildCursorInstallPlan(lines, globalScope, languages) {
  const rules = languages.length > 0 ? languages.join(', ') : '(none provided)';
  const cursorBase = globalScope ? path.join(os.homedir(), '.cursor') : path.join(process.cwd(), '.cursor');
  const nextLines = [
    ...lines,
    `[dry-run] Languages: ${rules}`,
    `[dry-run] Would install into ${cursorBase}`,
    '[dry-run] Would copy agents, skills, commands, hook scripts, hooks config, mcp config, and runtime scripts (scripts/hooks + scripts/lib)'
  ];

  if (globalScope) {
    return [...nextLines, '[dry-run] Would skip file-based rules (Cursor global mode limitation)'];
  }
  return [...nextLines, '[dry-run] Would install matching Cursor rules for provided languages'];
}

function buildInstallPlan({ target, globalScope, languages }) {
  const header = getDryRunHeader(target, globalScope);

  if (target === 'codex') return buildCodexInstallPlan(header);
  if (target === 'gemini') return buildGeminiInstallPlan(header, globalScope, languages);
  if (target === 'claude') return buildClaudeInstallPlan(header, globalScope, languages);

  return buildCursorInstallPlan(header, globalScope, languages);
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
  console.error('Usage: node scripts/install-mdt.js [--target claude|cursor|codex|gemini] [--global] [--list] [--dry-run] [language ...]');
  console.error('');
  console.error('Targets:');
  console.error('  claude (default) — Install to ./.claude/ (or ~/.claude/ with --global)');
  console.error('  cursor           — Install to ./.cursor/ (or ~/.cursor/ with --global)');
  console.error('  codex            — Install Codex CLI config to ~/.codex/ (no language needed)');
  console.error('  gemini           — Install Antigravity/Gemini CLI configs to .agent/ and .gemini/ (or ~/.gemini... with --global)');
  console.error('');
  console.error('Options:');
  console.error('  --global         — Install to home directory instead of current project.');
  console.error('  --list           — Show available targets/languages and exit.');
  console.error('  --dry-run        — Print planned install actions without writing files.');
  console.error('');
  if (target !== 'codex' && target !== 'gemini') {
    console.error('Available languages:');
    getAvailableLanguages().forEach((lang) => console.error('  - ' + lang));
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

function installClaudeLanguageRules(languages, rulesDest) {
  for (const language of languages) {
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

function installClaudeContentDirs(claudeBase) {
  const agentsSrc = path.join(REPO_ROOT, 'agents');
  const agentsDest = path.join(claudeBase, 'agents');
  if (fs.existsSync(agentsSrc) && path.resolve(agentsSrc) !== path.resolve(agentsDest)) {
    console.log('Installing agents -> ' + agentsDest + '/');
    copyMarkdownFiles(agentsSrc, agentsDest);
  }

  const commandsSrc = path.join(REPO_ROOT, 'commands');
  const commandsDest = path.join(claudeBase, 'commands');
  if (fs.existsSync(commandsSrc) && path.resolve(commandsSrc) !== path.resolve(commandsDest)) {
    console.log('Installing commands -> ' + commandsDest + '/');
    copyMarkdownFiles(commandsSrc, commandsDest);
  }

  const skillsSrc = path.join(REPO_ROOT, 'skills');
  const skillsDest = path.join(claudeBase, 'skills');
  if (fs.existsSync(skillsSrc) && path.resolve(skillsSrc) !== path.resolve(skillsDest)) {
    console.log('Installing skills -> ' + skillsDest + '/');
    copyRecursiveSync(skillsSrc, skillsDest);
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

function installClaude(languages, globalScope) {
  const { claudeBase, rulesDest } = resolveClaudePaths(globalScope);
  if (!languages.length) usage('claude');

  warnExistingRulesDir(rulesDest);
  installClaudeCommonRules(rulesDest);
  installClaudeLanguageRules(languages, rulesDest);
  installClaudeContentDirs(claudeBase);
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

function installCursorRules(destDir, languages, globalScope) {
  const cursorRules = path.join(CURSOR_SRC, 'rules');
  if (globalScope) {
    console.log('Skipping rules (not supported globally by Cursor).');
    return;
  }

  const rulesDest = path.join(destDir, 'rules');
  fs.mkdirSync(rulesDest, { recursive: true });
  if (fs.existsSync(cursorRules)) {
    fs.readdirSync(cursorRules).forEach(fileName => {
      if (fileName.startsWith('common-') && fileName.endsWith('.md')) {
        fs.copyFileSync(path.join(cursorRules, fileName), path.join(rulesDest, fileName));
      }
    });
    console.log('Installing common rules -> ' + rulesDest + '/');
  }

  for (const language of languages) {
    if (!isValidLanguageName(language) || !fs.existsSync(cursorRules)) continue;

    let found = false;
    fs.readdirSync(cursorRules).forEach(fileName => {
      if (fileName.startsWith(language + '-') && fileName.endsWith('.md')) {
        fs.copyFileSync(path.join(cursorRules, fileName), path.join(rulesDest, fileName));
        found = true;
      }
    });

    if (found) console.log('Installing ' + language + ' rules -> ' + rulesDest + '/');
    else console.error("Warning: no Cursor rules for '" + language + "' found, skipping.");
  }
}

function installCursorCoreDirs(destDir) {
  const agentsSrc = path.join(REPO_ROOT, 'agents');
  const agentsDest = path.join(destDir, 'agents');
  if (fs.existsSync(agentsSrc)) {
    console.log('Installing agents -> ' + agentsDest + '/');
    copyMarkdownFiles(agentsSrc, agentsDest);
  }

  const skillsSrc = path.join(REPO_ROOT, 'skills');
  const skillsDest = path.join(destDir, 'skills');
  if (fs.existsSync(skillsSrc)) {
    console.log('Installing skills -> ' + skillsDest + '/');
    copyRecursiveSync(skillsSrc, skillsDest);
  }

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

function installCursor(languages, globalScope) {
  const destDir = resolveCursorDestDir(globalScope);
  if (!languages.length) usage('cursor');

  console.log('Installing Cursor configs to ' + destDir + '/');
  printCursorGlobalRulesNote(globalScope);
  installCursorRules(destDir, languages, globalScope);
  installCursorCoreDirs(destDir);
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

function collectGeminiRuleContent(cursorRules, languages) {
  let combined = '';
  const ruleFiles = fs.readdirSync(cursorRules);

  ruleFiles.forEach(fileName => {
    if (fileName.startsWith('common-') && fileName.endsWith('.md')) {
      combined += '\n\n' + fs.readFileSync(path.join(cursorRules, fileName), 'utf8');
    }
  });

  for (const language of languages) {
    if (!isValidLanguageName(language)) continue;
    ruleFiles.forEach(fileName => {
      if (fileName.startsWith(language + '-') && fileName.endsWith('.md')) {
        combined += '\n\n' + fs.readFileSync(path.join(cursorRules, fileName), 'utf8');
      }
    });
  }

  return combined;
}

function appendGeminiGlobalRules(cursorRules, languages, destDirGemini) {
  const geminiMdPath = path.join(destDirGemini, 'GEMINI.md');
  fs.mkdirSync(destDirGemini, { recursive: true });
  const rulesCombined = collectGeminiRuleContent(cursorRules, languages);
  if (!rulesCombined.trim()) return;

  const existing = fs.existsSync(geminiMdPath) ? fs.readFileSync(geminiMdPath, 'utf8') : '';
  fs.writeFileSync(geminiMdPath, existing + '\n' + rulesCombined.trim() + '\n', 'utf8');
  console.log('Appended rules for ' + languages.join(', ') + ' to ' + geminiMdPath);
}

function copyGeminiLocalRules(cursorRules, languages, destDirAgent) {
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

  for (const language of languages) {
    if (!isValidLanguageName(language)) continue;
    ruleFiles.forEach(fileName => {
      if (fileName.startsWith(language + '-') && fileName.endsWith('.md')) {
        fs.copyFileSync(path.join(cursorRules, fileName), path.join(rulesDest, fileName));
        foundRules = true;
      }
    });
  }

  if (foundRules) {
    console.log('Installing base & ' + languages.join(', ') + ' rules -> ' + rulesDest + '/');
  }
}

function installGeminiRules(languages, globalScope, destDirAgent, destDirGemini) {
  const cursorRules = path.join(CURSOR_SRC, 'rules');
  if (languages.length === 0) {
    console.log('No languages provided, skipping rules...');
    return;
  }
  if (!fs.existsSync(cursorRules)) return;

  if (globalScope) {
    appendGeminiGlobalRules(cursorRules, languages, destDirGemini);
    return;
  }
  copyGeminiLocalRules(cursorRules, languages, destDirAgent);
}

function installGeminiContent(destDirAgent, destDirGemini) {
  const skillsSrc = path.join(REPO_ROOT, 'skills');
  if (fs.existsSync(skillsSrc)) {
    const skillsDest = path.join(destDirAgent, 'skills');
    console.log('Installing skills -> ' + skillsDest + '/');
    copyRecursiveSync(skillsSrc, skillsDest);
  }

  const agentsSrc = path.join(REPO_ROOT, 'agents');
  if (fs.existsSync(agentsSrc)) {
    const workflowsDest = path.join(destDirAgent, 'workflows');
    console.log('Installing agents as workflows -> ' + workflowsDest + '/');
    copyMarkdownFiles(agentsSrc, workflowsDest);
  }

  const commandsSrc = path.join(REPO_ROOT, 'commands');
  if (fs.existsSync(commandsSrc)) {
    const commandsDest = path.join(destDirGemini, 'commands');
    console.log('Installing commands -> ' + commandsDest + '/');
    convertCommandsToToml(commandsSrc, commandsDest);
  }
}

function installGemini(languages, globalScope) {
  console.log('Installing Gemini CLI / Antigravity configs...');
  const { destDirAgent, destDirGemini } = resolveGeminiDestinations(globalScope);
  installGeminiRules(languages, globalScope, destDirAgent, destDirGemini);
  installGeminiContent(destDirAgent, destDirGemini);
  console.log('Done. Gemini configs installed.');
}

function main() {
  const { target, globalScope, listMode, dryRun, languages } = parseArgs();

  if (target !== 'claude' && target !== 'cursor' && target !== 'codex' && target !== 'gemini') {
    console.error("Error: unknown target '" + target + "'. Must be claude, cursor, codex, or gemini.");
    process.exit(1);
  }
  if (listMode) {
    printAvailableOptions(target);
    process.exit(0);
  }
  if (dryRun) {
    const plan = buildInstallPlan({ target, globalScope, languages });
    plan.forEach((line) => console.log(line));
    process.exit(0);
  }
  if (globalScope && target === 'codex') {
    console.error("Warning: --global is not supported for codex target. Ignored.");
  }

  if (target === 'claude') installClaude(languages, globalScope);
  else if (target === 'cursor') installCursor(languages, globalScope);
  else if (target === 'gemini') installGemini(languages, globalScope);
  else installCodex();
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgsFrom,
  getAvailableLanguages,
  buildInstallPlan
};

#!/usr/bin/env node
/**
 * ECC installer — Node-only. Install rules, agents, skills, commands, hooks, and configs.
 *
 * Usage:
 *   node scripts/install-ecc.js [--target claude|cursor|codex] [--global] [language ...]
 *
 * Examples:
 *   node scripts/install-ecc.js typescript
 *   node scripts/install-ecc.js --target cursor typescript
 *   node scripts/install-ecc.js --target cursor --global typescript
 *   node scripts/install-ecc.js --target codex
 *
 * Targets:
 *   claude (default) — Install to ~/.claude/
 *   cursor           — Install to ./.cursor/ or ~/.cursor/ with --global
 *   codex            — Install to ~/.codex/ (no language args)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.join(__dirname, '..');
const RULES_DIR = path.join(REPO_ROOT, 'rules');
const CURSOR_SRC = path.join(REPO_ROOT, '.cursor');
const CODEX_SRC = path.join(REPO_ROOT, '.codex');

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
  console.log('Available targets: claude, cursor, codex, gemini');
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

function buildInstallPlan({ target, globalScope, languages }) {
  const targetDisplay = target + (globalScope ? ' (global)' : '');
  const lines = [
    `[dry-run] Target: ${targetDisplay}`
  ];

  if (target === 'codex') {
    lines.push(`[dry-run] Would install from ${CODEX_SRC} to ${path.join(os.homedir(), '.codex')}`);
    return lines;
  }

  if (target === 'gemini') {
    const agentsDest = globalScope ? path.join(os.homedir(), '.gemini/antigravity/.agents') : path.join(process.cwd(), '.agent');
    const cmdsDest = globalScope ? path.join(os.homedir(), '.gemini/commands') : path.join(process.cwd(), '.gemini/commands');
    lines.push(`[dry-run] Would install agents and skills to ${agentsDest}`);
    lines.push(`[dry-run] Would install custom commands to ${cmdsDest}`);
    if (languages.length > 0) {
      if (globalScope) {
        lines.push(`[dry-run] Would append rules for [${languages.join(', ')}] to ${path.join(os.homedir(), '.gemini/GEMINI.md')}`);
      } else {
        lines.push(`[dry-run] Would install rules for [${languages.join(', ')}] to ${path.join(agentsDest, 'rules')}`);
      }
    }
    return lines;
  }

  const rules = languages.length > 0 ? languages.join(', ') : '(none provided)';
  lines.push(`[dry-run] Languages: ${rules}`);

  if (target === 'claude') {
    const homeDir = os.homedir();
    const claudeBase = process.env.CLAUDE_BASE_DIR || path.join(homeDir, '.claude');
    lines.push(`[dry-run] Would install into ${claudeBase}`);
    lines.push('[dry-run] Would copy rules, agents, commands, skills, hooks, and runtime scripts (scripts/hooks + scripts/lib)');
    return lines;
  }

  const cursorBase = globalScope ? path.join(os.homedir(), '.cursor') : path.join(process.cwd(), '.cursor');
  lines.push(`[dry-run] Would install into ${cursorBase}`);
  lines.push('[dry-run] Would copy agents, skills, commands, hook scripts, hooks config, mcp config, and runtime scripts (scripts/hooks + scripts/lib)');
  if (globalScope) {
    lines.push('[dry-run] Would skip file-based rules (Cursor global mode limitation)');
  } else {
    lines.push('[dry-run] Would install matching Cursor rules for provided languages');
  }
  return lines;
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
  console.error('Usage: node scripts/install-ecc.js [--target claude|cursor|codex|gemini] [--global] [--list] [--dry-run] [language ...]');
  console.error('');
  console.error('Targets:');
  console.error('  claude (default) — Install rules, agents, commands, hooks, skills to ~/.claude/');
  console.error('  cursor           — Install to ./.cursor/ (or ~/.cursor/ with --global)');
  console.error('  codex            — Install Codex CLI config to ~/.codex/ (no language needed)');
  console.error('  gemini           — Install Antigravity/Gemini CLI configs to .agent/ and .gemini/ (or ~/.gemini... with --global)');
  console.error('');
  console.error('Options:');
  console.error('  --global         — For cursor and gemini, install to home directory.');
  console.error('  --list           — Show available targets/languages and exit.');
  console.error('  --dry-run        — Print planned install actions without writing files.');
  console.error('');
  if (target !== 'codex' && target !== 'gemini') {
    console.error('Available languages:');
    getAvailableLanguages().forEach((lang) => console.error('  - ' + lang));
  }
  process.exit(1);
}

function installClaude(languages) {
  const homeDir = os.homedir();
  const claudeBase = process.env.CLAUDE_BASE_DIR || path.join(homeDir, '.claude');
  const rulesDest = process.env.CLAUDE_RULES_DIR || path.join(claudeBase, 'rules');

  if (!languages.length) usage('claude');

  if (fs.existsSync(rulesDest) && fs.readdirSync(rulesDest).length > 0) {
    console.log('Note: ' + rulesDest + '/ already exists. Existing files will be overwritten.');
    console.log('      Back up any local customizations before proceeding.');
  }

  // Rules: common
  const commonDest = path.join(rulesDest, 'common');
  console.log('Installing common rules -> ' + commonDest + '/');
  const commonSrc = path.join(RULES_DIR, 'common');
  if (fs.existsSync(commonSrc) && path.resolve(REPO_ROOT) !== path.resolve(rulesDest)) {
    copyRecursiveSync(commonSrc, commonDest);
  }

  // Rules: per-language
  for (const lang of languages) {
    if (!/^[a-zA-Z0-9_-]+$/.test(lang)) {
      console.error("Error: invalid language name '" + lang + "'. Only alphanumeric, dash, underscore allowed.");
      continue;
    }
    const langSrc = path.join(RULES_DIR, lang);
    if (!fs.existsSync(langSrc)) {
      console.error("Warning: rules/" + lang + "/ does not exist, skipping.");
      continue;
    }
    const langDest = path.join(rulesDest, lang);
    console.log('Installing ' + lang + ' rules -> ' + langDest + '/');
    if (path.resolve(REPO_ROOT) !== path.resolve(rulesDest)) {
      copyRecursiveSync(langSrc, langDest);
    }
  }

  // Agents
  const agentsSrc = path.join(REPO_ROOT, 'agents');
  if (fs.existsSync(agentsSrc)) {
    const agentsDest = path.join(claudeBase, 'agents');
    console.log('Installing agents -> ' + agentsDest + '/');
    if (path.resolve(agentsSrc) !== path.resolve(agentsDest)) {
      fs.mkdirSync(agentsDest, { recursive: true });
      fs.readdirSync(agentsSrc).forEach(f => {
        if (f.endsWith('.md')) fs.copyFileSync(path.join(agentsSrc, f), path.join(agentsDest, f));
      });
    }
  }

  // Commands
  const commandsSrc = path.join(REPO_ROOT, 'commands');
  if (fs.existsSync(commandsSrc)) {
    const commandsDest = path.join(claudeBase, 'commands');
    console.log('Installing commands -> ' + commandsDest + '/');
    if (path.resolve(commandsSrc) !== path.resolve(commandsDest)) {
      fs.mkdirSync(commandsDest, { recursive: true });
      fs.readdirSync(commandsSrc).forEach(f => {
        if (f.endsWith('.md')) fs.copyFileSync(path.join(commandsSrc, f), path.join(commandsDest, f));
      });
    }
  }

  // Skills
  const skillsSrc = path.join(REPO_ROOT, 'skills');
  if (fs.existsSync(skillsSrc)) {
    const skillsDest = path.join(claudeBase, 'skills');
    console.log('Installing skills -> ' + skillsDest + '/');
    if (path.resolve(skillsSrc) !== path.resolve(skillsDest)) {
      copyRecursiveSync(skillsSrc, skillsDest);
    }
  }

  // Hooks: merge into settings.json
  const hooksJsonSrc = path.join(REPO_ROOT, 'hooks', 'hooks.json');
  if (fs.existsSync(hooksJsonSrc)) {
    const settingsPath = path.join(claudeBase, 'settings.json');
    let hooksData = JSON.parse(fs.readFileSync(hooksJsonSrc, 'utf8'));
    const absoluteBase = claudeBase.replace(/\\/g, '/');
    const hooksStr = JSON.stringify(hooksData);
    const replaced = hooksStr.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, absoluteBase);
    const hooksBlock = JSON.parse(replaced).hooks;

    let settings = {};
    if (fs.existsSync(settingsPath)) {
      const backupPath = settingsPath + '.bkp';
      fs.copyFileSync(settingsPath, backupPath);
      console.log('Backed up existing settings.json -> ' + backupPath);
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    settings.hooks = hooksBlock;
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log('Installing hooks -> ' + settingsPath + ' (merged into settings.json)');
  }

  // Runtime scripts required by hooks
  const scriptsDest = path.join(claudeBase, 'scripts');
  console.log('Installing runtime scripts -> ' + scriptsDest + '/');
  copyRuntimeScripts(scriptsDest);

  if (process.platform === 'win32') {
    console.log('');
    console.log('NOTE: Windows — Hook scripts use Node.js; tmux-dependent features are skipped on Windows.');
    console.log('');
  }
  console.log('Done. Claude configs installed to ' + claudeBase + '/');
}

function installCursor(languages, globalScope) {
  const destDir = globalScope ? path.join(os.homedir(), '.cursor') : path.join(process.cwd(), '.cursor');

  if (!languages.length) usage('cursor');

  console.log('Installing Cursor configs to ' + destDir + '/');

  if (globalScope) {
    console.log('');
    console.log('NOTE: Cursor does not support file-based rules in ~/.cursor/rules.');
    console.log('      Add global rules in Settings > Cursor Settings > General > Rules for AI');
    console.log('');
  }

  // Rules (only for project install)
  const cursorRules = path.join(CURSOR_SRC, 'rules');
  if (!globalScope) {
    const rulesDest = path.join(destDir, 'rules');
    fs.mkdirSync(rulesDest, { recursive: true });
    if (fs.existsSync(cursorRules)) {
      fs.readdirSync(cursorRules).forEach(f => {
        if (f.startsWith('common-') && f.endsWith('.md')) {
          fs.copyFileSync(path.join(cursorRules, f), path.join(rulesDest, f));
        }
      });
      console.log('Installing common rules -> ' + rulesDest + '/');
    }
    for (const lang of languages) {
      if (!/^[a-zA-Z0-9_-]+$/.test(lang)) continue;
      if (fs.existsSync(cursorRules)) {
        let found = false;
        fs.readdirSync(cursorRules).forEach(f => {
          if (f.startsWith(lang + '-') && f.endsWith('.md')) {
            fs.copyFileSync(path.join(cursorRules, f), path.join(rulesDest, f));
            found = true;
          }
        });
        if (found) console.log('Installing ' + lang + ' rules -> ' + rulesDest + '/');
        else console.error("Warning: no Cursor rules for '" + lang + "' found, skipping.");
      }
    }
  } else {
    console.log('Skipping rules (not supported globally by Cursor).');
  }

  // Agents (from repo agents/)
  const agentsSrc = path.join(REPO_ROOT, 'agents');
  if (fs.existsSync(agentsSrc)) {
    const agentsDest = path.join(destDir, 'agents');
    console.log('Installing agents -> ' + agentsDest + '/');
    fs.mkdirSync(agentsDest, { recursive: true });
    fs.readdirSync(agentsSrc).forEach(f => {
      if (f.endsWith('.md')) fs.copyFileSync(path.join(agentsSrc, f), path.join(agentsDest, f));
    });
  }

  // Skills
  const skillsSrc = path.join(REPO_ROOT, 'skills');
  if (fs.existsSync(skillsSrc)) {
    const skillsDest = path.join(destDir, 'skills');
    console.log('Installing skills -> ' + skillsDest + '/');
    copyRecursiveSync(skillsSrc, skillsDest);
  }

  // Commands (from .cursor/commands)
  const commandsSrc = path.join(CURSOR_SRC, 'commands');
  if (fs.existsSync(commandsSrc)) {
    const commandsDest = path.join(destDir, 'commands');
    console.log('Installing commands -> ' + commandsDest + '/');
    copyRecursiveSync(commandsSrc, commandsDest);
  }

  // Hooks config
  const hooksJsonSrc = path.join(CURSOR_SRC, 'hooks.json');
  if (fs.existsSync(hooksJsonSrc)) {
    const hooksDestPath = path.join(destDir, 'hooks.json');
    let content = fs.readFileSync(hooksJsonSrc, 'utf8');
    if (globalScope) {
      const absoluteHooksDir = path.join(destDir, 'hooks').replace(/\\/g, '/');
      content = content.replace(/node \.cursor\/hooks\//g, 'node ' + absoluteHooksDir + '/');
    }
    let hooksParsed = JSON.parse(content);
    if (hooksParsed.version === null || hooksParsed.version === undefined) hooksParsed.version = 1;
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(hooksDestPath, JSON.stringify(hooksParsed, null, 2), 'utf8');
    console.log('Installing hooks config -> ' + hooksDestPath);
  }

  // Hook scripts
  const hooksSrc = path.join(CURSOR_SRC, 'hooks');
  if (fs.existsSync(hooksSrc)) {
    const hooksDest = path.join(destDir, 'hooks');
    console.log('Installing hook scripts -> ' + hooksDest + '/');
    copyRecursiveSync(hooksSrc, hooksDest);
  }

  // Runtime scripts required by delegated hooks
  const scriptsDest = path.join(destDir, 'scripts');
  console.log('Installing runtime scripts -> ' + scriptsDest + '/');
  copyRuntimeScripts(scriptsDest);

  // MCP
  const mcpSrc = path.join(CURSOR_SRC, 'mcp.json');
  if (fs.existsSync(mcpSrc)) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(mcpSrc, path.join(destDir, 'mcp.json'));
    console.log('Installing MCP config -> ' + path.join(destDir, 'mcp.json'));
  }

  if (process.platform === 'win32') {
    console.log('');
    console.log('NOTE: Windows — Cursor hooks use Node.js; tmux features are skipped on Windows.');
    console.log('');
  }
  console.log('Done. Cursor configs installed to ' + destDir + '/');
}

function installCodex() {
  if (!fs.existsSync(CODEX_SRC)) {
    console.error('Error: .codex/ source directory not found at ' + CODEX_SRC);
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

function installGemini(languages, globalScope) {
  console.log('Installing Gemini CLI / Antigravity configs...');

  const destDirAgent = globalScope ? path.join(os.homedir(), '.gemini/antigravity/.agents') : path.join(process.cwd(), '.agent');
  const destDirGemini = globalScope ? path.join(os.homedir(), '.gemini') : path.join(process.cwd(), '.gemini');

  // Rules
  const cursorRules = path.join(CURSOR_SRC, 'rules');
  if (languages.length > 0 && fs.existsSync(cursorRules)) {
    if (globalScope) {
      const geminiMdPath = path.join(destDirGemini, 'GEMINI.md');
      fs.mkdirSync(destDirGemini, { recursive: true });
      let rulesCombined = '';
      fs.readdirSync(cursorRules).forEach(f => {
        if (f.startsWith('common-') && f.endsWith('.md')) {
          rulesCombined += '\\n\\n' + fs.readFileSync(path.join(cursorRules, f), 'utf8');
        }
      });
      for (const lang of languages) {
        if (!/^[a-zA-Z0-9_-]+$/.test(lang)) continue;
        fs.readdirSync(cursorRules).forEach(f => {
          if (f.startsWith(lang + '-') && f.endsWith('.md')) {
            rulesCombined += '\\n\\n' + fs.readFileSync(path.join(cursorRules, f), 'utf8');
          }
        });
      }
      if (rulesCombined.trim()) {
        let existing = fs.existsSync(geminiMdPath) ? fs.readFileSync(geminiMdPath, 'utf8') : '';
        fs.writeFileSync(geminiMdPath, existing + '\\n' + rulesCombined.trim() + '\\n', 'utf8');
        console.log('Appended rules for ' + languages.join(', ') + ' to ' + geminiMdPath);
      }
    } else {
      const rulesDest = path.join(destDirAgent, 'rules');
      fs.mkdirSync(rulesDest, { recursive: true });
      let foundRules = false;
      fs.readdirSync(cursorRules).forEach(f => {
        if (f.startsWith('common-') && f.endsWith('.md')) {
          fs.copyFileSync(path.join(cursorRules, f), path.join(rulesDest, f));
          foundRules = true;
        }
      });
      for (const lang of languages) {
        if (!/^[a-zA-Z0-9_-]+$/.test(lang)) continue;
        fs.readdirSync(cursorRules).forEach(f => {
          if (f.startsWith(lang + '-') && f.endsWith('.md')) {
            fs.copyFileSync(path.join(cursorRules, f), path.join(rulesDest, f));
            foundRules = true;
          }
        });
      }
      if (foundRules) {
        console.log('Installing base & ' + languages.join(', ') + ' rules -> ' + rulesDest + '/');
      }
    }
  } else if (!languages.length) {
    console.log('No languages provided, skipping rules...');
  }

  // Skills
  const skillsSrc = path.join(REPO_ROOT, 'skills');
  if (fs.existsSync(skillsSrc)) {
    const skillsDest = path.join(destDirAgent, 'skills');
    console.log('Installing skills -> ' + skillsDest + '/');
    copyRecursiveSync(skillsSrc, skillsDest);
  }

  // Workflows (Agents)
  const agentsSrc = path.join(REPO_ROOT, 'agents');
  if (fs.existsSync(agentsSrc)) {
    const workflowsDest = path.join(destDirAgent, 'workflows');
    console.log('Installing agents as workflows -> ' + workflowsDest + '/');
    fs.mkdirSync(workflowsDest, { recursive: true });
    fs.readdirSync(agentsSrc).forEach(f => {
      if (f.endsWith('.md')) fs.copyFileSync(path.join(agentsSrc, f), path.join(workflowsDest, f));
    });
  }

  // Commands
  const commandsSrc = path.join(REPO_ROOT, 'commands');
  if (fs.existsSync(commandsSrc)) {
    const commandsDest = path.join(destDirGemini, 'commands');
    console.log('Installing commands -> ' + commandsDest + '/');
    convertCommandsToToml(commandsSrc, commandsDest);
  }

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
  if (globalScope && target !== 'cursor' && target !== 'gemini') {
    console.error("Warning: --global is only supported for cursor and gemini target. Ignored.");
  }

  if (target === 'claude') installClaude(languages);
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

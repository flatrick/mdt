#!/usr/bin/env node
/**
 * Validate install package manifests and their referenced assets.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '../..');
const DEFAULT_PACKAGES_DIR = path.join(REPO_ROOT, 'packages');
const DEFAULT_RULES_DIR = path.join(REPO_ROOT, 'rules');
const DEFAULT_AGENTS_DIR = path.join(REPO_ROOT, 'agents');
const DEFAULT_COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const DEFAULT_SKILLS_DIR = path.join(REPO_ROOT, 'skills');
const DEFAULT_CURSOR_RULES_DIR = path.join(REPO_ROOT, 'cursor-template', 'rules');
const DEFAULT_CURSOR_SKILLS_DIR = path.join(REPO_ROOT, 'cursor-template', 'skills');
const DEFAULT_CURSOR_COMMANDS_DIR = path.join(REPO_ROOT, 'cursor-template', 'commands');
const DEFAULT_CODEX_RULES_DIR = path.join(REPO_ROOT, 'codex-template', 'rules');
const DEFAULT_CODEX_SKILLS_DIR = path.join(REPO_ROOT, 'codex-template', 'skills');
const REQUIRED_PACKAGES = new Set(['typescript', 'sql', 'dotnet', 'rust', 'python', 'bash', 'powershell']);
const PACKAGE_KINDS = new Set(['language', 'scaffolding', 'capability']);
const PACKAGE_TARGETS = new Set(['claude', 'cursor', 'gemini', 'codex']);

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.trim().length > 0);
}

function validateRequires(packageName, requires, io) {
  let hasErrors = false;

  if (requires === undefined) {
    return hasErrors;
  }

  if (!requires || typeof requires !== 'object' || Array.isArray(requires)) {
    io.error(`ERROR: ${packageName}/package.json - requires must be an object when provided`);
    return true;
  }

  const allowedKeys = new Set(['hooks', 'runtimeScripts', 'sessionData', 'tools']);
  for (const key of Object.keys(requires)) {
    if (!allowedKeys.has(key)) {
      io.error(`ERROR: ${packageName}/package.json - requires contains unsupported key: ${key}`);
      hasErrors = true;
    }
  }

  for (const key of ['hooks', 'runtimeScripts', 'sessionData']) {
    if (requires[key] !== undefined && typeof requires[key] !== 'boolean') {
      io.error(`ERROR: ${packageName}/package.json - requires.${key} must be a boolean when provided`);
      hasErrors = true;
    }
  }

  const declaresCapabilityFlags = ['hooks', 'runtimeScripts', 'sessionData'].some((key) => requires[key] === true);

  if (requires.tools !== undefined) {
    if (!isStringArray(requires.tools)) {
      io.error(`ERROR: ${packageName}/package.json - requires.tools must be an array of non-empty strings when provided`);
      hasErrors = true;
    } else {
      for (const toolName of requires.tools) {
        if (!PACKAGE_TARGETS.has(toolName)) {
          io.error(`ERROR: ${packageName}/package.json - requires.tools contains unsupported target: ${toolName}`);
          hasErrors = true;
        }
      }
    }
  } else if (declaresCapabilityFlags) {
    io.error(`ERROR: ${packageName}/package.json - requires.tools must be provided when capability flags are set`);
    hasErrors = true;
  }

  return hasErrors;
}

function validateExtendsGraph(manifestsByName, io) {
  let hasErrors = false;
  const visiting = new Set();
  const visited = new Set();

  function visit(packageName, trail = []) {
    if (visited.has(packageName)) {
      return;
    }
    if (visiting.has(packageName)) {
      io.error(`ERROR: package extends cycle detected: ${[...trail, packageName].join(' -> ')}`);
      hasErrors = true;
      return;
    }

    const manifest = manifestsByName.get(packageName);
    if (!manifest) {
      return;
    }

    visiting.add(packageName);
    const nextTrail = [...trail, packageName];
    const extendedPackages = Array.isArray(manifest.extends) ? manifest.extends : [];
    for (const extendedName of extendedPackages) {
      if (!manifestsByName.has(extendedName)) {
        io.error(`ERROR: ${packageName}/package.json - extends references missing package: ${extendedName}`);
        hasErrors = true;
        continue;
      }
      visit(extendedName, nextTrail);
    }
    visiting.delete(packageName);
    visited.add(packageName);
  }

  for (const packageName of manifestsByName.keys()) {
    visit(packageName);
  }

  return hasErrors;
}

function validateInstallPackages(options = {}) {
  const packagesDir = options.packagesDir || DEFAULT_PACKAGES_DIR;
  const rulesDir = options.rulesDir || DEFAULT_RULES_DIR;
  const agentsDir = options.agentsDir || DEFAULT_AGENTS_DIR;
  const commandsDir = options.commandsDir || DEFAULT_COMMANDS_DIR;
  const skillsDir = options.skillsDir || DEFAULT_SKILLS_DIR;
  const cursorRulesDir = options.cursorRulesDir || DEFAULT_CURSOR_RULES_DIR;
  const cursorSkillsDir = options.cursorSkillsDir || DEFAULT_CURSOR_SKILLS_DIR;
  const cursorCommandsDir = options.cursorCommandsDir || DEFAULT_CURSOR_COMMANDS_DIR;
  const codexRulesDir = options.codexRulesDir || DEFAULT_CODEX_RULES_DIR;
  const codexSkillsDir = options.codexSkillsDir || DEFAULT_CODEX_SKILLS_DIR;
  const io = options.io || { log: console.log, error: console.error };

  if (!fs.existsSync(packagesDir)) {
    io.error(`ERROR: Missing packages directory: ${packagesDir}`);
    return { exitCode: 1, hasErrors: true, validCount: 0 };
  }

  const entries = fs.readdirSync(packagesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const packageNames = entries.map((entry) => entry.name).sort();
  const manifestsByName = new Map();
  let hasErrors = false;
  let validCount = 0;

  for (const requiredName of REQUIRED_PACKAGES) {
    if (!packageNames.includes(requiredName)) {
      io.error(`ERROR: Missing required package manifest directory: ${requiredName}`);
      hasErrors = true;
    }
  }

  for (const packageName of packageNames) {
    const manifestPath = path.join(packagesDir, packageName, 'package.json');
    if (!fs.existsSync(manifestPath)) {
      io.error(`ERROR: ${packageName}/ - Missing package.json`);
      hasErrors = true;
      continue;
    }

    let manifest;
    try {
      manifest = readJsonFile(manifestPath);
    } catch (error) {
      io.error(`ERROR: ${packageName}/package.json - Invalid JSON: ${error.message}`);
      hasErrors = true;
      continue;
    }

    if (!manifest || typeof manifest !== 'object') {
      io.error(`ERROR: ${packageName}/package.json - Manifest must be an object`);
      hasErrors = true;
      continue;
    }

    manifestsByName.set(packageName, manifest);

    if (manifest.name !== packageName) {
      io.error(`ERROR: ${packageName}/package.json - name must equal directory name '${packageName}'`);
      hasErrors = true;
    }

    if (typeof manifest.description !== 'string' || !manifest.description.trim()) {
      io.error(`ERROR: ${packageName}/package.json - Missing non-empty description`);
      hasErrors = true;
    }

    if (manifest.kind !== undefined && !PACKAGE_KINDS.has(manifest.kind)) {
      io.error(`ERROR: ${packageName}/package.json - kind must be one of: ${[...PACKAGE_KINDS].join(', ')}`);
      hasErrors = true;
    }

    if (typeof manifest.ruleDirectory !== 'string' || !manifest.ruleDirectory.trim()) {
      io.error(`ERROR: ${packageName}/package.json - Missing non-empty ruleDirectory`);
      hasErrors = true;
    } else if (!fs.existsSync(path.join(rulesDir, manifest.ruleDirectory))) {
      io.error(`ERROR: ${packageName}/package.json - ruleDirectory '${manifest.ruleDirectory}' does not exist under rules/`);
      hasErrors = true;
    }

    if (manifest.extends !== undefined && !isStringArray(manifest.extends)) {
      io.error(`ERROR: ${packageName}/package.json - extends must be an array of non-empty strings when provided`);
      hasErrors = true;
    }

    if (validateRequires(packageName, manifest.requires, io)) {
      hasErrors = true;
    }

    if (!isStringArray(manifest.rules)) {
      io.error(`ERROR: ${packageName}/package.json - rules must be an array of non-empty strings`);
      hasErrors = true;
    } else {
      for (const rulePath of manifest.rules) {
        const normalizedRulePath = rulePath.replace(/\\/g, '/');
        if (normalizedRulePath.startsWith('/') || normalizedRulePath.includes('..')) {
          io.error(`ERROR: ${packageName}/package.json - invalid shared rule reference: ${rulePath}`);
          hasErrors = true;
          continue;
        }

        const ruleSegments = normalizedRulePath.split('/');
        if (!fs.existsSync(path.join(rulesDir, ...ruleSegments))) {
          io.error(`ERROR: ${packageName}/package.json - missing shared rule reference: ${rulePath}`);
          hasErrors = true;
        }
      }
    }

    if (!isStringArray(manifest.agents)) {
      io.error(`ERROR: ${packageName}/package.json - agents must be an array of non-empty strings`);
      hasErrors = true;
    } else {
      for (const agentFile of manifest.agents) {
        if (!fs.existsSync(path.join(agentsDir, agentFile))) {
          io.error(`ERROR: ${packageName}/package.json - missing agent reference: ${agentFile}`);
          hasErrors = true;
        }
      }
    }

    if (!isStringArray(manifest.commands)) {
      io.error(`ERROR: ${packageName}/package.json - commands must be an array of non-empty strings`);
      hasErrors = true;
    } else {
      for (const commandFile of manifest.commands) {
        if (!fs.existsSync(path.join(commandsDir, commandFile))) {
          io.error(`ERROR: ${packageName}/package.json - missing command reference: ${commandFile}`);
          hasErrors = true;
        }
      }
    }

    if (!isStringArray(manifest.skills)) {
      io.error(`ERROR: ${packageName}/package.json - skills must be an array of non-empty strings`);
      hasErrors = true;
    } else {
      for (const skillName of manifest.skills) {
        if (!fs.existsSync(path.join(skillsDir, skillName))) {
          io.error(`ERROR: ${packageName}/package.json - missing shared skill reference: ${skillName}`);
          hasErrors = true;
        }
      }
    }

    const tools = manifest.tools;
    if (!tools || typeof tools !== 'object' || Array.isArray(tools)) {
      io.error(`ERROR: ${packageName}/package.json - tools must be an object`);
      hasErrors = true;
      continue;
    }

    const cursor = tools.cursor;
    if (cursor !== undefined) {
      if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) {
        io.error(`ERROR: ${packageName}/package.json - tools.cursor must be an object when provided`);
        hasErrors = true;
      } else {
        if (!isStringArray(cursor.rules)) {
          io.error(`ERROR: ${packageName}/package.json - tools.cursor.rules must be an array of non-empty strings`);
          hasErrors = true;
        } else {
          for (const ruleFile of cursor.rules) {
            if (!fs.existsSync(path.join(cursorRulesDir, ruleFile))) {
              io.error(`ERROR: ${packageName}/package.json - missing Cursor rule reference: ${ruleFile}`);
              hasErrors = true;
            }
          }
        }

        if (!isStringArray(cursor.skills)) {
          io.error(`ERROR: ${packageName}/package.json - tools.cursor.skills must be an array of non-empty strings`);
          hasErrors = true;
        } else {
          for (const skillName of cursor.skills) {
            if (!fs.existsSync(path.join(cursorSkillsDir, skillName)) && !fs.existsSync(path.join(skillsDir, skillName))) {
              io.error(`ERROR: ${packageName}/package.json - missing Cursor skill reference: ${skillName}`);
              hasErrors = true;
            }
          }
        }

        if (cursor.commands !== undefined) {
          if (!isStringArray(cursor.commands)) {
            io.error(`ERROR: ${packageName}/package.json - tools.cursor.commands must be an array of non-empty strings when provided`);
            hasErrors = true;
          } else {
            for (const commandFile of cursor.commands) {
              if (!fs.existsSync(path.join(cursorCommandsDir, commandFile))) {
                io.error(`ERROR: ${packageName}/package.json - missing Cursor command reference: ${commandFile}`);
                hasErrors = true;
              }
            }
          }
        }
      }
    }

    const claude = tools.claude;
    if (claude !== undefined) {
      if (!claude || typeof claude !== 'object' || Array.isArray(claude)) {
        io.error(`ERROR: ${packageName}/package.json - tools.claude must be an object when provided`);
        hasErrors = true;
      } else if (claude.skills !== undefined) {
        if (!isStringArray(claude.skills)) {
          io.error(`ERROR: ${packageName}/package.json - tools.claude.skills must be an array of non-empty strings when provided`);
          hasErrors = true;
        } else {
          for (const skillName of claude.skills) {
            if (!fs.existsSync(path.join(skillsDir, skillName))) {
              io.error(`ERROR: ${packageName}/package.json - missing Claude skill reference: ${skillName}`);
              hasErrors = true;
            }
          }
        }
      }
    }

    const gemini = tools.gemini;
    if (gemini !== undefined) {
      if (!gemini || typeof gemini !== 'object' || Array.isArray(gemini)) {
        io.error(`ERROR: ${packageName}/package.json - tools.gemini must be an object when provided`);
        hasErrors = true;
      } else if (!isStringArray(gemini.rules)) {
        io.error(`ERROR: ${packageName}/package.json - tools.gemini.rules must be an array of non-empty strings`);
        hasErrors = true;
      } else {
        for (const ruleFile of gemini.rules) {
          if (!fs.existsSync(path.join(cursorRulesDir, ruleFile))) {
            io.error(`ERROR: ${packageName}/package.json - missing Gemini rule reference: ${ruleFile}`);
            hasErrors = true;
          }
        }
      }
    }

    const codex = tools.codex;
    if (codex !== undefined) {
      if (!codex || typeof codex !== 'object' || Array.isArray(codex)) {
        io.error(`ERROR: ${packageName}/package.json - tools.codex must be an object when provided`);
        hasErrors = true;
      } else {
        if (codex.rules !== undefined) {
          if (!isStringArray(codex.rules)) {
            io.error(`ERROR: ${packageName}/package.json - tools.codex.rules must be an array of non-empty strings when provided`);
            hasErrors = true;
          } else {
            for (const ruleFile of codex.rules) {
              if (!fs.existsSync(path.join(codexRulesDir, ruleFile))) {
                io.error(`ERROR: ${packageName}/package.json - missing Codex rule reference: ${ruleFile}`);
                hasErrors = true;
              }
            }
          }
        }

        if (codex.skills !== undefined) {
          if (!isStringArray(codex.skills)) {
            io.error(`ERROR: ${packageName}/package.json - tools.codex.skills must be an array of non-empty strings when provided`);
            hasErrors = true;
          } else {
            for (const skillName of codex.skills) {
              if (!fs.existsSync(path.join(codexSkillsDir, skillName))) {
                io.error(`ERROR: ${packageName}/package.json - missing Codex skill reference: ${skillName}`);
                hasErrors = true;
              }
            }
          }
        }
      }
    }

    validCount++;
  }

  if (validateExtendsGraph(manifestsByName, io)) {
    hasErrors = true;
  }

  if (hasErrors) {
    return { exitCode: 1, hasErrors: true, validCount };
  }

  io.log(`Validated ${validCount} install package manifests`);
  return { exitCode: 0, hasErrors: false, validCount };
}

if (require.main === module) {
  const result = validateInstallPackages();
  process.exit(result.exitCode);
}

module.exports = {
  REQUIRED_PACKAGES,
  validateInstallPackages
};

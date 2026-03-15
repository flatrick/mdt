#!/usr/bin/env node
/**
 * Validate install package manifests and their referenced assets.
 *
 * Scope: structural integrity of packages/<name>/package.json files —
 * required fields, asset references, extends graph, and requires schema.
 *
 * Related validators (complementary, not overlapping):
 *   validate-dependency-sidecars.js — validates deps.json sidecar format
 *   validate-resolver-closure.js    — validates install-resolver closure stability
 *
 * The resolver (scripts/lib/install-resolver.js) still reads package.json
 * requires at install time. Both layers must pass for a clean install.
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
const DEFAULT_CODEX_RULES_DIR = path.join(REPO_ROOT, 'codex-template', 'rules');
const DEFAULT_CODEX_SKILLS_DIR = path.join(REPO_ROOT, 'codex-template', 'skills');
const REQUIRED_PACKAGES = new Set(['typescript', 'sql', 'dotnet', 'rust', 'python', 'bash', 'powershell']);
const PACKAGE_KINDS = new Set(['language', 'scaffolding', 'capability']);
const PACKAGE_TARGETS = new Set(['claude', 'cursor', 'codex']);
const REQUIRE_KEYS = ['hooks', 'runtimeScripts', 'sessionData'];

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.trim().length > 0);
}

function validateSkillMetadata(skillDir, packageName, label, io) {
  const metaPath = path.join(skillDir, 'skill.meta.json');
  if (!fs.existsSync(metaPath)) {
    io.error(`ERROR: ${packageName}/package.json - ${label} is missing skill.meta.json`);
    return true;
  }
  return false;
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

  hasErrors = validateRequireKeys(packageName, requires, io) || hasErrors;
  hasErrors = validateRequireFlags(packageName, requires, io) || hasErrors;
  const declaresCapabilityFlags = REQUIRE_KEYS.some((key) => requires[key] === true);
  if (requires.tools !== undefined) {
    hasErrors = validateRequireTools(packageName, requires.tools, io) || hasErrors;
  } else if (declaresCapabilityFlags) {
    io.error(`ERROR: ${packageName}/package.json - requires.tools must be provided when capability flags are set`);
    hasErrors = true;
  }

  return hasErrors;
}

function validateRequireKeys(packageName, requires, io) {
  const allowedKeys = new Set([...REQUIRE_KEYS, 'tools']);
  let hasErrors = false;

  for (const key of Object.keys(requires)) {
    if (!allowedKeys.has(key)) {
      io.error(`ERROR: ${packageName}/package.json - requires contains unsupported key: ${key}`);
      hasErrors = true;
    }
  }

  return hasErrors;
}

function validateRequireFlags(packageName, requires, io) {
  let hasErrors = false;

  for (const key of REQUIRE_KEYS) {
    if (requires[key] !== undefined && typeof requires[key] !== 'boolean') {
      io.error(`ERROR: ${packageName}/package.json - requires.${key} must be a boolean when provided`);
      hasErrors = true;
    }
  }

  return hasErrors;
}

function validateRequireTools(packageName, tools, io) {
  let hasErrors = false;
  if (!isStringArray(tools)) {
    io.error(`ERROR: ${packageName}/package.json - requires.tools must be an array of non-empty strings when provided`);
    return true;
  }

  for (const toolName of tools) {
    if (!PACKAGE_TARGETS.has(toolName)) {
      io.error(`ERROR: ${packageName}/package.json - requires.tools contains unsupported target: ${toolName}`);
      hasErrors = true;
    }
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

function getValidationDefaults() {
  return {
    packagesDir: DEFAULT_PACKAGES_DIR,
    rulesDir: DEFAULT_RULES_DIR,
    agentsDir: DEFAULT_AGENTS_DIR,
    commandsDir: DEFAULT_COMMANDS_DIR,
    skillsDir: DEFAULT_SKILLS_DIR,
    cursorRulesDir: DEFAULT_CURSOR_RULES_DIR,
    cursorSkillsDir: DEFAULT_CURSOR_SKILLS_DIR,
    codexRulesDir: DEFAULT_CODEX_RULES_DIR,
    codexSkillsDir: DEFAULT_CODEX_SKILLS_DIR
  };
}

function createValidationContext(options = {}) {
  const context = { ...getValidationDefaults() };
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && key !== 'io') {
      context[key] = value;
    }
  }
  context.io = options.io || { log: console.log, error: console.error };
  return context;
}

function validateRequiredPackages(packageNames, io) {
  let hasErrors = false;
  for (const requiredName of REQUIRED_PACKAGES) {
    if (!packageNames.includes(requiredName)) {
      io.error(`ERROR: Missing required package manifest directory: ${requiredName}`);
      hasErrors = true;
    }
  }
  return hasErrors;
}

function loadManifestFromDisk(packagesDir, packageName, io) {
  const manifestPath = path.join(packagesDir, packageName, 'package.json');
  if (!fs.existsSync(manifestPath)) {
    io.error(`ERROR: ${packageName}/ - Missing package.json`);
    return null;
  }

  try {
    const manifest = readJsonFile(manifestPath);
    if (!manifest || typeof manifest !== 'object') {
      io.error(`ERROR: ${packageName}/package.json - Manifest must be an object`);
      return null;
    }
    return manifest;
  } catch (error) {
    io.error(`ERROR: ${packageName}/package.json - Invalid JSON: ${error.message}`);
    return null;
  }
}

function validateManifestBasics(packageName, manifest, context) {
  const { io, rulesDir } = context;
  let hasErrors = false;

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

  return hasErrors;
}

function validateSharedFileList(packageName, manifest, fieldName, baseDir, label, io) {
  let hasErrors = false;
  const values = manifest[fieldName];
  if (!isStringArray(values)) {
    io.error(`ERROR: ${packageName}/package.json - ${fieldName} must be an array of non-empty strings`);
    return true;
  }

  for (const fileName of values) {
    if (!fs.existsSync(path.join(baseDir, fileName))) {
      io.error(`ERROR: ${packageName}/package.json - missing ${label} reference: ${fileName}`);
      hasErrors = true;
    }
  }

  return hasErrors;
}

function validateSharedRules(packageName, manifest, rulesDir, io) {
  let hasErrors = false;
  if (!isStringArray(manifest.rules)) {
    io.error(`ERROR: ${packageName}/package.json - rules must be an array of non-empty strings`);
    return true;
  }

  for (const rulePath of manifest.rules) {
    const normalizedRulePath = rulePath.replace(/\\/g, '/');
    if (normalizedRulePath.startsWith('/') || normalizedRulePath.includes('..')) {
      io.error(`ERROR: ${packageName}/package.json - invalid shared rule reference: ${rulePath}`);
      hasErrors = true;
      continue;
    }

    if (!fs.existsSync(path.join(rulesDir, ...normalizedRulePath.split('/')))) {
      io.error(`ERROR: ${packageName}/package.json - missing shared rule reference: ${rulePath}`);
      hasErrors = true;
    }
  }

  return hasErrors;
}

function validateSharedSkills(packageName, manifest, skillsDir, io) {
  let hasErrors = false;
  if (!isStringArray(manifest.skills)) {
    io.error(`ERROR: ${packageName}/package.json - skills must be an array of non-empty strings`);
    return true;
  }

  for (const skillName of manifest.skills) {
    const skillDir = path.join(skillsDir, skillName);
    if (!fs.existsSync(skillDir)) {
      io.error(`ERROR: ${packageName}/package.json - missing shared skill reference: ${skillName}`);
      hasErrors = true;
      continue;
    }
    hasErrors = validateSkillMetadata(skillDir, packageName, `shared skill '${skillName}'`, io) || hasErrors;
  }

  return hasErrors;
}

function validateToolObject(packageName, tools, io) {
  if (!tools || typeof tools !== 'object' || Array.isArray(tools)) {
    io.error(`ERROR: ${packageName}/package.json - tools must be an object`);
    return true;
  }
  return false;
}

function validateToolSkillSet(packageName, skillNames, primaryDir, fallbackDir, label, io) {
  let hasErrors = false;
  if (!isStringArray(skillNames)) {
    io.error(`ERROR: ${packageName}/package.json - ${label} must be an array of non-empty strings when provided`);
    return true;
  }

  for (const skillName of skillNames) {
    const primarySkillDir = path.join(primaryDir, skillName);
    const fallbackSkillDir = fallbackDir ? path.join(fallbackDir, skillName) : null;
    const resolvedSkillDir = fs.existsSync(primarySkillDir)
      ? primarySkillDir
      : (fallbackSkillDir && fs.existsSync(fallbackSkillDir) ? fallbackSkillDir : null);

    if (!resolvedSkillDir) {
      io.error(`ERROR: ${packageName}/package.json - missing ${label.replace(/^tools\.[^.]+\./, '').replace(/ when provided$/, '')} reference: ${skillName}`);
      hasErrors = true;
      continue;
    }

    hasErrors = validateSkillMetadata(resolvedSkillDir, packageName, `${label.split(' ')[0]} '${skillName}'`, io) || hasErrors;
  }

  return hasErrors;
}

function normalizeReferenceLabel(label) {
  const explicitLabels = {
    'tools.cursor.rules': 'Cursor rule',
    'tools.codex.rules': 'Codex rule',
    'tools.codex.scripts': 'Codex script'
  };

  if (explicitLabels[label]) {
    return explicitLabels[label];
  }

  return label
    .replace(/^tools\.[^.]+\./, '')
    .replace(/ when provided$/, '')
    .replace(/s$/, '');
}

function validateOptionalStringArray(packageName, values, label, baseDir, io) {
  let hasErrors = false;
  if (values === undefined) {
    return false;
  }
  if (!isStringArray(values)) {
    io.error(`ERROR: ${packageName}/package.json - ${label} must be an array of non-empty strings when provided`);
    return true;
  }

  for (const value of values) {
    if (!fs.existsSync(path.join(baseDir, value))) {
      io.error(`ERROR: ${packageName}/package.json - missing ${normalizeReferenceLabel(label)} reference: ${value}`);
      hasErrors = true;
    }
  }

  return hasErrors;
}

function validateCursorTools(packageName, cursor, context) {
  const { io, cursorRulesDir, cursorSkillsDir, skillsDir } = context;
  let hasErrors = false;
  if (cursor === undefined) {
    return false;
  }
  if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) {
    io.error(`ERROR: ${packageName}/package.json - tools.cursor must be an object when provided`);
    return true;
  }

  hasErrors = validateOptionalStringArray(packageName, cursor.rules, 'tools.cursor.rules', cursorRulesDir, io) || hasErrors;
  hasErrors = validateToolSkillSet(packageName, cursor.skills, cursorSkillsDir, skillsDir, 'Cursor skill', io) || hasErrors;
  return hasErrors;
}

function validateClaudeTools(packageName, claude, context) {
  const { io, skillsDir } = context;
  if (claude === undefined) {
    return false;
  }
  if (!claude || typeof claude !== 'object' || Array.isArray(claude)) {
    io.error(`ERROR: ${packageName}/package.json - tools.claude must be an object when provided`);
    return true;
  }
  if (claude.skills === undefined) {
    return false;
  }
  return validateToolSkillSet(packageName, claude.skills, skillsDir, null, 'Claude skill', io);
}

function validateCodexTools(packageName, codex, context) {
  const { io, codexRulesDir, codexSkillsDir, skillsDir } = context;
  let hasErrors = false;
  if (codex === undefined) {
    return false;
  }
  if (!codex || typeof codex !== 'object' || Array.isArray(codex)) {
    io.error(`ERROR: ${packageName}/package.json - tools.codex must be an object when provided`);
    return true;
  }

  hasErrors = validateOptionalStringArray(packageName, codex.rules, 'tools.codex.rules', codexRulesDir, io) || hasErrors;
  if (codex.skills !== undefined) {
    hasErrors = validateToolSkillSet(packageName, codex.skills, codexSkillsDir, skillsDir, 'Codex skill', io) || hasErrors;
  }
  if (codex.scripts !== undefined) {
    hasErrors = validateOptionalStringArray(packageName, codex.scripts, 'tools.codex.scripts', path.join(REPO_ROOT, 'scripts'), io) || hasErrors;
  }

  return hasErrors;
}

function validatePackageManifest(packageName, manifest, context) {
  let hasErrors = false;
  const { io, rulesDir, agentsDir, commandsDir, skillsDir } = context;

  hasErrors = validateManifestBasics(packageName, manifest, context) || hasErrors;
  hasErrors = validateSharedRules(packageName, manifest, rulesDir, io) || hasErrors;
  hasErrors = validateSharedFileList(packageName, manifest, 'agents', agentsDir, 'agent', io) || hasErrors;
  hasErrors = validateSharedFileList(packageName, manifest, 'commands', commandsDir, 'command', io) || hasErrors;
  hasErrors = validateSharedSkills(packageName, manifest, skillsDir, io) || hasErrors;

  if (validateToolObject(packageName, manifest.tools, io)) {
    return true;
  }

  hasErrors = validateCursorTools(packageName, manifest.tools.cursor, context) || hasErrors;
  hasErrors = validateClaudeTools(packageName, manifest.tools.claude, context) || hasErrors;
  hasErrors = validateCodexTools(packageName, manifest.tools.codex, context) || hasErrors;
  return hasErrors;
}

function validateInstallPackages(options = {}) {
  const context = createValidationContext(options);
  const { packagesDir, io } = context;

  if (!fs.existsSync(packagesDir)) {
    io.error(`ERROR: Missing packages directory: ${packagesDir}`);
    return { exitCode: 1, hasErrors: true, validCount: 0 };
  }

  const entries = fs.readdirSync(packagesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const packageNames = entries.map((entry) => entry.name).sort();
  const manifestsByName = new Map();
  let hasErrors = false;
  let validCount = 0;

  hasErrors = validateRequiredPackages(packageNames, io) || hasErrors;

  for (const packageName of packageNames) {
    const manifest = loadManifestFromDisk(packagesDir, packageName, io);
    if (!manifest) {
      hasErrors = true;
      continue;
    }

    manifestsByName.set(packageName, manifest);
    hasErrors = validatePackageManifest(packageName, manifest, context) || hasErrors;
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

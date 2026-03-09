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
const DEFAULT_CURSOR_RULES_DIR = path.join(REPO_ROOT, 'cursor-template', 'rules');
const DEFAULT_CURSOR_SKILLS_DIR = path.join(REPO_ROOT, 'cursor-template', 'skills');
const REQUIRED_PACKAGES = new Set(['typescript', 'sql', 'dotnet', 'rust', 'python', 'bash', 'powershell']);

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.trim().length > 0);
}

function validateInstallPackages(options = {}) {
  const packagesDir = options.packagesDir || DEFAULT_PACKAGES_DIR;
  const rulesDir = options.rulesDir || DEFAULT_RULES_DIR;
  const cursorRulesDir = options.cursorRulesDir || DEFAULT_CURSOR_RULES_DIR;
  const cursorSkillsDir = options.cursorSkillsDir || DEFAULT_CURSOR_SKILLS_DIR;
  const io = options.io || { log: console.log, error: console.error };

  if (!fs.existsSync(packagesDir)) {
    io.error(`ERROR: Missing packages directory: ${packagesDir}`);
    return { exitCode: 1, hasErrors: true, validCount: 0 };
  }

  const entries = fs.readdirSync(packagesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const packageNames = entries.map((entry) => entry.name).sort();
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

    if (manifest.name !== packageName) {
      io.error(`ERROR: ${packageName}/package.json - name must equal directory name '${packageName}'`);
      hasErrors = true;
    }

    if (typeof manifest.ruleDirectory !== 'string' || !manifest.ruleDirectory.trim()) {
      io.error(`ERROR: ${packageName}/package.json - Missing non-empty ruleDirectory`);
      hasErrors = true;
    } else if (!fs.existsSync(path.join(rulesDir, manifest.ruleDirectory))) {
      io.error(`ERROR: ${packageName}/package.json - ruleDirectory '${manifest.ruleDirectory}' does not exist under rules/`);
      hasErrors = true;
    }

    const tools = manifest.tools;
    if (!tools || typeof tools !== 'object' || Array.isArray(tools)) {
      io.error(`ERROR: ${packageName}/package.json - tools must be an object`);
      hasErrors = true;
      continue;
    }

    const cursor = tools.cursor;
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) {
      io.error(`ERROR: ${packageName}/package.json - tools.cursor must be an object`);
      hasErrors = true;
      continue;
    }

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
        if (!fs.existsSync(path.join(cursorSkillsDir, skillName))) {
          io.error(`ERROR: ${packageName}/package.json - missing Cursor skill reference: ${skillName}`);
          hasErrors = true;
        }
      }
    }

    validCount++;
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

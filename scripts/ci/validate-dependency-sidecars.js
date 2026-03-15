#!/usr/bin/env node
/**
 * Validate dependency sidecar files (deps.json) against the v0.0.1 schema.
 * Scans known locations: packages/<name>/deps.json, skills/<name>/deps.json.
 * Exit 0 when all valid or no sidecars present; exit 1 on schema errors.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const ALLOWED_TOP_LEVEL = new Set(['version', 'requires', 'capabilities', 'tools']);
const TOOL_IDS = new Set(['claude', 'cursor', 'codex']);
const DEPENDENCY_TYPES = new Set(['rule', 'skill', 'command', 'agent']);
const CAPABILITY_TYPES = new Set(['hooks', 'runtimeScripts', 'sessionData', 'tools', 'mcp', 'memory']);

function validateEntryType(type, arrayName, index, errors) {
  if (type != null && typeof type !== 'string') {
    errors.push(`${arrayName}[${index}]: "type" must be a string`);
    return;
  }
  if (typeof type === 'string') {
    const allowedTypes = arrayName.endsWith('capabilities') ? CAPABILITY_TYPES : DEPENDENCY_TYPES;
    if (!allowedTypes.has(type)) {
      errors.push(`${arrayName}[${index}]: "type" "${type}" must be one of: ${[...allowedTypes].join(', ')}`);
    }
  }
}

function validateEntryFields(entry, arrayName, index, errors) {
  if (entry.optional != null && typeof entry.optional !== 'boolean') {
    errors.push(`${arrayName}[${index}]: "optional" must be a boolean`);
  }
  if (entry.id != null && typeof entry.id !== 'string') {
    errors.push(`${arrayName}[${index}]: "id" must be a string`);
  }
  if (entry.params != null && (typeof entry.params !== 'object' || Array.isArray(entry.params))) {
    errors.push(`${arrayName}[${index}]: "params" must be an object`);
  }
  const allowedKeys = new Set(['type', 'optional', 'id', 'params']);
  for (const k of Object.keys(entry)) {
    if (!allowedKeys.has(k)) {
      errors.push(`${arrayName}[${index}]: unknown key "${k}"`);
    }
  }
}

function validateEntry(entry, arrayName, index, errors) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    errors.push(`${arrayName}[${index}]: entry must be an object`);
    return;
  }
  if (!Object.keys(entry).includes('type')) {
    errors.push(`${arrayName}[${index}]: entry must have "type"`);
  }
  validateEntryType(entry.type, arrayName, index, errors);
  validateEntryFields(entry, arrayName, index, errors);
}

function validateEntryArray(arr, arrayName, filePath, errors) {
  if (!Array.isArray(arr)) {
    errors.push(`${filePath}: "${arrayName}" must be an array`);
    return;
  }
  arr.forEach((entry, i) => validateEntry(entry, arrayName, i, errors));
}

function validateToolOverride(toolId, override, filePath, errors) {
  const allowedOverride = new Set(['requires', 'capabilities']);
  for (const k of Object.keys(override)) {
    if (!allowedOverride.has(k)) {
      errors.push(`${filePath}: tools.${toolId}.${k} is not allowed`);
    }
  }
  if (Array.isArray(override.requires)) {
    override.requires.forEach((entry, i) => validateEntry(entry, `tools.${toolId}.requires`, i, errors));
  }
  if (Array.isArray(override.capabilities)) {
    override.capabilities.forEach((entry, i) => validateEntry(entry, `tools.${toolId}.capabilities`, i, errors));
  }
}

function validateSidecarTools(tools, filePath, errors) {
  for (const [toolId, override] of Object.entries(tools)) {
    if (!TOOL_IDS.has(toolId)) {
      errors.push(`${filePath}: tools."${toolId}" is not a valid tool id (claude, cursor, codex)`);
    }
    if (override != null && (typeof override !== 'object' || Array.isArray(override))) {
      errors.push(`${filePath}: tools.${toolId} must be an object with requires and/or capabilities`);
    } else if (override) {
      validateToolOverride(toolId, override, filePath, errors);
    }
  }
}

function validateSidecarVersion(obj, filePath, errors) {
  if (obj.version == null) {
    errors.push(`${filePath}: missing "version"`);
  } else if (typeof obj.version !== 'string') {
    errors.push(`${filePath}: "version" must be a string`);
  }
}

function validateSidecar(obj, filePath, errors) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    errors.push(`${filePath}: root must be a JSON object`);
    return;
  }
  for (const k of Object.keys(obj)) {
    if (!ALLOWED_TOP_LEVEL.has(k)) {
      errors.push(`${filePath}: unknown top-level key "${k}"`);
    }
  }
  validateSidecarVersion(obj, filePath, errors);
  if (obj.requires != null) {
    validateEntryArray(obj.requires, 'requires', filePath, errors);
  }
  if (obj.capabilities != null) {
    validateEntryArray(obj.capabilities, 'capabilities', filePath, errors);
  }
  if (obj.tools != null) {
    if (typeof obj.tools !== 'object' || Array.isArray(obj.tools)) {
      errors.push(`${filePath}: "tools" must be an object`);
    } else {
      validateSidecarTools(obj.tools, filePath, errors);
    }
  }
}

function findSidecarPaths(repoRoot) {
  const paths = [];
  const packagesDir = path.join(repoRoot, 'packages');
  const skillsDir = path.join(repoRoot, 'skills');
  const scriptsDir = path.join(repoRoot, 'scripts');
  if (fs.existsSync(packagesDir)) {
    for (const name of fs.readdirSync(packagesDir)) {
      const p = path.join(packagesDir, name, 'deps.json');
      if (fs.existsSync(p)) paths.push(p);
    }
  }
  if (fs.existsSync(skillsDir)) {
    for (const name of fs.readdirSync(skillsDir)) {
      const p = path.join(skillsDir, name, 'deps.json');
      if (fs.existsSync(p)) paths.push(p);
    }
  }
  if (fs.existsSync(scriptsDir)) {
    for (const name of fs.readdirSync(scriptsDir)) {
      if (name.endsWith('.deps.json')) {
        paths.push(path.join(scriptsDir, name));
      }
    }
  }
  return paths;
}

function validateDependencySidecars(repoRoot = REPO_ROOT, io = { log: console.log, error: console.error }) {
  const sidecarPaths = findSidecarPaths(repoRoot);
  const allErrors = [];
  for (const filePath of sidecarPaths) {
    const relativePath = path.relative(repoRoot, filePath);
    let obj;
    try {
      obj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      allErrors.push(`${relativePath}: ${err.message}`);
      continue;
    }
    validateSidecar(obj, relativePath, allErrors);
  }
  if (allErrors.length > 0) {
    for (const e of allErrors) io.error(`ERROR: ${e}`);
    return { exitCode: 1, errors: allErrors };
  }
  if (sidecarPaths.length > 0) {
    io.log(`Validated ${sidecarPaths.length} dependency sidecar(s)`);
  }
  return { exitCode: 0 };
}

function runCli(io = { log: console.log, error: console.error }) {
  return validateDependencySidecars(REPO_ROOT, io);
}

if (require.main === module) {
  const result = runCli();
  process.exit(result.exitCode);
}

module.exports = {
  validateSidecar,
  validateDependencySidecars,
  runCli,
  findSidecarPaths
};

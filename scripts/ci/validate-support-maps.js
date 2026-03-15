#!/usr/bin/env node
/**
 * Validate machine-readable tool support maps under metadata/tools/ against
 * docs/tools/capability-matrix.md. Exit 0 with a warning when metadata/tools/
 * does not exist or is empty; hard-fail when at least one support map exists
 * but any featureStatus diverges from the matrix.
 *
 * MCP exception: featureStatus.mcp may hold any status; the installer never
 * hard-fails on MCP (see docs/install-dependency-model.md). This script still
 * reports divergence for MCP so docs stay aligned.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const METADATA_TOOLS_DIR = path.join(REPO_ROOT, 'metadata', 'tools');
const CAPABILITY_MATRIX_PATH = path.join(REPO_ROOT, 'docs', 'tools', 'capability-matrix.md');

// Valid status values per the capability-matrix vocabulary
const VALID_STATUSES = new Set(['official', 'experimental', 'repo-adapter', 'unsupported', 'locally-verified', 'not-locally-verified']);

// Map capability-matrix row header (first cell) to featureStatus key
const ROW_TO_FEATURE = {
  'Rules / reusable guidance': 'rule',
  'Skills / reusable workflows': 'skill',
  'Repo-defined workflow commands': 'command',
  'Agents / subagents / delegation': 'agent',
  'Event automations / hooks': 'hooks',
  'Persistent context / memory': 'memory',
  'MCP / tool integration': 'mcp'
};

const TOOL_COLUMNS = ['claude', 'cursor', 'codex'];

function extractFirstStatus(cellText) {
  if (!cellText || typeof cellText !== 'string') return null;
  const match = cellText.match(/`([a-z-]+)`/);
  return match ? match[1] : null;
}

function parseCapabilityMatrix(content) {
  const lines = content.split(/\r?\n/);
  const result = { rule: {}, skill: {}, command: {}, agent: {}, hooks: {}, memory: {}, mcp: {} };

  for (const line of lines) {
    if (!line.startsWith('|') || line.startsWith('|---')) continue;
    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length < 4) continue;
    const featureLabel = cells[0];
    const featureKey = ROW_TO_FEATURE[featureLabel];
    if (!featureKey) continue;

    const claudeStatus = extractFirstStatus(cells[1]);
    const cursorStatus = extractFirstStatus(cells[2]);
    const codexStatus = extractFirstStatus(cells[3]);

    if (claudeStatus) result[featureKey].claude = claudeStatus;
    if (cursorStatus) result[featureKey].cursor = cursorStatus;
    if (codexStatus) result[featureKey].codex = codexStatus;
  }

  return result;
}

function readSupportMap(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function compareStatus(actual, expected) {
  if (!expected) return true;
  if (!actual) return false;
  const a = String(actual).toLowerCase().trim();
  const e = String(expected).toLowerCase().trim();
  if (a === e) return true;
  if (e === 'locally-verified' && a === 'official') return true;
  if (e === 'not-locally-verified') return true;
  return false;
}

function validateMapFeatureStatus(fileName, toolId, featureStatus, expectedByFeature, errors) {
  for (const [featureKey, expectedPerTool] of Object.entries(expectedByFeature)) {
    const expected = expectedPerTool[toolId];
    if (expected == null) continue;
    const entry = featureStatus[featureKey];
    const actual = entry && typeof entry === 'object' && entry.status != null ? String(entry.status) : null;
    if (actual !== null && !VALID_STATUSES.has(actual)) {
      errors.push(
        `metadata/tools/${fileName}: featureStatus.${featureKey}.status "${actual}" is not a valid status value.`
      );
    }
    if (!compareStatus(actual, expected)) {
      errors.push(
        `metadata/tools/${fileName}: featureStatus.${featureKey}.status is "${actual}" but capability-matrix.md has "${expected}" for ${toolId}.`
      );
    }
  }
}

function validateSupportMapFile(fileName, expectedByFeature, errors) {
  const toolId = fileName.replace(/\.json$/, '');
  if (!TOOL_COLUMNS.includes(toolId)) {
    errors.push(`Unknown tool in metadata/tools/${fileName}; expected one of: ${TOOL_COLUMNS.join(', ')}`);
    return;
  }
  const filePath = path.join(METADATA_TOOLS_DIR, fileName);
  let map;
  try {
    map = readSupportMap(filePath);
  } catch (err) {
    errors.push(`Invalid JSON in ${fileName}: ${err.message}`);
    return;
  }
  validateMapFeatureStatus(fileName, toolId, map.featureStatus || {}, expectedByFeature, errors);
}

function validateSupportMaps(io = { log: console.log, error: console.error }) {
  if (!fs.existsSync(METADATA_TOOLS_DIR)) {
    io.error('WARNING: metadata/tools/ not found; support map validation skipped.');
    return { exitCode: 0, warning: true };
  }

  const jsonFiles = fs.readdirSync(METADATA_TOOLS_DIR).filter((f) => f.endsWith('.json'));
  if (jsonFiles.length === 0) {
    io.error('WARNING: metadata/tools/ has no .json files; support map validation skipped.');
    return { exitCode: 0, warning: true };
  }

  if (!fs.existsSync(CAPABILITY_MATRIX_PATH)) {
    io.error(`ERROR: Capability matrix not found: ${CAPABILITY_MATRIX_PATH}`);
    return { exitCode: 1, errors: ['Missing capability matrix'] };
  }

  const expectedByFeature = parseCapabilityMatrix(fs.readFileSync(CAPABILITY_MATRIX_PATH, 'utf8'));
  const errors = [];
  for (const fileName of jsonFiles) {
    validateSupportMapFile(fileName, expectedByFeature, errors);
  }

  if (errors.length > 0) {
    for (const e of errors) io.error(`ERROR: ${e}`);
    return { exitCode: 1, errors };
  }

  io.log(`Validated ${jsonFiles.length} tool support map(s) against capability-matrix.md`);
  return { exitCode: 0 };
}

function runCli(io = { log: console.log, error: console.error }) {
  return validateSupportMaps(io);
}

if (require.main === module) {
  const result = runCli();
  process.exit(result.exitCode);
}

module.exports = {
  validateSupportMaps,
  runCli,
  parseCapabilityMatrix,
  METADATA_TOOLS_DIR,
  CAPABILITY_MATRIX_PATH
};

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDataDir } = require('./utils');
const { detectProjectRoot } = require('./project-root');

function getMdtDir() {
  return getDataDir();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
  } catch (err) {
    throw new Error(`Failed to write ${filePath}: ${err.message}`);
  }
}

function getBridgeDecisionsPath() {
  return path.join(getMdtDir(), 'bridge-decisions.json');
}

function loadBridgeDecisions() {
  return readJson(getBridgeDecisionsPath(), {
    version: 1,
    projects: {}
  });
}

function saveBridgeDecisions(state) {
  writeJson(getBridgeDecisionsPath(), state);
}

function detectRepoRoot(startDir = process.cwd()) {
  return detectProjectRoot(startDir, { defaultToStartDir: true });
}

function getProjectId(repoRoot) {
  return crypto.createHash('sha256').update(path.resolve(repoRoot), 'utf8').digest('hex').slice(0, 12);
}

function recordBridgeDecision({ repoRoot, surface, decision }) {
  const resolvedRepoRoot = detectRepoRoot(repoRoot);
  const projectId = getProjectId(resolvedRepoRoot);
  const state = loadBridgeDecisions();

  if (!state.projects[projectId]) {
    state.projects[projectId] = {
      root: resolvedRepoRoot,
      surfaces: {}
    };
  }

  state.projects[projectId].surfaces[surface] = {
    decision,
    updatedAt: new Date().toISOString()
  };

  saveBridgeDecisions(state);
  return { projectId, repoRoot: resolvedRepoRoot, state };
}

module.exports = {
  getMdtDir,
  getBridgeDecisionsPath,
  loadBridgeDecisions,
  saveBridgeDecisions,
  detectRepoRoot,
  getProjectId,
  recordBridgeDecision
};

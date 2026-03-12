const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getConfigDir, getDataDir } = require('./utils');

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
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
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
  let current = path.resolve(startDir);

  while (true) {
    if (
      fs.existsSync(path.join(current, '.git')) ||
      fs.existsSync(path.join(current, 'package.json')) ||
      fs.existsSync(path.join(current, 'AGENTS.md'))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }
    current = parent;
  }
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

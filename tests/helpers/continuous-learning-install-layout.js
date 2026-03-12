'use strict';

const fs = require('fs');
const path = require('path');
const { createTestDir } = require('./test-runner');

const REPO_ROOT = path.join(__dirname, '..', '..');
const REQUIRED_RUNTIME_FILES = [
  'scripts/lib/detect-env.js',
  'scripts/lib/detached-process-lifecycle.js',
  'scripts/lib/continuous-learning/runtime-context.js',
  'scripts/lib/continuous-learning/project-detection.js',
  'scripts/lib/continuous-learning/observer-runtime.js',
  'scripts/lib/continuous-learning/retrospective.js',
  'scripts/lib/continuous-learning/instinct-cli-runtime.js'
];

function copyRepoFile(relativePath, destinationPath) {
  const sourcePath = path.join(REPO_ROOT, relativePath);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

function mapInstalledPath(configDir, relativePath) {
  if (relativePath.startsWith('skills/')) {
    return path.join(configDir, relativePath);
  }
  if (relativePath.startsWith('scripts/')) {
    return path.join(configDir, 'mdt', relativePath);
  }
  throw new Error(`Unsupported installed-layout file '${relativePath}'`);
}

function createInstalledContinuousLearningLayout(options = {}) {
  const tool = options.tool || 'codex';
  const tempDir = createTestDir(options.prefix || `continuous-learning-${tool}-`);
  const configDir = path.join(tempDir, `.${tool}`);
  const files = [...new Set([...(options.files || []), ...REQUIRED_RUNTIME_FILES])];

  for (const relativePath of files) {
    copyRepoFile(relativePath, mapInstalledPath(configDir, relativePath));
  }

  return {
    tempDir,
    configDir,
    skillDir: path.join(configDir, 'skills', 'continuous-learning-manual'),
    automaticSkillDir: path.join(configDir, 'skills', 'continuous-learning-automatic'),
    mdtRoot: path.join(configDir, 'mdt')
  };
}

module.exports = {
  createInstalledContinuousLearningLayout
};

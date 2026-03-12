'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { buildTestEnv } = require('../helpers/test-env-profiles');

const repoRoot = path.join(__dirname, '..', '..');
const installerPath = path.join(repoRoot, 'scripts', 'install-mdt.js');

function runNodeScript(scriptPath, args = [], options = {}) {
  return spawnSync('node', [scriptPath, ...args], {
    encoding: 'utf8',
    cwd: options.cwd || repoRoot,
    env: buildTestEnv(options.profile || 'neutral', options.env || {}),
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: options.timeoutMs || 20000
  });
}

function assertSuccess(result, context) {
  assert.strictEqual(
    result.status,
    0,
    `${context} should exit 0, got ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
}

function installTarget(target, packages, options = {}) {
  const tmpHome = createTestDir(`compat-${target}-home-`);
  const overrideRoot = path.join(tmpHome, `.${target === 'claude' ? 'claude' : target}`);
  const env = {
    HOME: tmpHome,
    USERPROFILE: tmpHome,
    ...(options.env || {})
  };
  if (target === 'claude') {
    env.CLAUDE_BASE_DIR = overrideRoot;
  }

  const args = [];
  if (target !== 'claude') {
    args.push('--target', target);
  }
  if (options.dev) {
    args.push('--dev');
  }
  args.push(...packages);

  const result = runNodeScript(installerPath, ['--override', overrideRoot, ...args], {
    env,
    cwd: options.cwd || repoRoot,
    profile: options.profile || 'neutral',
    timeoutMs: options.timeoutMs
  });
  assertSuccess(result, `${target} install`);

  return {
    tmpHome,
    overrideRoot,
    env,
    result
  };
}

function cleanupInstall(fixture) {
  cleanupTestDir(fixture.tmpHome);
}

function ensureFile(filePath) {
  assert.ok(fs.existsSync(filePath), `Expected file to exist: ${filePath}`);
}

module.exports = {
  cleanupInstall,
  ensureFile,
  installTarget,
  repoRoot,
  runNodeScript,
  assertSuccess
};

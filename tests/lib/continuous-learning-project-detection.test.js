'use strict';

const assert = require('assert');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { createInstalledContinuousLearningLayout } = require('../helpers/continuous-learning-install-layout');
const { createProjectDetection } = require('../../scripts/lib/continuous-learning/project-detection');

function withEnv(overrides, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function runTests() {
  console.log('\n=== Testing continuous-learning private project detection ===\n');

  let passed = 0;
  let failed = 0;

  if (test('private project detection keeps installed config-root inference', () => {
    const layout = createInstalledContinuousLearningLayout({
      tool: 'codex',
      files: ['skills/continuous-learning-manual/scripts/detect-project.js']
    });
    try {
      const runtime = createProjectDetection({ entrypointDir: path.join(layout.skillDir, 'scripts') });
      assert.strictEqual(runtime.inferInstalledConfigDir(path.join(layout.skillDir, 'scripts')), layout.configDir);
    } finally {
      cleanupTestDir(layout.tempDir);
    }
  })) passed++; else failed++;

  if (test('private project detection returns cwd-scoped project IDs for non-git dirs', () => {
    const tempDir = createTestDir('private-project-detect-');
    try {
      const workDir = path.join(tempDir, 'scripts');
      const configDir = path.join(tempDir, '.codex');
      const runtime = createProjectDetection({ entrypointDir: path.join(__dirname, '..', '..', 'skills', 'continuous-learning-manual', 'scripts') });
      const project = withEnv({
        CONFIG_DIR: configDir,
        DATA_DIR: configDir,
        CODEX_AGENT: '1',
        MDT_PROJECT_ROOT: undefined,
        CLAUDE_PROJECT_DIR: undefined
      }, () => {
        require('fs').mkdirSync(workDir, { recursive: true });
        require('fs').mkdirSync(configDir, { recursive: true });
        return runtime.detectProject(workDir);
      });

      assert.ok(/^scripts-[0-9a-f]{8}$/.test(project.id), `expected scripts-<md5> but got: ${project.id}`);
      assert.strictEqual(project.root, workDir);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

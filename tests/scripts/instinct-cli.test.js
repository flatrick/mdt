const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, cleanupTestDir } = require('../helpers/test-runner');
const { createInstalledContinuousLearningLayout } = require('../helpers/continuous-learning-install-layout');

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
  console.log('\n=== Testing instinct-cli.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('getCliPaths uses global ~/.codex/mdt storage for Codex workflows', () => {
    const layout = createInstalledContinuousLearningLayout({
      tool: 'codex',
      files: [
        'skills/continuous-learning-manual/scripts/instinct-cli.js',
        'skills/continuous-learning-manual/scripts/detect-project.js'
      ]
    });
    try {
      const cli = withEnv({
        HOME: layout.tempDir,
        USERPROFILE: layout.tempDir,
        CONFIG_DIR: undefined,
        DATA_DIR: undefined,
        CODEX_AGENT: undefined,
        CURSOR_AGENT: undefined
      }, () => require(path.join(layout.skillDir, 'scripts', 'instinct-cli.js')));

      const paths = withEnv({
        HOME: layout.tempDir,
        USERPROFILE: layout.tempDir,
        CONFIG_DIR: undefined,
        DATA_DIR: undefined,
        CODEX_AGENT: undefined,
        CURSOR_AGENT: undefined
      }, () => cli.getCliPaths());

      assert.ok(paths.GLOBAL_PERSONAL.includes(path.join(layout.tempDir, '.codex', 'mdt', 'homunculus')));
      assert.ok(!paths.GLOBAL_PERSONAL.includes(path.join(layout.tempDir, '.cursor', 'mdt', 'homunculus')));
    } finally {
      cleanupTestDir(layout.tempDir);
    }
  })) passed++; else failed++;

  if (test('codex overlay instinct-cli wrapper exports the same public runtime helpers', () => {
    const overlayCli = require(path.join(
      __dirname,
      '..',
      '..',
      'codex-template',
      'skills',
      'continuous-learning-manual',
      'scripts',
      'instinct-cli.js'
    ));

    assert.strictEqual(typeof overlayCli.buildCodexEnv, 'function');
    assert.strictEqual(typeof overlayCli.getCliPaths, 'function');
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

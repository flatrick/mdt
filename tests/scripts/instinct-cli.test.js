const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');

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

  if (test('getCliPaths prefers repo-local .codex storage for Codex workflows', () => {
    const tempDir = createTestDir('instinct-cli-codex-');
    try {
      fs.mkdirSync(path.join(tempDir, '.git'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, '.agents', 'skills', 'continuous-learning-manual', 'scripts'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, '.codex'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, '.agents', 'scripts', 'lib'), { recursive: true });

      const modulePath = path.join(tempDir, '.agents', 'skills', 'continuous-learning-manual', 'scripts', 'instinct-cli.js');
      const detectProjectPath = path.join(tempDir, '.agents', 'skills', 'continuous-learning-manual', 'scripts', 'detect-project.js');
      fs.copyFileSync(
        path.join(__dirname, '..', '..', 'skills', 'continuous-learning-manual', 'scripts', 'instinct-cli.js'),
        modulePath
      );
      fs.copyFileSync(
        path.join(__dirname, '..', '..', 'skills', 'continuous-learning-manual', 'scripts', 'detect-project.js'),
        detectProjectPath
      );
      fs.copyFileSync(
        path.join(__dirname, '..', '..', 'scripts', 'lib', 'detect-env.js'),
        path.join(tempDir, '.agents', 'scripts', 'lib', 'detect-env.js')
      );

      const cli = withEnv({
        HOME: tempDir,
        USERPROFILE: tempDir,
        CONFIG_DIR: undefined,
        DATA_DIR: undefined,
        CODEX_AGENT: undefined,
        CURSOR_AGENT: undefined
      }, () => require(modulePath));

      const paths = withEnv({
        HOME: tempDir,
        USERPROFILE: tempDir,
        CONFIG_DIR: undefined,
        DATA_DIR: undefined,
        CODEX_AGENT: undefined,
        CURSOR_AGENT: undefined
      }, () => cli.getCliPaths());

      assert.ok(paths.GLOBAL_PERSONAL.includes(path.join(tempDir, '.codex', 'homunculus')));
      assert.ok(!paths.GLOBAL_PERSONAL.includes(path.join(tempDir, '.cursor', 'homunculus')));
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

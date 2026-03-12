/**
 * Tests for validate-metadata.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');

const { validateMetadata } = require('../../scripts/ci/validate-metadata');

function runValidator(options = {}) {
  const logs = [];
  const errors = [];
  const result = validateMetadata({
    ...options,
    io: {
      log: (message) => logs.push(String(message)),
      error: (message) => errors.push(String(message))
    }
  });

  return {
    code: result.exitCode,
    stdout: logs.join('\n'),
    stderr: errors.join('\n')
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function createFixtureRepo(overrides = {}) {
  const repoRoot = createTestDir('mdt-metadata-');
  const packageJson = {
    name: 'modeldev-toolkit',
    version: '1.7.0',
    repository: {
      type: 'git',
      url: 'git+https://github.com/flatrick/modeldev-toolkit.git'
    },
    homepage: 'https://github.com/flatrick/modeldev-toolkit#readme'
  };
  const pluginJson = {
    name: 'modeldev-toolkit',
    version: '1.7.0',
    homepage: 'https://github.com/flatrick/modeldev-toolkit',
    repository: 'https://github.com/flatrick/modeldev-toolkit'
  };
  const marketplaceJson = {
    name: 'modeldev-toolkit',
    plugins: [
      {
        name: 'modeldev-toolkit',
        version: '1.7.0',
        homepage: 'https://github.com/flatrick/modeldev-toolkit',
        repository: 'https://github.com/flatrick/modeldev-toolkit'
      }
    ]
  };
  writeJson(path.join(repoRoot, 'package.json'), {
    ...packageJson,
    ...(overrides.packageJson || {})
  });
  writeJson(path.join(repoRoot, '.claude-plugin', 'plugin.json'), {
    ...pluginJson,
    ...(overrides.pluginJson || {})
  });
  writeJson(path.join(repoRoot, '.claude-plugin', 'marketplace.json'), {
    ...marketplaceJson,
    ...(overrides.marketplaceJson || {})
  });
  return repoRoot;
}

function runTests() {
  console.log('\n=== Testing validate-metadata.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('passes on real project manifests', () => {
    const result = runValidator();
    assert.strictEqual(result.code, 0, `Should pass, got stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes('Validated metadata consistency'), 'Should report validation success');
  })) passed++; else failed++;

  if (test('fails when plugin version differs from package version', () => {
    const repoRoot = createFixtureRepo({
      pluginJson: { version: '9.9.9' }
    });

    try {
      const result = runValidator({ repoRoot });
      assert.strictEqual(result.code, 1, 'Should fail for mismatched versions');
      assert.ok(result.stderr.includes('version'), 'Should report version drift');
    } finally {
      cleanupTestDir(repoRoot);
    }
  })) passed++; else failed++;

  if (test('fails when manifest names drift from canonical package name', () => {
    const repoRoot = createFixtureRepo({
      marketplaceJson: { name: 'everything-claude-code' }
    });

    try {
      const result = runValidator({ repoRoot });
      assert.strictEqual(result.code, 1, 'Should fail for name drift');
      assert.ok(result.stderr.includes('name'), 'Should report name drift');
    } finally {
      cleanupTestDir(repoRoot);
    }
  })) passed++; else failed++;

  if (test('fails when repository or homepage drift across manifests', () => {
    const repoRoot = createFixtureRepo({
      marketplaceJson: {
        plugins: [
          {
            name: 'modeldev-toolkit',
            version: '1.7.0',
            homepage: 'https://github.com/flatrick/mdt#readme',
            repository: 'https://github.com/flatrick/modeldev-toolkit'
          }
        ]
      }
    });

    try {
      const result = runValidator({ repoRoot });
      assert.strictEqual(result.code, 1, 'Should fail for URL drift');
      assert.ok(result.stderr.includes('homepage'), 'Should report homepage drift');
    } finally {
      cleanupTestDir(repoRoot);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

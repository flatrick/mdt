/**
 * Tests for scripts/ci/check-dependencies.js
 *
 * Run with: node tests/scripts/check-dependencies.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { checkDependencies } = require('../../scripts/ci/check-dependencies');
const { test } = require('../helpers/test-runner');
const { createTestDir, cleanupTestDir } = require('../helpers/test-runner');

function runTests() {
  console.log('\n=== Testing check-dependencies.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('returns ok:true when all requested dependencies are installed', () => {
    const repoRoot = createTestDir('check-deps-');
    try {
      for (const pkg of ['eslint', 'markdownlint-cli']) {
        const pkgDir = path.join(repoRoot, 'node_modules', pkg);
        fs.mkdirSync(pkgDir, { recursive: true });
        fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: pkg, version: '1.0.0' }));
      }

      const result = checkDependencies(['eslint', 'markdownlint-cli'], repoRoot);
      assert.strictEqual(result.ok, true);
    } finally {
      cleanupTestDir(repoRoot);
    }
  })) passed++; else failed++;

  if (test('returns missing dependency message and npm ci hint', () => {
    const result = checkDependencies(['definitely-not-a-real-package-name-xyz']);
    assert.strictEqual(result.ok, false);
    assert.ok(result.message.includes('Missing dependencies'));
    assert.ok(result.hint.includes('npm ci'));
  })) passed++; else failed++;

  if (test('returns no-dependencies-specified message for empty input', () => {
    const result = checkDependencies([]);
    assert.strictEqual(result.ok, false);
    assert.ok(result.message.includes('No dependencies specified'));
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

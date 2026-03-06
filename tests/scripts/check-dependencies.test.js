/**
 * Tests for scripts/ci/check-dependencies.js
 *
 * Run with: node tests/scripts/check-dependencies.test.js
 */

const assert = require('assert');
const { checkDependencies } = require('../../scripts/ci/check-dependencies');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

function runTests() {
  console.log('\n=== Testing check-dependencies.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('returns ok:true when all requested dependencies are installed', () => {
    const result = checkDependencies(['eslint', 'markdownlint-cli']);
    assert.strictEqual(result.ok, true);
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

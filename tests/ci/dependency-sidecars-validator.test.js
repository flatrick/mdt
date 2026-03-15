/**
 * Unit tests for scripts/ci/validate-dependency-sidecars.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('../helpers/test-runner');
const {
  validateSidecar,
  validateDependencySidecars
} = require('../../scripts/ci/validate-dependency-sidecars');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'dependency-sidecars');

function runTests() {
  console.log('\n=== Testing validate-dependency-sidecars.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('valid-minimal.json passes validation', () => {
    const obj = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'valid-minimal.json'), 'utf8'));
    const errors = [];
    validateSidecar(obj, 'valid-minimal.json', errors);
    assert.strictEqual(errors.length, 0, errors.join('; '));
  })) passed++; else failed++;

  if (test('valid-with-tools-overrides.json passes validation', () => {
    const obj = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'valid-with-tools-overrides.json'), 'utf8'));
    const errors = [];
    validateSidecar(obj, 'valid-with-tools-overrides.json', errors);
    assert.strictEqual(errors.length, 0, errors.join('; '));
  })) passed++; else failed++;

  if (test('invalid-missing-version.json fails validation', () => {
    const obj = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'invalid-missing-version.json'), 'utf8'));
    const errors = [];
    validateSidecar(obj, 'invalid-missing-version.json', errors);
    assert.ok(errors.length > 0);
    assert.ok(errors.some((e) => e.includes('version')));
  })) passed++; else failed++;

  if (test('invalid-bad-entry-type.json fails validation', () => {
    const obj = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'invalid-bad-entry-type.json'), 'utf8'));
    const errors = [];
    validateSidecar(obj, 'invalid-bad-entry-type.json', errors);
    assert.ok(errors.length > 0);
    assert.ok(errors.some((e) => e.includes('type')));
  })) passed++; else failed++;

  if (test('validateDependencySidecars returns exitCode 0 when no sidecars present', () => {
    const io = { log: () => {}, error: () => {} };
    const result = validateDependencySidecars(path.join(__dirname, '..', '..'), io);
    assert.strictEqual(result.exitCode, 0);
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

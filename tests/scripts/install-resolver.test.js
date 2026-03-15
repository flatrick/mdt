/**
 * Unit tests for scripts/lib/install-resolver.js
 */

const assert = require('assert');
const { test } = require('../helpers/test-runner');
const {
  resolveInstallClosure,
  loadPackageManifest,
  buildExtendsGraph,
  findCyclesInGraph
} = require('../../scripts/lib/install-resolver');

function runTests() {
  console.log('\n=== Testing install-resolver.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('loadPackageManifest loads ai-learning', () => {
    const manifest = loadPackageManifest('ai-learning');
    assert.ok(manifest, 'manifest should exist');
    assert.strictEqual(manifest.name, 'ai-learning');
    assert.ok(!manifest.extends || Array.isArray(manifest.extends));
  })) passed++; else failed++;

  if (test('buildExtendsGraph and findCyclesInGraph report no cycle for single package', () => {
    const graph = buildExtendsGraph(['ai-learning']);
    const cycles = findCyclesInGraph(graph);
    assert.strictEqual(cycles.length, 0);
  })) passed++; else failed++;

  if (test('resolveInstallClosure returns success and closure with packages for claude', () => {
    const result = resolveInstallClosure(['ai-learning'], 'claude');
    assert.strictEqual(result.success, true, result.errors?.join('; ') || '');
    assert.ok(result.closure, 'closure should exist');
    assert.ok(Array.isArray(result.closure.packages));
    assert.ok(result.closure.packages.includes('ai-learning'), 'closure should include selected package');
  })) passed++; else failed++;

  if (test('resolveInstallClosure returns success for cursor target', () => {
    const result = resolveInstallClosure(['ai-learning'], 'cursor');
    assert.strictEqual(result.success, true, result.errors?.join('; ') || '');
  })) passed++; else failed++;

  if (test('resolveInstallClosure returns failure for unknown package', () => {
    const result = resolveInstallClosure(['nonexistent-package-xyz'], 'claude');
    assert.strictEqual(result.success, false);
    assert.ok(result.errors.length > 0);
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

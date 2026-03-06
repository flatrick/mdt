/**
 * Unit tests for scripts/install-ecc.js argument parsing and dry-run planning.
 *
 * Run with: node tests/scripts/install-ecc-unit.test.js
 */

const assert = require('assert');
const { test } = require('../helpers/test-runner');
const {
  parseArgsFrom,
  buildInstallPlan
} = require('../../scripts/install-ecc');

function runTests() {
  console.log('\n=== Testing install-ecc.js (unit) ===\n');

  let passed = 0;
  let failed = 0;

  if (test('parseArgsFrom parses list and dry-run flags', () => {
    const parsed = parseArgsFrom(['--target', 'cursor', '--global', '--list', '--dry-run', 'typescript']);
    assert.strictEqual(parsed.target, 'cursor');
    assert.strictEqual(parsed.globalScope, true);
    assert.strictEqual(parsed.listMode, true);
    assert.strictEqual(parsed.dryRun, true);
    assert.deepStrictEqual(parsed.languages, ['typescript']);
  })) passed++; else failed++;

  if (test('parseArgsFrom defaults to claude target with no flags', () => {
    const parsed = parseArgsFrom([]);
    assert.strictEqual(parsed.target, 'claude');
    assert.strictEqual(parsed.globalScope, false);
    assert.strictEqual(parsed.listMode, false);
    assert.strictEqual(parsed.dryRun, false);
    assert.deepStrictEqual(parsed.languages, []);
  })) passed++; else failed++;

  if (test('buildInstallPlan returns codex plan without language requirement', () => {
    const plan = buildInstallPlan({ target: 'codex', globalScope: false, languages: [] });
    assert.ok(plan.some((line) => line.includes('[dry-run] Target: codex')));
    assert.ok(plan.some((line) => line.includes('Would install from')));
  })) passed++; else failed++;

  if (test('buildInstallPlan includes global cursor rule-skip note', () => {
    const plan = buildInstallPlan({ target: 'cursor', globalScope: true, languages: ['typescript'] });
    assert.ok(plan.some((line) => line.includes('Target: cursor (global)')));
    assert.ok(plan.some((line) => line.includes('Would skip file-based rules')));
  })) passed++; else failed++;

  if (test('buildInstallPlan includes claude runtime scripts detail', () => {
    const plan = buildInstallPlan({ target: 'claude', globalScope: false, languages: ['typescript'] });
    assert.ok(plan.some((line) => line.includes('runtime scripts')));
    assert.ok(plan.some((line) => line.includes('scripts/hooks + scripts/lib')));
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();


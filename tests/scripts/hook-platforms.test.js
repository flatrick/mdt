/**
 * Unit tests for scripts/lib/hook-platforms.js
 */

const assert = require('assert');
const path = require('path');
const { test } = require('../helpers/test-runner');

const {
  HOOK_PLATFORMS,
  getHookPlatform
} = require('../../scripts/lib/hook-platforms');

function runTests() {
  console.log('\n=== Testing hook-platforms.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('exports Claude and Cursor hook platforms', () => {
    assert.ok(HOOK_PLATFORMS.claude, 'claude platform missing');
    assert.ok(HOOK_PLATFORMS.cursor, 'cursor platform missing');
  })) passed++; else failed++;

  if (test('Claude platform points at claude-template/hooks.json and hooks/hooks.json mirror', () => {
    const claude = getHookPlatform('claude');
    assert.ok(claude.sourceConfig.endsWith(path.join('claude-template', 'hooks.json')));
    assert.ok(claude.mirrorConfig.endsWith(path.join('hooks', 'hooks.json')));
    assert.strictEqual(claude.sourceScriptsDir, null);
    assert.strictEqual(claude.mirrorScriptsDir, null);
  })) passed++; else failed++;

  if (test('Cursor platform points at hooks/cursor sources and cursor-template mirrors', () => {
    const cursor = getHookPlatform('cursor');
    assert.ok(cursor.sourceConfig.endsWith(path.join('hooks', 'cursor', 'hooks.json')));
    assert.ok(cursor.sourceScriptsDir.endsWith(path.join('hooks', 'cursor', 'scripts')));
    assert.ok(cursor.mirrorConfig.endsWith(path.join('cursor-template', 'hooks.json')));
    assert.ok(cursor.mirrorScriptsDir.endsWith(path.join('cursor-template', 'hooks')));
  })) passed++; else failed++;

  if (test('getHookPlatform throws for unknown platform', () => {
    assert.throws(() => getHookPlatform('codex'), /Unknown hook platform/);
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

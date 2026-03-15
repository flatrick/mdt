/**
 * Unit tests for scripts/ci/validate-addon-allowlist.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { validateAddonAllowlist } = require('../../scripts/ci/validate-addon-allowlist');

function runTests() {
  console.log('\n=== Testing validate-addon-allowlist.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('validateAddonAllowlist passes when add-on has only allowlisted content', () => {
    const tempDir = createTestDir('mdt-addon-allowlist-');
    const skillsDir = path.join(tempDir, 'codex-template', 'skills', 'foo');
    fs.mkdirSync(path.join(skillsDir, 'agents'), { recursive: true });
    fs.mkdirSync(path.join(skillsDir, 'rules'), { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'skill.meta.json'), '{}');
    fs.writeFileSync(path.join(skillsDir, 'SKILL.md'), '# Skill');
    fs.writeFileSync(path.join(skillsDir, 'config.json'), '{}');
    const io = { log: () => {}, error: () => {} };
    const result = validateAddonAllowlist(tempDir, io);
    assert.strictEqual(result.exitCode, 0);
    cleanupTestDir(tempDir);
  })) passed++; else failed++;

  if (test('validateAddonAllowlist fails when add-on contains scripts/ dir', () => {
    const tempDir = createTestDir('mdt-addon-allowlist-');
    const skillsDir = path.join(tempDir, 'codex-template', 'skills', 'bar');
    fs.mkdirSync(path.join(skillsDir, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'skill.meta.json'), '{}');
    const io = { log: () => {}, error: () => {} };
    const result = validateAddonAllowlist(tempDir, io);
    assert.strictEqual(result.exitCode, 1);
    assert.ok(result.errors.some((e) => e.includes('disallowed directory') && e.includes('scripts')));
    cleanupTestDir(tempDir);
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

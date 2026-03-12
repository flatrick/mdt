const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const {
  copyInstalledCursorRules,
  resolveCursorConfigDir
} = require('../../scripts/materialize-mdt-local');

function runTests() {
  console.log('\n=== Testing materialize-mdt-local.js (unit) ===\n');

  let passed = 0;
  let failed = 0;

  if (test('resolveCursorConfigDir prefers override then CONFIG_DIR then HOME', () => {
    const tmpHome = createTestDir('mdt-cursor-config-home-');
    const overrideDir = path.join(tmpHome, 'override-cursor');
    const envConfigDir = path.join(tmpHome, 'env-cursor');

    try {
      assert.strictEqual(
        resolveCursorConfigDir(overrideDir, { HOME: tmpHome, USERPROFILE: tmpHome, CONFIG_DIR: envConfigDir }),
        path.resolve(overrideDir)
      );
      assert.strictEqual(
        resolveCursorConfigDir(null, { HOME: tmpHome, USERPROFILE: tmpHome, CONFIG_DIR: envConfigDir }),
        path.resolve(envConfigDir)
      );
      assert.strictEqual(
        resolveCursorConfigDir(null, { HOME: tmpHome, USERPROFILE: tmpHome }),
        path.join(tmpHome, '.cursor')
      );
    } finally {
      cleanupTestDir(tmpHome);
    }
  })) passed++; else failed++;

  if (test('copyInstalledCursorRules copies current global rules into repo .cursor/rules', () => {
    const tmpHome = createTestDir('mdt-cursor-rules-home-');
    const tmpProject = createTestDir('mdt-cursor-rules-proj-');

    try {
      fs.writeFileSync(path.join(tmpProject, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf8');
      const sourceDir = path.join(tmpHome, '.cursor', 'rules');
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, 'common-coding-style.mdc'), '# rule', 'utf8');
      fs.writeFileSync(path.join(sourceDir, 'never-attempt-to-read.mdc'), '# another', 'utf8');
      fs.writeFileSync(path.join(sourceDir, 'ignore.txt'), 'skip', 'utf8');

      const result = copyInstalledCursorRules(tmpProject, {
        env: { HOME: tmpHome, USERPROFILE: tmpHome }
      });

      assert.strictEqual(result.mode, 'installed-global');
      assert.strictEqual(result.sourceDir, sourceDir);
      assert.ok(fs.existsSync(path.join(tmpProject, '.cursor', 'rules', 'common-coding-style.mdc')));
      assert.ok(fs.existsSync(path.join(tmpProject, '.cursor', 'rules', 'never-attempt-to-read.mdc')));
      assert.ok(!fs.existsSync(path.join(tmpProject, '.cursor', 'rules', 'ignore.txt')));
      assert.deepStrictEqual(result.copied, ['common-coding-style.mdc', 'never-attempt-to-read.mdc']);
    } finally {
      cleanupTestDir(tmpHome);
      cleanupTestDir(tmpProject);
    }
  })) passed++; else failed++;

  if (test('copyInstalledCursorRules fails when no global rules exist', () => {
    const tmpHome = createTestDir('mdt-cursor-empty-home-');
    const tmpProject = createTestDir('mdt-cursor-empty-proj-');

    try {
      fs.writeFileSync(path.join(tmpProject, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf8');
      assert.throws(
        () => copyInstalledCursorRules(tmpProject, {
          env: { HOME: tmpHome, USERPROFILE: tmpHome }
        }),
        /Cursor global rules directory does not exist/
      );
    } finally {
      cleanupTestDir(tmpHome);
      cleanupTestDir(tmpProject);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

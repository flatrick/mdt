/**
 * Tests for scripts/install-ecc.js
 *
 * Run with: node tests/scripts/install-ecc.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ensureSubprocessCapability } = require('../helpers/subprocess-capability');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { buildTestEnv } = require('../helpers/test-env-profiles');

function runInstaller(args, options = {}) {
  const repoRoot = path.join(__dirname, '..', '..');
  const installerPath = path.join(repoRoot, 'scripts', 'install-ecc.js');
  return spawnSync('node', [installerPath, ...args], {
    encoding: 'utf8',
    cwd: options.cwd || repoRoot,
    env: buildTestEnv(options.profile || 'neutral', options.env || {}),
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 20000
  });
}

function assertSuccess(result, context) {
  assert.strictEqual(
    result.status,
    0,
    `${context} should exit 0, got ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
}

function runTests() {
  console.log('\n=== Testing install-ecc.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('claude install copies runtime scripts only (hooks + lib)', () => {
    const tmpHome = createTestDir('ecc-install-claude-');
    const claudeBase = path.join(tmpHome, '.claude');

    try {
      const result = runInstaller(['--global', 'typescript'], {
        env: {
          HOME: tmpHome,
          USERPROFILE: tmpHome,
          CLAUDE_BASE_DIR: claudeBase
        }
      });
      assertSuccess(result, 'claude install');

      assert.ok(fs.existsSync(path.join(claudeBase, 'scripts', 'hooks', 'session-start.js')));
      assert.ok(fs.existsSync(path.join(claudeBase, 'scripts', 'lib', 'utils.js')));
      assert.ok(!fs.existsSync(path.join(claudeBase, 'scripts', 'ci')), 'scripts/ci must not be installed');
      assert.ok(!fs.existsSync(path.join(claudeBase, 'scripts', 'install-ecc.js')), 'top-level installer must not be installed');
    } finally {
      cleanupTestDir(tmpHome);
    }
  })) passed++; else failed++;

  if (test('cursor install copies runtime scripts only (hooks + lib)', () => {
    const tmpHome = createTestDir('ecc-install-cursor-home-');
    const tmpProject = createTestDir('ecc-install-cursor-proj-');

    try {
      const result = runInstaller(['--target', 'cursor', 'typescript'], {
        cwd: tmpProject,
        env: {
          HOME: tmpHome,
          USERPROFILE: tmpHome
        }
      });
      assertSuccess(result, 'cursor install');

      const cursorRoot = path.join(tmpProject, '.cursor');
      assert.ok(fs.existsSync(path.join(cursorRoot, 'scripts', 'hooks', 'session-start.js')));
      assert.ok(fs.existsSync(path.join(cursorRoot, 'scripts', 'lib', 'utils.js')));
      assert.ok(!fs.existsSync(path.join(cursorRoot, 'scripts', 'ci')), 'scripts/ci must not be installed');
      assert.ok(!fs.existsSync(path.join(cursorRoot, 'scripts', 'install-ecc.js')), 'top-level installer must not be installed');
    } finally {
      cleanupTestDir(tmpHome);
      cleanupTestDir(tmpProject);
    }
  })) passed++; else failed++;

  if (test('claude install merges hooks into existing settings.json and preserves other keys', () => {
    const tmpHome = createTestDir('ecc-install-settings-');
    const claudeBase = path.join(tmpHome, '.claude');

    try {
      fs.mkdirSync(claudeBase, { recursive: true });
      fs.writeFileSync(
        path.join(claudeBase, 'settings.json'),
        JSON.stringify({ theme: 'dark', customFlag: true, hooks: { legacy: [] } }, null, 2),
        'utf8'
      );

      const result = runInstaller(['--global', 'typescript'], {
        env: {
          HOME: tmpHome,
          USERPROFILE: tmpHome,
          CLAUDE_BASE_DIR: claudeBase
        }
      });
      assertSuccess(result, 'claude install with existing settings');

      const settingsPath = path.join(claudeBase, 'settings.json');
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const settingsRaw = fs.readFileSync(settingsPath, 'utf8');

      assert.strictEqual(settings.theme, 'dark', 'existing non-hook keys should be preserved');
      assert.strictEqual(settings.customFlag, true, 'existing boolean key should be preserved');
      assert.ok(settings.hooks && settings.hooks.PreToolUse, 'hooks should be replaced with installer hooks block');
      assert.ok(!settingsRaw.includes('${CLAUDE_PLUGIN_ROOT}'), 'hooks should be materialized to absolute paths');
      assert.ok(fs.existsSync(path.join(claudeBase, 'settings.json.bkp')), 'installer should create backup file');
    } finally {
      cleanupTestDir(tmpHome);
    }
  })) passed++; else failed++;

  if (test('claude project-level install copies to cwd .claude', () => {
    const tmpProject = createTestDir('ecc-install-claude-proj-');

    try {
      const result = runInstaller(['typescript'], {
        cwd: tmpProject,
        env: {
          HOME: tmpProject,
          USERPROFILE: tmpProject
        }
      });
      assertSuccess(result, 'claude project install');

      const claudeRoot = path.join(tmpProject, '.claude');
      assert.ok(fs.existsSync(path.join(claudeRoot, 'rules', 'common')), 'common rules should exist');
      assert.ok(fs.existsSync(path.join(claudeRoot, 'scripts', 'lib', 'utils.js')), 'runtime scripts should exist');
      assert.ok(fs.existsSync(path.join(claudeRoot, 'settings.json')), 'settings.json should exist');

      const settings = JSON.parse(fs.readFileSync(path.join(claudeRoot, 'settings.json'), 'utf8'));
      const settingsRaw = fs.readFileSync(path.join(claudeRoot, 'settings.json'), 'utf8');
      assert.ok(!settingsRaw.includes('${CLAUDE_PLUGIN_ROOT}'), 'plugin root placeholder should be resolved');
      assert.ok(settingsRaw.includes('.claude'), 'hook paths should use project-relative .claude');
    } finally {
      cleanupTestDir(tmpProject);
    }
  })) passed++; else failed++;

  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

ensureSubprocessCapability('tests/scripts/install-ecc.test.js');
runTests();

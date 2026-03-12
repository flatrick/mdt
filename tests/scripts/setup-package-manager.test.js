/**
 * Tests for scripts/setup-package-manager.js
 *
 * Run with: node tests/scripts/setup-package-manager.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { test } = require('../helpers/test-runner');

function withEnv(overrides, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function freshModules() {
  delete require.cache[require.resolve('../../scripts/lib/detect-env')];
  delete require.cache[require.resolve('../../scripts/lib/utils')];
  delete require.cache[require.resolve('../../scripts/lib/package-manager')];
  delete require.cache[require.resolve('../../scripts/setup-package-manager')];
  const deps = require('../../scripts/lib/package-manager');
  const { runSetupPackageManager } = require('../../scripts/setup-package-manager');
  return { deps, runSetupPackageManager };
}

function run(args = [], options = {}) {
  const out = [];
  const err = [];
  const warnings = [];
  const env = options.env || {};
  const cwd = options.cwd || process.cwd();

  return withEnv(env, () => {
    const { deps, runSetupPackageManager } = freshModules();
    const code = runSetupPackageManager(args, {
      deps,
      env: process.env,
      cwd,
      io: {
        log: msg => out.push(String(msg)),
        error: msg => err.push(String(msg)),
        warn: msg => warnings.push(String(msg))
      }
    });
    return {
      code,
      stdout: out.join('\n'),
      stderr: err.join('\n'),
      warnings: warnings.join('\n')
    };
  });
}

function runTests() {
  console.log('\n=== Testing setup-package-manager.js ===\n');

  let passed = 0;
  let failed = 0;

  console.log('--help:');

  if (test('shows help with --help flag', () => {
    const result = run(['--help']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Package Manager Setup'));
    assert.ok(result.stdout.includes('--detect'));
    assert.ok(result.stdout.includes('--global'));
    assert.ok(result.stdout.includes('--project'));
  })) passed++; else failed++;

  if (test('shows help with -h flag', () => {
    const result = run(['-h']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Package Manager Setup'));
  })) passed++; else failed++;

  if (test('shows help with no arguments', () => {
    const result = run([]);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Package Manager Setup'));
  })) passed++; else failed++;

  console.log('\n--detect:');

  if (test('detects current package manager', () => {
    const result = run(['--detect']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Package Manager Detection'));
    assert.ok(result.stdout.includes('Current selection'));
  })) passed++; else failed++;

  if (test('shows detection sources', () => {
    const result = run(['--detect']);
    assert.ok(result.stdout.includes('From package.json'));
    assert.ok(result.stdout.includes('From lock file'));
    assert.ok(result.stdout.includes('Environment var'));
  })) passed++; else failed++;

  if (test('shows available managers in detection output', () => {
    const result = run(['--detect']);
    assert.ok(result.stdout.includes('npm'));
    assert.ok(result.stdout.includes('pnpm'));
    assert.ok(result.stdout.includes('yarn'));
    assert.ok(result.stdout.includes('bun'));
  })) passed++; else failed++;

  console.log('\n--list:');

  if (test('lists available package managers', () => {
    const result = run(['--list']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Available Package Managers'));
    assert.ok(result.stdout.includes('npm'));
    assert.ok(result.stdout.includes('Lock file'));
    assert.ok(result.stdout.includes('Install'));
  })) passed++; else failed++;

  console.log('\n--global:');

  if (test('rejects --global without package manager name', () => {
    const result = run(['--global']);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('requires a package manager name'));
  })) passed++; else failed++;

  if (test('rejects --global with unknown package manager', () => {
    const result = run(['--global', 'unknown-pm']);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('Unknown package manager'));
  })) passed++; else failed++;

  console.log('\n--project:');

  if (test('rejects --project without package manager name', () => {
    const result = run(['--project']);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('requires a package manager name'));
  })) passed++; else failed++;

  if (test('rejects --project with unknown package manager', () => {
    const result = run(['--project', 'unknown-pm']);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('Unknown package manager'));
  })) passed++; else failed++;

  console.log('\npositional argument:');

  if (test('rejects unknown positional argument', () => {
    const result = run(['not-a-pm']);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('Unknown option or package manager'));
  })) passed++; else failed++;

  console.log('\nenvironment variable:');

  if (test('detects env var override', () => {
    const result = run(['--detect'], { env: { CLAUDE_PACKAGE_MANAGER: 'pnpm' } });
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('pnpm'));
  })) passed++; else failed++;

  console.log('\n--detect output completeness:');

  if (test('shows all three command types in detection output', () => {
    const result = run(['--detect']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Install:'));
    assert.ok(result.stdout.includes('Run script:'));
    assert.ok(result.stdout.includes('Execute binary:'));
  })) passed++; else failed++;

  if (test('shows current marker for active package manager', () => {
    const result = run(['--detect']);
    assert.ok(result.stdout.includes('(current)'));
  })) passed++; else failed++;

  console.log('\n--global flag validation (Round 31):');

  if (test('rejects --global --project', () => {
    const result = run(['--global', '--project']);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('requires a package manager name'));
  })) passed++; else failed++;

  if (test('rejects --global --unknown-flag', () => {
    const result = run(['--global', '--foo-bar']);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('requires a package manager name'));
  })) passed++; else failed++;

  if (test('--global --list is handled by --list check first', () => {
    const result = run(['--global', '--list']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Available Package Managers'));
  })) passed++; else failed++;

  console.log('\n--project flag validation (Round 31):');

  if (test('rejects --project --global', () => {
    const result = run(['--project', '--global']);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('requires a package manager name'));
  })) passed++; else failed++;

  if (test('rejects --project --unknown-flag', () => {
    const result = run(['--project', '--bar']);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('requires a package manager name'));
  })) passed++; else failed++;

  console.log('\n--detect marker uniqueness (Round 45):');

  if (test('--detect output shows exactly one (current) marker', () => {
    const result = run(['--detect']);
    assert.strictEqual(result.code, 0);
    const currentLines = result.stdout.split('\n').filter(l => l.includes('(current)'));
    assert.strictEqual(currentLines.length, 1);
    assert.ok(/\b(npm|pnpm|yarn|bun)\b/.test(currentLines[0]));
  })) passed++; else failed++;

  console.log('\n--list output completeness (Round 45):');

  if (test('--list shows all four supported package managers', () => {
    const result = run(['--list']);
    assert.strictEqual(result.code, 0);
    for (const pm of ['npm', 'pnpm', 'yarn', 'bun']) {
      assert.ok(result.stdout.includes(pm));
    }
    assert.strictEqual((result.stdout.match(/Lock file:/g) || []).length, 4);
    assert.strictEqual((result.stdout.match(/Install:/g) || []).length, 4);
  })) passed++; else failed++;

  console.log('\n--global success path (Round 62):');

  if (test('--global npm writes config and succeeds', () => {
    const tmpDir = path.join(os.tmpdir(), `spm-test-global-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      const result = run(['--global', 'npm'], { env: { HOME: tmpDir, USERPROFILE: tmpDir } });
      assert.strictEqual(result.code, 0, `Expected 0, got ${result.code}. stderr: ${result.stderr}`);
      assert.ok(result.stdout.includes('Global preference set to'));
      const candidates = ['.cursor', '.claude', '.codex'].map(dir => path.join(tmpDir, dir, 'mdt', 'package-manager.json'));
      const existingPath = candidates.find(p => fs.existsSync(p));
      assert.ok(existingPath, 'Config file should be created');
      const config = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
      assert.strictEqual(config.packageManager, 'npm');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  console.log('\nbare PM name success (Round 62):');

  if (test('bare npm sets global preference and succeeds', () => {
    const tmpDir = path.join(os.tmpdir(), `spm-test-bare-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      const result = run(['npm'], { env: { HOME: tmpDir, USERPROFILE: tmpDir } });
      assert.strictEqual(result.code, 0, `Expected 0, got ${result.code}. stderr: ${result.stderr}`);
      assert.ok(result.stdout.includes('Global preference set to'));
      const candidates = ['.cursor', '.claude', '.codex'].map(dir => path.join(tmpDir, dir, 'mdt', 'package-manager.json'));
      const existingPath = candidates.find(p => fs.existsSync(p));
      assert.ok(existingPath, 'Config file should be created');
      const config = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
      assert.strictEqual(config.packageManager, 'npm');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  console.log('\n--detect source label (Round 62):');

  if (test('--detect with env var shows source as environment', () => {
    const result = run(['--detect'], { env: { CLAUDE_PACKAGE_MANAGER: 'pnpm' } });
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Source: environment'));
  })) passed++; else failed++;

  console.log('\n--project success path (Round 68):');

  if (test('--project npm writes project config and succeeds', () => {
    const tmpDir = path.join(os.tmpdir(), `spm-test-project-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      const result = run(['--project', 'npm'], { cwd: tmpDir });
      assert.strictEqual(result.code, 0, `Expected 0, got ${result.code}. stderr: ${result.stderr}`);
      assert.ok(result.stdout.includes('Project preference set to'));
      const configPath = path.join(tmpDir, '.claude', 'package-manager.json');
      assert.ok(fs.existsSync(configPath), 'Project config file should be created in CWD');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      assert.strictEqual(config.packageManager, 'npm');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  console.log('\n--list (current) marker (Round 68):');

  if (test('--list output includes (current) marker for active PM', () => {
    const result = run(['--list']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('(current)'));
    assert.strictEqual((result.stdout.match(/\(current\)/g) || []).length, 1);
  })) passed++; else failed++;

  console.log('\nRound 74: setGlobal catch (save failure):');

  if (test('--global npm fails when HOME is not a directory', () => {
    if (process.platform === 'win32') {
      console.log('    (skipped — /dev/null not available on Windows)');
      return;
    }
    const result = run(['--global', 'npm'], { env: { HOME: '/dev/null', USERPROFILE: '/dev/null' } });
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('Error:'));
  })) passed++; else failed++;

  console.log('\nRound 74: setProject catch (save failure):');

  if (test('--project npm fails when CWD is read-only', () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) {
      console.log('    (skipped — chmod ineffective on Windows/root)');
      return;
    }
    const tmpDir = path.join(os.tmpdir(), `spm-test-ro-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      fs.chmodSync(tmpDir, 0o555);
      const result = run(['--project', 'npm'], { cwd: tmpDir });
      assert.strictEqual(result.code, 1);
      assert.ok(result.stderr.includes('Error:'));
    } finally {
      try { fs.chmodSync(tmpDir, 0o755); } catch { /* best-effort */ }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

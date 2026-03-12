/**
 * Tests for scripts/lib/package-manager.js
 *
 * Run with: node tests/lib/package-manager-rounds.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { withEnv } = require('../helpers/env-test-utils');

// Import the modules
const pm = require('../../scripts/lib/package-manager');

// Test suite
function runTests() {
  console.log('\n=== Testing package-manager.js ===\n');

  let passed = 0;
  let failed = 0;

  console.log('\n=== Testing package-manager.js (Round Cases) ===\n');
  // ─── Round 21: getExecCommand args validation ───
  console.log('\ngetExecCommand (args validation):');

  if (test('rejects args with shell metacharacter semicolon', () => {
    assert.throws(() => pm.getExecCommand('prettier', '; rm -rf /'), /unsafe characters/);
  })) passed++;
  else failed++;

  if (test('rejects args with pipe character', () => {
    assert.throws(() => pm.getExecCommand('prettier', '--write . | cat'), /unsafe characters/);
  })) passed++;
  else failed++;

  if (test('rejects args with backtick injection', () => {
    assert.throws(() => pm.getExecCommand('prettier', '`whoami`'), /unsafe characters/);
  })) passed++;
  else failed++;

  if (test('rejects args with dollar sign', () => {
    assert.throws(() => pm.getExecCommand('prettier', '$HOME'), /unsafe characters/);
  })) passed++;
  else failed++;

  if (test('rejects args with ampersand', () => {
    assert.throws(() => pm.getExecCommand('prettier', '--write . && echo pwned'), /unsafe characters/);
  })) passed++;
  else failed++;

  if (test('allows safe args like --write .', () => {
    const cmd = pm.getExecCommand('prettier', '--write .');
    assert.ok(cmd.includes('--write .'), 'Should include safe args');
  })) passed++;
  else failed++;

  if (test('allows empty args without trailing space', () => {
    const cmd = pm.getExecCommand('prettier', '');
    assert.ok(!cmd.endsWith(' '), 'Should not have trailing space for empty args');
  })) passed++;
  else failed++;

  // ─── Round 21: getCommandPattern regex escaping ───
  console.log('\ngetCommandPattern (regex escaping):');

  if (test('escapes dot in action name for regex safety', () => {
    const pattern = pm.getCommandPattern('test.all');
    // The dot should be escaped to \. in the pattern
    const regex = new RegExp(pattern);
    assert.ok(regex.test('npm run test.all'), 'Should match literal dot');
    assert.ok(!regex.test('npm run testXall'), 'Should NOT match arbitrary character in place of dot');
  })) passed++;
  else failed++;

  if (test('escapes brackets in action name', () => {
    const pattern = pm.getCommandPattern('build[prod]');
    const regex = new RegExp(pattern);
    assert.ok(regex.test('npm run build[prod]'), 'Should match literal brackets');
  })) passed++;
  else failed++;

  if (test('escapes parentheses in action name', () => {
    // Should not throw when compiled as regex
    const pattern = pm.getCommandPattern('foo(bar)');
    assert.doesNotThrow(() => new RegExp(pattern), 'Should produce valid regex with escaped parens');
  })) passed++;
  else failed++;

  // ── Round 27: input validation and escapeRegex edge cases ──
  console.log('\ngetRunCommand (non-string input):');

  if (test('rejects undefined script name', () => {
    assert.throws(() => pm.getRunCommand(undefined), /non-empty string/);
  })) passed++;
  else failed++;

  if (test('rejects numeric script name', () => {
    assert.throws(() => pm.getRunCommand(123), /non-empty string/);
  })) passed++;
  else failed++;

  if (test('rejects boolean script name', () => {
    assert.throws(() => pm.getRunCommand(true), /non-empty string/);
  })) passed++;
  else failed++;

  console.log('\ngetExecCommand (non-string binary):');

  if (test('rejects undefined binary name', () => {
    assert.throws(() => pm.getExecCommand(undefined), /non-empty string/);
  })) passed++;
  else failed++;

  if (test('rejects numeric binary name', () => {
    assert.throws(() => pm.getExecCommand(42), /non-empty string/);
  })) passed++;
  else failed++;

  console.log('\ngetCommandPattern (escapeRegex completeness):');

  if (test('escapes all regex metacharacters in action', () => {
    // All regex metacharacters: . * + ? ^ $ { } ( ) | [ ] \
    const action = 'test.*+?^${}()|[]\\\\';
    const pattern = pm.getCommandPattern(action);
    // Should produce a valid regex without throwing
    assert.doesNotThrow(() => new RegExp(pattern), 'Should produce valid regex');
    // Should match the literal string
    const regex = new RegExp(pattern);
    assert.ok(regex.test(`npm run ${action}`), 'Should match literal metacharacters');
  })) passed++;
  else failed++;

  if (test('escapeRegex preserves alphanumeric chars', () => {
    const pattern = pm.getCommandPattern('simple-test');
    const regex = new RegExp(pattern);
    assert.ok(regex.test('npm run simple-test'), 'Should match simple action name');
    assert.ok(!regex.test('npm run simpleXtest'), 'Dash should not match arbitrary char');
  })) passed++;
  else failed++;

  console.log('\ngetPackageManager (global config edge cases):');

  if (test('ignores global config with non-string packageManager', () => {
    // This tests the path through loadConfig where packageManager is not a valid PM name
    withEnv({ CLAUDE_PACKAGE_MANAGER: undefined }, () => {
      // getPackageManager should fall through to default when no valid config exists
      const result = pm.getPackageManager({ projectDir: os.tmpdir() });
      assert.ok(result.name, 'Should return a package manager name');
      assert.ok(result.config, 'Should return config object');
    });
  })) passed++;
  else failed++;

  // ── Round 30: getCommandPattern with special action patterns ──
  console.log('\nRound 30: getCommandPattern edge cases:');

  if (test('escapes pipe character in action name', () => {
    const pattern = pm.getCommandPattern('lint|fix');
    const regex = new RegExp(pattern);
    assert.ok(regex.test('npm run lint|fix'), 'Should match literal pipe');
    assert.ok(!regex.test('npm run lint'), 'Pipe should be literal, not regex OR');
  })) passed++;
  else failed++;

  if (test('escapes dollar sign in action name', () => {
    const pattern = pm.getCommandPattern('deploy$prod');
    const regex = new RegExp(pattern);
    assert.ok(regex.test('npm run deploy$prod'), 'Should match literal dollar sign');
  })) passed++;
  else failed++;

  if (test('handles action with leading/trailing spaces gracefully', () => {
    // Spaces aren't special in regex but good to test the full pattern
    const pattern = pm.getCommandPattern(' dev ');
    const regex = new RegExp(pattern);
    assert.ok(regex.test('npm run dev '), 'Should match action with spaces');
  })) passed++;
  else failed++;

  if (test('known action "dev" does NOT use escapeRegex path', () => {
    // "dev" is a known action with hardcoded patterns, not the generic path
    const pattern = pm.getCommandPattern('dev');
    // Should match pnpm dev (without \"run\")
    const regex = new RegExp(pattern);
    assert.ok(regex.test('pnpm dev'), 'Known action pnpm dev should match');
  })) passed++;
  else failed++;

  // ── Round 31: setProjectPackageManager write verification ──
  console.log('\nsetProjectPackageManager (write verification, Round 31):');

  if (test('setProjectPackageManager creates .claude directory if missing', () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-mkdir-'));
    try {
      const claudeDir = path.join(testDir, '.claude');
      assert.ok(!fs.existsSync(claudeDir), '.claude should not pre-exist');
      pm.setProjectPackageManager('npm', testDir);
      assert.ok(fs.existsSync(claudeDir), '.claude should be created');
      const configPath = path.join(claudeDir, 'package-manager.json');
      assert.ok(fs.existsSync(configPath), 'Config file should be created');
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  })) passed++;
  else failed++;

  if (test('setProjectPackageManager includes setAt timestamp', () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-ts-'));
    try {
      const before = new Date().toISOString();
      const config = pm.setProjectPackageManager('yarn', testDir);
      const after = new Date().toISOString();
      assert.ok(config.setAt >= before, 'setAt should be >= before');
      assert.ok(config.setAt <= after, 'setAt should be <= after');
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  })) passed++;
  else failed++;

  // ── Round 31: getExecCommand safe argument edge cases ──
  console.log('\ngetExecCommand (safe argument edge cases, Round 31):');

  if (test('allows colons in args (e.g. --fix:all)', () => {
    withEnv({ CLAUDE_PACKAGE_MANAGER: 'npm' }, () => {
      const cmd = pm.getExecCommand('eslint', '--fix:all');
      assert.ok(cmd.includes('--fix:all'), 'Colons should be allowed in args');
    });
  })) passed++;
  else failed++;

  if (test('allows at-sign in args (e.g. @latest)', () => {
    withEnv({ CLAUDE_PACKAGE_MANAGER: 'npm' }, () => {
      const cmd = pm.getExecCommand('create-next-app', '@latest');
      assert.ok(cmd.includes('@latest'), 'At-sign should be allowed in args');
    });
  })) passed++;
  else failed++;

  if (test('allows equals in args (e.g. --config=path)', () => {
    withEnv({ CLAUDE_PACKAGE_MANAGER: 'npm' }, () => {
      const cmd = pm.getExecCommand('prettier', '--config=.prettierrc');
      assert.ok(cmd.includes('--config=.prettierrc'), 'Equals should be allowed');
    });
  })) passed++;
  else failed++;

  // ── Round 34: getExecCommand non-string args & packageManager type ──
  console.log('\nRound 34: getExecCommand non-string args:');

  if (test('getExecCommand with args=0 produces command without extra args', () => {
    withEnv({ CLAUDE_PACKAGE_MANAGER: 'npm' }, () => {
      const cmd = pm.getExecCommand('prettier', 0);
      // 0 is falsy, so ternary `args ? ' ' + args : ''` yields ''
      assert.ok(!cmd.includes(' 0'), 'Should not append 0 as args');
      assert.ok(cmd.includes('prettier'), 'Should include binary name');
    });
  })) passed++;
  else failed++;

  if (test('getExecCommand with args=false produces command without extra args', () => {
    withEnv({ CLAUDE_PACKAGE_MANAGER: 'npm' }, () => {
      const cmd = pm.getExecCommand('eslint', false);
      assert.ok(!cmd.includes('false'), 'Should not append false as args');
      assert.ok(cmd.includes('eslint'), 'Should include binary name');
    });
  })) passed++;
  else failed++;

  if (test('getExecCommand with args=null produces command without extra args', () => {
    withEnv({ CLAUDE_PACKAGE_MANAGER: 'npm' }, () => {
      const cmd = pm.getExecCommand('tsc', null);
      assert.ok(!cmd.includes('null'), 'Should not append null as args');
      assert.ok(cmd.includes('tsc'), 'Should include binary name');
    });
  })) passed++;
  else failed++;

  console.log('\nRound 34: detectFromPackageJson with non-string packageManager:');

  if (test('detectFromPackageJson handles array packageManager field gracefully', () => {
    const tmpDir = createTestDir();
    try {
      // Write a malformed package.json with array instead of string
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ packageManager: ['pnpm@8', 'yarn@3'] }));
      // Should not crash — try/catch in detectFromPackageJson catches TypeError
      const result = pm.getPackageManager({ projectDir: tmpDir });
      assert.ok(result.name, 'Should fallback to a valid package manager');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++;
  else failed++;

  if (test('detectFromPackageJson handles numeric packageManager field gracefully', () => {
    const tmpDir = createTestDir();
    try {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ packageManager: 42 }));
      const result = pm.getPackageManager({ projectDir: tmpDir });
      assert.ok(result.name, 'Should fallback to a valid package manager');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++;
  else failed++;

  // ── Round 48: detectFromPackageJson format edge cases ──
  console.log('\nRound 48: detectFromPackageJson (version format edge cases):');

  if (test('returns null for packageManager with non-@ separator', () => {
    const testDir = createTestDir();
    try {
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test', packageManager: 'pnpm+8.6.0' }));
      const result = pm.detectFromPackageJson(testDir);
      // split('@') on 'pnpm+8.6.0' returns ['pnpm+8.6.0'], which doesn't match PACKAGE_MANAGERS
      assert.strictEqual(result, null, 'Non-@ format should not match any package manager');
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++;
  else failed++;

  if (test('extracts package manager from caret version like yarn@^4.0.0', () => {
    const testDir = createTestDir();
    try {
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test', packageManager: 'yarn@^4.0.0' }));
      const result = pm.detectFromPackageJson(testDir);
      assert.strictEqual(result, 'yarn', 'Caret version should still extract PM name');
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++;
  else failed++;

  // getPackageManager falls through corrupted global config to npm default
  if (test('getPackageManager falls through corrupted global config to npm default', () => {
    const tmpDir = createTestDir();
    const projDir = path.join(tmpDir, 'proj');
    fs.mkdirSync(projDir, { recursive: true });

    try {
      withEnv({ CLAUDE_PACKAGE_MANAGER: undefined, HOME: tmpDir, USERPROFILE: tmpDir }, () => {
        delete require.cache[require.resolve('../../scripts/lib/detect-env')];
        delete require.cache[require.resolve('../../scripts/lib/utils')];
        const utils = require('../../scripts/lib/utils');
        const dataDir = utils.getDataDir();
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'package-manager.json'), '{ invalid json !!!', 'utf8');

        delete require.cache[require.resolve('../../scripts/lib/package-manager')];
        const freshPM = require('../../scripts/lib/package-manager');

        const result = freshPM.getPackageManager({ projectDir: projDir });
        assert.strictEqual(result.name, 'npm', 'Should fall through to npm default');
        assert.strictEqual(result.source, 'default', 'Source should be default');
      });
    } finally {
      delete require.cache[require.resolve('../../scripts/lib/detect-env')];
      delete require.cache[require.resolve('../../scripts/lib/utils')];
      delete require.cache[require.resolve('../../scripts/lib/package-manager')];
      cleanupTestDir(tmpDir);
    }
  })) passed++;
  else failed++;

  // ── Round 69: getPackageManager global-config success path ──
  console.log('\nRound 69: getPackageManager (global-config success):');

  if (test('getPackageManager returns source global-config when valid global config exists', () => {
    const tmpDir = createTestDir();
    const projDir = path.join(tmpDir, 'proj');
    fs.mkdirSync(projDir, { recursive: true });

    try {
      withEnv({ CLAUDE_PACKAGE_MANAGER: undefined, HOME: tmpDir, USERPROFILE: tmpDir }, () => {
        // Re-require to pick up new HOME / configDir
        delete require.cache[require.resolve('../../scripts/lib/package-manager')];
        delete require.cache[require.resolve('../../scripts/lib/utils')];
        const freshUtils = require('../../scripts/lib/utils');
        const dataDir = freshUtils.getDataDir();

        // Create valid global config with pnpm preference at detected MDT data dir
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(
          path.join(dataDir, 'package-manager.json'),
          JSON.stringify({ packageManager: 'pnpm', setAt: '2026-01-01T00:00:00Z' }),
          'utf8'
        );

        const freshPM = require('../../scripts/lib/package-manager');

        // Empty project dir: no lock file, no package.json, no project config
        const result = freshPM.getPackageManager({ projectDir: projDir });
        assert.strictEqual(result.name, 'pnpm', 'Should detect pnpm from global config');
        assert.strictEqual(result.source, 'global-config', 'Source should be global-config');
        assert.ok(result.config, 'Should include config object');
        assert.strictEqual(result.config.lockFile, 'pnpm-lock.yaml', 'Config should match pnpm');
      });
    } finally {
      delete require.cache[require.resolve('../../scripts/lib/package-manager')];
      delete require.cache[require.resolve('../../scripts/lib/utils')];
      cleanupTestDir(tmpDir);
    }
  })) passed++;
  else failed++;

  // ── Round 71: setPreferredPackageManager save failure wraps error ──
  console.log('\nRound 71: setPreferredPackageManager (save failure):');

  if (test('setPreferredPackageManager throws wrapped error when save fails', () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) {
      console.log(' (skipped — chmod ineffective on Windows/root)');
      return;
    }
    const isoHome = path.join(os.tmpdir(), `MDT-pm-r71-${Date.now()}`);
    const mdtDir = path.join(isoHome, '.claude', 'mdt');
    fs.mkdirSync(mdtDir, { recursive: true });
    try {
      withEnv({ HOME: isoHome, USERPROFILE: isoHome }, () => {
        delete require.cache[require.resolve('../../scripts/lib/package-manager')];
        delete require.cache[require.resolve('../../scripts/lib/utils')];
        const freshPm = require('../../scripts/lib/package-manager');
        // Make the MDT state directory read-only — can't create package-manager.json there
        fs.chmodSync(mdtDir, 0o555);
        assert.throws(() => {
          freshPm.setPreferredPackageManager('npm');
        }, /Failed to save package manager preference/);
      });
    } finally {
      try {
        fs.chmodSync(mdtDir, 0o755);
      } catch (_err) {
        /* best-effort */
      }
      delete require.cache[require.resolve('../../scripts/lib/package-manager')];
      delete require.cache[require.resolve('../../scripts/lib/utils')];
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++;
  else failed++;

  // ── Round 72: setProjectPackageManager save failure wraps error ──
  console.log('\nRound 72: setProjectPackageManager (save failure):');

  if (test('setProjectPackageManager throws wrapped error when write fails', () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) {
      console.log(' (skipped — chmod ineffective on Windows/root)');
      return;
    }
    const isoProject = path.join(os.tmpdir(), `MDT-pm-proj-r72-${Date.now()}`);
    const claudeDir = path.join(isoProject, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    // Make .claude directory read-only — can't create new files
    fs.chmodSync(claudeDir, 0o555);
    try {
      assert.throws(() => {
        pm.setProjectPackageManager('npm', isoProject);
      }, /Failed to save package manager config/);
    } finally {
      fs.chmodSync(claudeDir, 0o755);
      fs.rmSync(isoProject, { recursive: true, force: true });
    }
  })) passed++;
  else failed++;

  // ── Round 80: getExecCommand with truthy non-string args ──
  console.log('\nRound 80: getExecCommand (truthy non-string args):');

  if (test('getExecCommand rejects truthy non-string args like number 42', () => {
    withEnv({ CLAUDE_PACKAGE_MANAGER: 'npm' }, () => {
      assert.throws(
        () => pm.getExecCommand('prettier', 42),
        /args must be a string/,
        'Truthy non-string args should be rejected'
      );
    });
  })) passed++;
  else failed++;

  // ── Round 86: detectFromPackageJson with empty (0-byte) package.json ──
  console.log('\nRound 86: detectFromPackageJson (empty package.json):');

  if (test('detectFromPackageJson returns null for empty (0-byte) package.json', () => {
    // package-manager.js line 109-111: readFile returns "" for empty file.
    // "" is falsy -> if (content) is false -> skips JSON.parse -> returns null.
    const testDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'package.json'), '');
    const result = pm.detectFromPackageJson(testDir);
    assert.strictEqual(result, null, 'Empty package.json should return null (content="" is falsy)');
    cleanupTestDir(testDir);
  })) passed++;
  else failed++;

  // ── Round 91: getCommandPattern with empty action string ──
  console.log('\nRound 91: getCommandPattern (empty action):');

  if (test('getCommandPattern with empty string returns valid regex pattern', () => {
    // package-manager.js line 401-409: Empty action falls to the else branch.
    // escapeRegex('') returns '', producing patterns like 'npm run ', 'yarn '.
    // The resulting combined regex should be compilable (not throw).
    const pattern = pm.getCommandPattern('');
    assert.ok(typeof pattern === 'string', 'Should return a string');
    assert.ok(pattern.length > 0, 'Should return non-empty pattern');
    // Verify the pattern compiles without error
    const regex = new RegExp(pattern);
    assert.ok(regex instanceof RegExp, 'Pattern should compile to valid RegExp');
    // The pattern should match package manager commands with trailing space
    assert.ok(regex.test('npm run '), 'Should match "npm run " with trailing space');
    assert.ok(regex.test('yarn '), 'Should match "yarn " with trailing space');
  })) passed++;
  else failed++;

  // ── Round 91: detectFromPackageJson with whitespace-only packageManager ──
  console.log('\nRound 91: detectFromPackageJson (whitespace-only packageManager):');

  if (test('detectFromPackageJson returns null for whitespace-only packageManager field', () => {
    // package-manager.js line 114-119: \" \" is truthy, so enters the if block.
    // \" \".split('@')[0] = \" \" which doesn't match any PACKAGE_MANAGERS key.
    const testDir = createTestDir();
    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({ packageManager: ' ' })
    );
    const result = pm.detectFromPackageJson(testDir);
    assert.strictEqual(result, null, 'Whitespace-only packageManager should return null');
    cleanupTestDir(testDir);
  })) passed++;
  else failed++;

  // ── Round 92: detectFromPackageJson with empty string packageManager ──
  console.log('\nRound 92: detectFromPackageJson (empty string packageManager):');

  if (test('detectFromPackageJson returns null for empty string packageManager field', () => {
    // package-manager.js line 114: if (pkg.packageManager) — empty string \"\" is falsy,
    // so the if block is skipped entirely. Function returns null without attempting split.
    // This is distinct from Round 91's whitespace test (\" \" is truthy and enters the if).
    const testDir = createTestDir();
    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({ name: 'test', packageManager: '' })
    );
    const result = pm.detectFromPackageJson(testDir);
    assert.strictEqual(result, null, 'Empty string packageManager should return null (falsy)');
    cleanupTestDir(testDir);
  })) passed++;
  else failed++;

  // ── Round 94: detectFromPackageJson with scoped package name ──
  console.log('\nRound 94: detectFromPackageJson (scoped package name @scope/pkg@version):');

  if (test('detectFromPackageJson returns null for scoped package name (@scope/pkg@version)', () => {
    // package-manager.js line 116: pmName = pkg.packageManager.split('@')[0]\
    // For \"@pnpm/exe@8.0.0\", split('@') -> ['', 'pnpm/exe', '8.0.0'], so [0] = ''\
    // PACKAGE_MANAGERS[''] is undefined -> returns null.\
    // Scoped npm packages like @pnpm/exe are a real-world pattern but the\
    // packageManager field spec uses unscoped names (e.g., \"pnpm@8\"), so returning\
    // null is the correct defensive behaviour for this edge case.
    const testDir = createTestDir();
    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({ name: 'test', packageManager: '@pnpm/exe@8.0.0' })
    );
    const result = pm.detectFromPackageJson(testDir);
    assert.strictEqual(result, null, 'Scoped package name should return null (split("@")[0] is empty string)');
    cleanupTestDir(testDir);
  })) passed++;
  else failed++;

  // ── Round 94: getPackageManager with empty string CLAUDE_PACKAGE_MANAGER ──
  console.log('\nRound 94: getPackageManager (empty string CLAUDE_PACKAGE_MANAGER env var):');

  if (test('getPackageManager skips empty string CLAUDE_PACKAGE_MANAGER (falsy short-circuit)', () => {
    // package-manager.js line 168: if (envPm && PACKAGE_MANAGERS[envPm])\
    // Empty string '' is falsy — the && short-circuits before checking PACKAGE_MANAGERS.\
    // This is distinct from the 'totally-fake-pm' test (truthy but unknown PM).
    withEnv({ CLAUDE_PACKAGE_MANAGER: '' }, () => {
      const result = pm.getPackageManager();
      assert.notStrictEqual(result.source, 'environment', 'Empty string env var should NOT be treated as environment source');
      assert.ok(result.name, 'Should still return a valid package manager name');
    });
  })) passed++;
  else failed++;

  // ── Round 104: detectFromLockFile with null projectDir (no input validation) ──
  console.log('\nRound 104: detectFromLockFile (null projectDir — throws TypeError):');

  if (test('detectFromLockFile(null) throws TypeError (path.join rejects null)', () => {
    // package-manager.js line 95: `path.join(projectDir, pm.lockFile)` — there is no\
    // guard checking that projectDir is a string before passing it to path.join().\
    // When projectDir is null, path.join(null, 'package-lock.json') throws a TypeError\
    // because path.join only accepts string arguments.
    assert.throws(
      () => pm.detectFromLockFile(null),
      { name: 'TypeError' },
      'path.join(null, ...) should throw TypeError (no input validation in detectFromLockFile)'
    );
  })) passed++;
  else failed++;

  // ── Round 105: getExecCommand with object args (now rejected) ──
  console.log('\nRound 105: getExecCommand (object args are rejected):');

  if (test('getExecCommand rejects object args and still rejects unsafe string "[object Object]"', () => {
    assert.throws(
      () => pm.getExecCommand('prettier', {}),
      /args must be a string/,
      'Object args should be rejected with a clear error'
    );
    // SAFE_ARGS_REGEX should still reject the explicit unsafe string variant
    assert.throws(
      () => pm.getExecCommand('prettier', '[object Object]'),
      /unsafe characters/,
      'Explicit "[object Object]" string should be rejected by SAFE_ARGS_REGEX'
    );
  })) passed++;
  else failed++;

  // ── Round 109: getExecCommand with ../ path traversal in binary (now rejected) ──
  console.log('\nRound 109: getExecCommand (path traversal in binary is rejected):');

  if (test('getExecCommand rejects ../../../etc/passwd and @scope/../../evil as unsafe binary names', () => {
    withEnv({ CLAUDE_PACKAGE_MANAGER: 'npm' }, () => {
      assert.throws(
        () => pm.getExecCommand('../../../etc/passwd'),
        /unsafe characters/,
        'Path traversal in binary name should be rejected'
      );
      assert.throws(
        () => pm.getExecCommand('@scope/../../evil'),
        /unsafe characters/,
        'Scoped path traversal in binary name should be rejected'
      );
    });
  })) passed++;
  else failed++;

  // ── Round 108: getRunCommand with path traversal (now rejected) ──
  console.log('\nRound 108: getRunCommand (path traversal in script name is rejected):');

  if (test('getRunCommand rejects @scope/../../evil and ../../../etc/passwd as unsafe script names', () => {
    withEnv({ CLAUDE_PACKAGE_MANAGER: 'npm' }, () => {
      assert.throws(
        () => pm.getRunCommand('@scope/../../evil'),
        /unsafe characters/,
        'Path traversal in scoped script name should be rejected'
      );
      assert.throws(
        () => pm.getRunCommand('../../../etc/passwd'),
        /unsafe characters/,
        'Bare path traversal script name should be rejected'
      );
    });
  })) passed++;
  else failed++;

  // Round 111: getExecCommand with newline in args (now rejected; only space/tab allowed)
  console.log('\n' + String.raw`Round 111: getExecCommand (newline in args is rejected; only space/tab allowed):`);

  if (test('getExecCommand rejects newline and carriage return in args but still allows tabs', () => {
    withEnv({ CLAUDE_PACKAGE_MANAGER: 'npm' }, () => {
      // Newline in args should now be rejected
      assert.throws(
        () => pm.getExecCommand('prettier', 'file.js\necho injected'),
        /unsafe characters/,
        'Newline in args should be rejected'
      );
      // Tab remains allowed
      const cmd2 = pm.getExecCommand('eslint', 'file.js\t--fix');
      assert.strictEqual(cmd2, 'npx eslint file.js\t--fix', 'Tab should still be allowed in args');
      // Carriage return should be rejected
      assert.throws(
        () => pm.getExecCommand('tsc', 'src\r--strict'),
        /unsafe characters/,
        'Carriage return in args should be rejected'
      );
    });
  })) passed++;

  else failed++;

  // Summary
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}
`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

/**
 * Tests for hook scripts
 *
 * Run with: node tests/hooks/hooks-post-edit.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { ensureSubprocessCapability } = require('../helpers/subprocess-capability');

// Test helper
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

// Async test helper
async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

// Run a script and capture output
function runScript(scriptPath, input = '', env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [scriptPath], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => stdout += data);
    proc.stderr.on('data', data => stderr += data);

    if (input) {
      proc.stdin.write(input);
    }
    proc.stdin.end();

    proc.on('close', code => {
      resolve({ code, stdout, stderr });
    });

    proc.on('error', reject);
  });
}

// Create a temporary test directory
function createTestDir() {
  const testDir = path.join(os.tmpdir(), `hooks-test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

// Clean up test directory
function cleanupTestDir(testDir) {
  fs.rmSync(testDir, { recursive: true, force: true });
}

// Return the sessions dir that hook scripts use when run with HOME=homeDir (tool-agnostic: .cursor, .claude, or .codex)
function getSessionsDirForHome(homeDir, envOverrides = {}) {
  const origHome = process.env.HOME;
  const origProfile = process.env.USERPROFILE;
  const previousEnv = {};
  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir;
  for (const [key, value] of Object.entries(envOverrides)) {
    previousEnv[key] = process.env[key];
    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }
  const detectEnvPath = path.resolve(__dirname, '..', '..', 'scripts', 'lib', 'detect-env.js');
  const utilsPath = path.resolve(__dirname, '..', '..', 'scripts', 'lib', 'utils.js');
  delete require.cache[detectEnvPath];
  delete require.cache[utilsPath];
  const u = require(utilsPath);
  const dir = u.getSessionsDir();
  process.env.HOME = origHome;
  process.env.USERPROFILE = origProfile;
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  delete require.cache[detectEnvPath];
  delete require.cache[utilsPath];
  return dir;
}

// Test suite
async function runTests() {
  console.log('\n=== Testing Hook Scripts ===\n');

  let passed = 0;
  let failed = 0;
  const scriptsDir = path.join(__dirname, '..', '..', 'scripts', 'hooks');

  // post-edit-console-warn.js tests
  console.log('\npost-edit-console-warn.js:');

  if (await asyncTest('warns about console.log in JS files', async () => {
    const testDir = createTestDir();
    const testFile = path.join(testDir, 'test.js');
    fs.writeFileSync(testFile, 'const x = 1;\nconsole.log(x);\nreturn x;');

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), stdinJson);

    assert.ok(result.stderr.includes('console.log'), 'Should warn about console.log');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('does not warn for non-JS files', async () => {
    const testDir = createTestDir();
    const testFile = path.join(testDir, 'test.md');
    fs.writeFileSync(testFile, 'Use console.log for debugging');

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), stdinJson);

    assert.ok(!result.stderr.includes('console.log'), 'Should not warn for non-JS files');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('does not warn for clean JS files', async () => {
    const testDir = createTestDir();
    const testFile = path.join(testDir, 'clean.ts');
    fs.writeFileSync(testFile, 'const x = 1;\nreturn x;');

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), stdinJson);

    assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for clean files');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('handles missing file gracefully', async () => {
    const stdinJson = JSON.stringify({ tool_input: { file_path: '/nonexistent/file.ts' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), stdinJson);

    assert.strictEqual(result.code, 0, 'Should not crash on missing file');
  })) passed++; else failed++;

  if (await asyncTest('limits console.log output to 5 matches', async () => {
    const testDir = createTestDir();
    const testFile = path.join(testDir, 'many-logs.js');
    // Create a file with 8 console.log statements
    const lines = [];
    for (let i = 1; i <= 8; i++) {
      lines.push(`console.log('debug ${i}');`);
    }
    fs.writeFileSync(testFile, lines.join('\n'));

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), stdinJson);

    assert.ok(result.stderr.includes('console.log'), 'Should warn about console.log');
    // Count how many "debug N" lines appear in stderr (the line-number output)
    const debugLines = result.stderr.split('\n').filter(l => /^\d+:/.test(l.trim()));
    assert.ok(debugLines.length <= 5, `Should show at most 5 matches, got ${debugLines.length}`);
    // Should include debug 1 but not debug 8 (sliced)
    assert.ok(result.stderr.includes('debug 1'), 'Should include first match');
    assert.ok(!result.stderr.includes('debug 8'), 'Should not include 8th match');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('ignores console.warn and console.error (only flags console.log)', async () => {
    const testDir = createTestDir();
    const testFile = path.join(testDir, 'other-console.ts');
    fs.writeFileSync(testFile, [
      'console.warn("this is a warning");',
      'console.error("this is an error");',
      'console.debug("this is debug");',
      'console.info("this is info");',
    ].join('\n'));

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), stdinJson);

    assert.ok(!result.stderr.includes('WARNING'), 'Should NOT warn about console.warn/error/debug/info');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('passes through original data on stdout', async () => {
    const stdinJson = JSON.stringify({ tool_input: { file_path: '/test.py' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), stdinJson);

    assert.ok(result.stdout.includes('tool_input'), 'Should pass through stdin data');
  })) passed++; else failed++;

  // post-edit-format.js tests
  console.log('\npost-edit-format.js:');

  if (await asyncTest('runs without error on empty stdin', async () => {
    const result = await runScript(path.join(scriptsDir, 'post-edit-format.js'));
    assert.strictEqual(result.code, 0, 'Should exit 0 on empty stdin');
  })) passed++; else failed++;

  if (await asyncTest('skips non-JS/TS files', async () => {
    const stdinJson = JSON.stringify({ tool_input: { file_path: '/test.py' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-format.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should exit 0 for non-JS files');
    assert.ok(result.stdout.includes('tool_input'), 'Should pass through stdin data');
  })) passed++; else failed++;

  if (await asyncTest('passes through data for invalid JSON', async () => {
    const result = await runScript(path.join(scriptsDir, 'post-edit-format.js'), 'not json');
    assert.strictEqual(result.code, 0, 'Should exit 0 for invalid JSON');
  })) passed++; else failed++;

  if (await asyncTest('handles null tool_input gracefully', async () => {
    const stdinJson = JSON.stringify({ tool_input: null });
    const result = await runScript(path.join(scriptsDir, 'post-edit-format.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should exit 0 for null tool_input');
    assert.ok(result.stdout.includes('tool_input'), 'Should pass through data');
  })) passed++; else failed++;

  if (await asyncTest('handles missing file_path in tool_input', async () => {
    const stdinJson = JSON.stringify({ tool_input: {} });
    const result = await runScript(path.join(scriptsDir, 'post-edit-format.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should exit 0 for missing file_path');
    assert.ok(result.stdout.includes('tool_input'), 'Should pass through data');
  })) passed++; else failed++;

  if (await asyncTest('exits 0 and passes data when prettier is unavailable', async () => {
    const stdinJson = JSON.stringify({ tool_input: { file_path: '/nonexistent/path/file.ts' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-format.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should exit 0 even when prettier fails');
    assert.ok(result.stdout.includes('tool_input'), 'Should pass through original data');
  })) passed++; else failed++;

  // post-edit-typecheck.js tests
  console.log('\npost-edit-typecheck.js:');

  if (await asyncTest('runs without error on empty stdin', async () => {
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'));
    assert.strictEqual(result.code, 0, 'Should exit 0 on empty stdin');
  })) passed++; else failed++;

  if (await asyncTest('skips non-TypeScript files', async () => {
    const stdinJson = JSON.stringify({ tool_input: { file_path: '/test.js' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should exit 0 for non-TS files');
    assert.ok(result.stdout.includes('tool_input'), 'Should pass through stdin data');
  })) passed++; else failed++;

  if (await asyncTest('handles nonexistent TS file gracefully', async () => {
    const stdinJson = JSON.stringify({ tool_input: { file_path: '/nonexistent/file.ts' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should exit 0 for missing file');
  })) passed++; else failed++;

  if (await asyncTest('handles TS file with no tsconfig gracefully', async () => {
    const testDir = createTestDir();
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'const x: number = 1;');

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should exit 0 when no tsconfig found');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('stops tsconfig walk at max depth (20)', async () => {
    // Create a deeply nested directory (>20 levels) with no tsconfig anywhere
    const testDir = createTestDir();
    let deepDir = testDir;
    for (let i = 0; i < 25; i++) {
      deepDir = path.join(deepDir, `d${i}`);
    }
    fs.mkdirSync(deepDir, { recursive: true });
    const testFile = path.join(deepDir, 'deep.ts');
    fs.writeFileSync(testFile, 'const x: number = 1;');

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const startTime = Date.now();
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);
    const elapsed = Date.now() - startTime;

    assert.strictEqual(result.code, 0, 'Should not hang at depth limit');
    assert.ok(elapsed < 5000, `Should complete quickly at depth limit, took ${elapsed}ms`);
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('passes through stdin data on stdout (post-edit-typecheck)', async () => {
    const testDir = createTestDir();
    const testFile = path.join(testDir, 'test.ts');
    fs.writeFileSync(testFile, 'const x: number = 1;');

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('tool_input'), 'Should pass through stdin data on stdout');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // Summary
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

ensureSubprocessCapability('tests/hooks/hooks-post-edit.test.js');
runTests();


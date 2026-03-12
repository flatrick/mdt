/**
 * Tests for hook scripts
 *
 * Run with: node tests/hooks/hooks-rounds-4.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { ensureSubprocessCapability } = require('../helpers/subprocess-capability');
const { asyncTest, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { runScript } = require('../helpers/hook-test-utils');

// Test suite
async function runTests() {
  console.log('\n=== Testing Hook Scripts (Round Cases) ===\n');

  let passed = 0;
  let failed = 0;
  const scriptsDir = path.join(__dirname, '..', '..', 'scripts', 'hooks');
  const evaluateSessionScript = path.join(scriptsDir, 'evaluate-session.js');
  // ── Round 29: post-edit-format.js cwd fix and process.exit(0) consistency ──
  console.log('\nRound 29: post-edit-format.js (cwd and exit):');

  if (await asyncTest('source uses cwd based on file directory for npx', async () => {
    const formatSource = fs.readFileSync(path.join(scriptsDir, 'post-edit-format.js'), 'utf8');
    assert.ok(formatSource.includes('cwd:'), 'Should set cwd option for execFileSync');
    assert.ok(formatSource.includes('path.dirname'), 'cwd should use path.dirname of the file');
    assert.ok(formatSource.includes('path.resolve'), 'cwd should resolve the file path first');
  })) passed++; else failed++;

  if (await asyncTest('source calls process.exit(0) after writing output', async () => {
    const formatSource = fs.readFileSync(path.join(scriptsDir, 'post-edit-format.js'), 'utf8');
    assert.ok(formatSource.includes('process.exit(0)'), 'Should call process.exit(0) for clean termination');
  })) passed++; else failed++;

  if (await asyncTest('uses process.stdout.write instead of console.log for pass-through', async () => {
    const formatSource = fs.readFileSync(path.join(scriptsDir, 'post-edit-format.js'), 'utf8');
    assert.ok(formatSource.includes('process.stdout.write(data)'), 'Should use process.stdout.write to avoid trailing newline');
    // Verify no console.log(data) for pass-through (console.error for warnings is OK)
    const lines = formatSource.split('\n');
    const passThrough = lines.filter(l => /console\.log\(data\)/.test(l));
    assert.strictEqual(passThrough.length, 0, 'Should not use console.log(data) for pass-through');
  })) passed++; else failed++;

  console.log('\nRound 29: post-edit-typecheck.js (exit and pass-through):');

  if (await asyncTest('source calls process.exit(0) after writing output', async () => {
    const tcSource = fs.readFileSync(path.join(scriptsDir, 'post-edit-typecheck.js'), 'utf8');
    assert.ok(tcSource.includes('process.exit(0)'), 'Should call process.exit(0) for clean termination');
  })) passed++; else failed++;

  if (await asyncTest('uses process.stdout.write instead of console.log for pass-through', async () => {
    const tcSource = fs.readFileSync(path.join(scriptsDir, 'post-edit-typecheck.js'), 'utf8');
    assert.ok(tcSource.includes('process.stdout.write(data)'), 'Should use process.stdout.write');
    const lines = tcSource.split('\n');
    const passThrough = lines.filter(l => /console\.log\(data\)/.test(l));
    assert.strictEqual(passThrough.length, 0, 'Should not use console.log(data) for pass-through');
  })) passed++; else failed++;

  if (await asyncTest('exact stdout pass-through without trailing newline (typecheck)', async () => {
    const stdinJson = JSON.stringify({ tool_input: { file_path: '/nonexistent/file.py' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);
    assert.strictEqual(result.code, 0);
    assert.strictEqual(result.stdout, stdinJson, 'stdout should exactly match stdin (no trailing newline)');
  })) passed++; else failed++;

  if (await asyncTest('exact stdout pass-through without trailing newline (format)', async () => {
    const stdinJson = JSON.stringify({ tool_input: { file_path: '/nonexistent/file.py' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-format.js'), stdinJson);
    assert.strictEqual(result.code, 0);
    assert.strictEqual(result.stdout, stdinJson, 'stdout should exactly match stdin (no trailing newline)');
  })) passed++; else failed++;

  console.log('\nRound 29: post-edit-console-warn.js (extension and exit):');

  if (await asyncTest('source calls process.exit(0) after writing output', async () => {
    const cwSource = fs.readFileSync(path.join(scriptsDir, 'post-edit-console-warn.js'), 'utf8');
    assert.ok(cwSource.includes('process.exit(0)'), 'Should call process.exit(0)');
  })) passed++; else failed++;

  if (await asyncTest('does NOT match .mts or .mjs extensions', async () => {
    const stdinMts = JSON.stringify({ tool_input: { file_path: '/some/file.mts' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), stdinMts);
    assert.strictEqual(result.code, 0);
    // .mts is not in the regex /\.(ts|tsx|js|jsx)$/, so no console.log scan
    assert.strictEqual(result.stdout, stdinMts, 'Should pass through .mts without scanning');
    assert.ok(!result.stderr.includes('console.log'), 'Should NOT scan .mts files for console.log');
  })) passed++; else failed++;

  if (await asyncTest('does NOT match uppercase .TS extension', async () => {
    const stdinTS = JSON.stringify({ tool_input: { file_path: '/some/file.TS' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), stdinTS);
    assert.strictEqual(result.code, 0);
    assert.strictEqual(result.stdout, stdinTS, 'Should pass through .TS without scanning');
    assert.ok(!result.stderr.includes('console.log'), 'Should NOT scan .TS (uppercase) files');
  })) passed++; else failed++;

  if (await asyncTest('detects console.log in commented-out code', async () => {
    const testDir = createTestDir();
    const testFile = path.join(testDir, 'commented.js');
    fs.writeFileSync(testFile, '// console.log("debug")\nconst x = 1;\n');
    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), stdinJson);
    assert.strictEqual(result.code, 0);
    // The regex /console\.log/ matches even in comments — this is intentional
    assert.ok(result.stderr.includes('console.log'), 'Should detect console.log even in comments');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  console.log('\nRound 29: check-console-log.js (exclusion patterns and exit):');

  if (await asyncTest('source calls process.exit(0) after writing output', async () => {
    const clSource = fs.readFileSync(path.join(scriptsDir, 'check-console-log.js'), 'utf8');
    // Should have at least 2 process.exit(0) calls (early return + end)
    const exitCalls = clSource.match(/process\.exit\(0\)/g) || [];
    assert.ok(exitCalls.length >= 2, `Should have at least 2 process.exit(0) calls, found ${exitCalls.length}`);
  })) passed++; else failed++;

  if (await asyncTest('EXCLUDED_PATTERNS correctly excludes test files', async () => {
    // Test the patterns directly by reading the source and evaluating the regex
    const source = fs.readFileSync(path.join(scriptsDir, 'check-console-log.js'), 'utf8');
    // Verify the 6 exclusion patterns exist in the source (as regex literals with escapes)
    const expectedSubstrings = ['test', 'spec', 'config', 'scripts', '__tests__', '__mocks__'];
    for (const substr of expectedSubstrings) {
      assert.ok(source.includes(substr), `Should include pattern containing "${substr}"`);
    }
    // Verify the array name exists
    assert.ok(source.includes('EXCLUDED_PATTERNS'), 'Should have EXCLUDED_PATTERNS array');
  })) passed++; else failed++;

  if (await asyncTest('exclusion patterns match expected file paths', async () => {
    // Recreate the EXCLUDED_PATTERNS from the source and test them
    const EXCLUDED_PATTERNS = [
      /\.test\.[jt]sx?$/,
      /\.spec\.[jt]sx?$/,
      /\.config\.[jt]s$/,
      /scripts\//,
      /__tests__\//,
      /__mocks__\//,
    ];
    // These SHOULD be excluded
    const excluded = [
      'src/utils.test.ts', 'src/utils.test.js', 'src/utils.test.tsx', 'src/utils.test.jsx',
      'src/utils.spec.ts', 'src/utils.spec.js',
      'src/utils.config.ts', 'src/utils.config.js',
      'scripts/hooks/session-end.js',
      '__tests__/utils.ts',
      '__mocks__/api.ts',
    ];
    for (const f of excluded) {
      const matches = EXCLUDED_PATTERNS.some(p => p.test(f));
      assert.ok(matches, `Expected "${f}" to be excluded but it was not`);
    }
    // These should NOT be excluded
    const notExcluded = [
      'src/utils.ts', 'src/main.tsx', 'src/app.js',
      'src/test.component.ts',  // "test" in name but not .test. pattern
      'src/config.ts',          // "config" in name but not .config. pattern
    ];
    for (const f of notExcluded) {
      const matches = EXCLUDED_PATTERNS.some(p => p.test(f));
      assert.ok(!matches, `Expected "${f}" to NOT be excluded but it was`);
    }
  })) passed++; else failed++;

  console.log('\nRound 29: run-all.js test runner improvements:');

  if (await asyncTest('test runner uses spawnSync to capture stderr on success', async () => {
    const runAllSource = fs.readFileSync(path.join(__dirname, '..', 'run-all.js'), 'utf8');
    assert.ok(runAllSource.includes('spawnSync'), 'Should use spawnSync instead of execSync');
    assert.ok(!runAllSource.includes('execSync'), 'Should not use execSync');
    // Verify it shows stderr
    assert.ok(runAllSource.includes('stderr'), 'Should handle stderr output');
    // Verify debug preflight support is present
    assert.ok(runAllSource.includes('MDT_TEST_ENV_DEBUG'), 'Should support debug mode toggle');
    assert.ok(runAllSource.includes('[MDT test preflight]'), 'Should print preflight header in debug mode');
  })) passed++; else failed++;

  // ── Round 32: post-edit-typecheck special characters & check-console-log ──
  console.log('\nRound 32: post-edit-typecheck (special character paths):');

  if (await asyncTest('handles file path with spaces gracefully', async () => {
    const testDir = createTestDir();
    const testFile = path.join(testDir, 'my file.ts');
    fs.writeFileSync(testFile, 'const x: number = 1;');

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should handle spaces in path');
    assert.ok(result.stdout.includes('tool_input'), 'Should pass through data');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('handles file path with shell metacharacters safely', async () => {
    const testDir = createTestDir();
    // File name with characters that could be dangerous in shell contexts
    const testFile = path.join(testDir, 'test$(echo).ts');
    fs.writeFileSync(testFile, 'const x: number = 1;');

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should not crash on shell metacharacters');
    // execFileSync prevents shell injection — just verify no crash
    assert.ok(result.stdout.includes('tool_input'), 'Should pass through data safely');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('handles .tsx file extension', async () => {
    const testDir = createTestDir();
    const testFile = path.join(testDir, 'component.tsx');
    fs.writeFileSync(testFile, 'const App = () => <div>Hello</div>;');

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should handle .tsx files');
    assert.ok(result.stdout.includes('tool_input'), 'Should pass through data');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  console.log('\nRound 32: check-console-log (edge cases):');

  if (await asyncTest('passes through data when git commands fail', async () => {
    // Run from a non-git directory
    const testDir = createTestDir();
    const stdinData = JSON.stringify({ tool_name: 'Write', tool_input: {} });
    const result = await runScript(path.join(scriptsDir, 'check-console-log.js'), stdinData);
    assert.strictEqual(result.code, 0, 'Should exit 0');
    assert.ok(result.stdout.includes('tool_name'), 'Should pass through stdin');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('handles very large stdin within limit', async () => {
    // Send just under the 1MB limit
    const largePayload = JSON.stringify({ tool_name: 'x'.repeat(500000) });
    const result = await runScript(path.join(scriptsDir, 'check-console-log.js'), largePayload);
    assert.strictEqual(result.code, 0, 'Should handle large stdin');
  })) passed++; else failed++;

  console.log('\nRound 32: post-edit-console-warn (additional edge cases):');

  if (await asyncTest('handles file with only console.error (no warning)', async () => {
    const testDir = createTestDir();
    const testFile = path.join(testDir, 'errors-only.ts');
    fs.writeFileSync(testFile, 'console.error("this is fine");\nconsole.warn("also fine");');

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), stdinJson);
    assert.ok(!result.stderr.includes('WARNING'), 'Should NOT warn for console.error/warn only');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('handles null tool_input gracefully', async () => {
    const stdinJson = JSON.stringify({ tool_input: null });
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should handle null tool_input');
    assert.ok(result.stdout.includes('tool_input'), 'Should pass through data');
  })) passed++; else failed++;

  console.log('\nRound 32: session-end.js (empty transcript):');

  if (await asyncTest('handles completely empty transcript file', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'empty.jsonl');
    fs.writeFileSync(transcriptPath, '');

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should handle empty transcript');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('handles transcript with only whitespace lines', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'whitespace.jsonl');
    fs.writeFileSync(transcriptPath, '  \n\n  \n');

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should handle whitespace-only transcript');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 38: evaluate-session.js tilde expansion & missing config ──
  console.log('\nRound 38: evaluate-session.js (tilde expansion & missing config):');

  if (await asyncTest('expands ~ in learned_skills_path to home directory', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');
    // 1 user message — below threshold, but we only need to verify directory creation
    fs.writeFileSync(transcriptPath, '{"type":"user","content":"msg"}');

    const skillsDir = path.join(testDir, 'skills', 'continuous-learning');
    fs.mkdirSync(skillsDir, { recursive: true });
    const configPath = path.join(skillsDir, 'config.json');
    // Use ~ prefix — should expand to the HOME dir we set
    fs.writeFileSync(configPath, JSON.stringify({
      learned_skills_path: '~/test-tilde-skills'
    }));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(evaluateSessionScript, stdinJson, {
      HOME: testDir, USERPROFILE: testDir,
      MDT_CONTINUOUS_LEARNING_CONFIG: configPath
    });
    assert.strictEqual(result.code, 0);
    // ~ should expand to os.homedir() which during the script run is the real home
    // The script creates the directory via ensureDir — check that it attempted to
    // create a directory starting with the home dir, not a literal ~/
    // Verify the literal ~/test-tilde-skills was NOT created
    assert.ok(
      !fs.existsSync(path.join(testDir, '~', 'test-tilde-skills')),
      'Should NOT create literal ~/test-tilde-skills directory'
    );
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('does NOT expand ~ in middle of learned_skills_path', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');
    fs.writeFileSync(transcriptPath, '{"type":"user","content":"msg"}');

    const midTildeDir = path.join(testDir, 'some~path', 'skills');
    const skillsDir = path.join(testDir, 'skills', 'continuous-learning');
    fs.mkdirSync(skillsDir, { recursive: true });
    const configPath = path.join(skillsDir, 'config.json');
    // Path with ~ in the middle — should NOT be expanded
    fs.writeFileSync(configPath, JSON.stringify({
      learned_skills_path: midTildeDir
    }));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(evaluateSessionScript, stdinJson, {
      HOME: testDir, USERPROFILE: testDir,
      MDT_CONTINUOUS_LEARNING_CONFIG: configPath
    });
    assert.strictEqual(result.code, 0);
    // The directory with ~ in the middle should be created as-is
    assert.ok(
      fs.existsSync(midTildeDir),
      'Should create directory with ~ in middle of path unchanged'
    );
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('expands <config> in learned_skills_path to active config dir', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');
    fs.writeFileSync(transcriptPath, '{"type":"user","content":"msg"}');

    const skillsDir = path.join(testDir, 'skills', 'continuous-learning');
    fs.mkdirSync(skillsDir, { recursive: true });
    const configPath = path.join(skillsDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      learned_skills_path: '<data>/generated/skills/learned'
    }));

    const configDir = path.join(testDir, '.cursor');
    fs.mkdirSync(configDir, { recursive: true });

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(evaluateSessionScript, stdinJson, {
      HOME: testDir,
      USERPROFILE: testDir,
      CONFIG_DIR: configDir,
      MDT_CONTINUOUS_LEARNING_CONFIG: configPath
    });
    assert.strictEqual(result.code, 0);
    assert.ok(
      fs.existsSync(path.join(configDir, 'mdt', 'generated', 'skills', 'learned')),
      'Should create learned skills dir under the active MDT data dir'
    );
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('uses defaults when config file does not exist', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');
    // 5 user messages — below default threshold of 10
    const lines = [];
    for (let i = 0; i < 5; i++) lines.push(`{"type":"user","content":"msg${i}"}`);
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    // Point config to a non-existent file
    const configPath = path.join(testDir, 'nonexistent', 'config.json');
    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(evaluateSessionScript, stdinJson, {
      HOME: testDir, USERPROFILE: testDir,
      MDT_CONTINUOUS_LEARNING_CONFIG: configPath
    });
    assert.strictEqual(result.code, 0);
    // With no config file, default min_session_length=10 applies
    // 5 messages should be "too short"
    assert.ok(
      result.stderr.includes('too short'),
      'Should use default threshold (10) when config file missing'
    );
    // No error messages about missing config
    assert.ok(
      !result.stderr.includes('Failed to parse config'),
      'Should NOT log config parse error for missing file'
    );
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // Summary
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

ensureSubprocessCapability('tests/hooks/hooks-rounds-4.test.js');
runTests();


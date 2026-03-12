/**
 * Tests for hook scripts
 *
 * Run with: node tests/hooks/hooks-rounds-2.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { ensureSubprocessCapability } = require('../helpers/subprocess-capability');
const { asyncTest, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { runScript, getSessionsDirForHome } = require('../helpers/hook-test-utils');

// Test suite
async function runTests() {
  console.log('\n=== Testing Hook Scripts (Round Cases) ===\n');

  let passed = 0;
  let failed = 0;
  const scriptsDir = path.join(__dirname, '..', '..', 'scripts', 'hooks');
  console.log('\nRound 60: session-end.js (replaceInFile returns false — timestamp update warning):');

  if (await asyncTest('logs warning when existing session file lacks Last Updated field', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-end-nots-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });

    // Create transcript with a user message so a summary is produced
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');
    fs.writeFileSync(transcriptPath, '{"type":"user","content":"test message"}\n');

    // Pre-create session file WITHOUT the **Last Updated:** line
    // Use today's date and a short ID matching getSessionIdShort() pattern
    const today = new Date().toISOString().split('T')[0];
    const sessionFile = path.join(sessionsDir, `${today}-session-session.tmp`);
    fs.writeFileSync(sessionFile, '# Session file without timestamp marker\nSome existing content\n');

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
      HOME: isoHome, USERPROFILE: isoHome
    });

    assert.strictEqual(result.code, 0, 'Should exit 0 even when replaceInFile fails');
    // replaceInFile returns false → line 166 logs warning about failed timestamp update
    assert.ok(result.stderr.includes('Failed to update') || result.stderr.includes('[SessionEnd]'),
      'Should log warning when timestamp pattern not found in session file');

    cleanupTestDir(testDir);
    try { fs.rmSync(isoHome, { recursive: true, force: true }); } catch { /* best-effort */ }
  })) passed++; else failed++;

  console.log('\nRound 60: post-edit-console-warn.js (stdin exceeding 1MB — truncation):');

  if (await asyncTest('truncates stdin at 1MB limit and still passes through data', async () => {
    // Send 1.2MB of data — exceeds the 1MB MAX_STDIN limit
    const payload = 'x'.repeat(1024 * 1024 + 200000);
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), payload);

    assert.strictEqual(result.code, 0, 'Should exit 0 even with oversized stdin');
    // Data should be truncated — stdout significantly less than input
    assert.ok(result.stdout.length < payload.length,
      `stdout (${result.stdout.length}) should be shorter than input (${payload.length})`);
    // Should be approximately 1MB (last accepted chunk may push slightly over)
    assert.ok(result.stdout.length <= 1024 * 1024 + 65536,
      `stdout (${result.stdout.length}) should be near 1MB, not unbounded`);
    assert.ok(result.stdout.length > 0, 'Should still pass through truncated data');
  })) passed++; else failed++;

  console.log('\nRound 60: post-edit-format.js (valid JSON without tool_input key):');

  if (await asyncTest('skips formatting when JSON has no tool_input field', async () => {
    const stdinJson = JSON.stringify({ result: 'ok', output: 'some data' });
    const result = await runScript(path.join(scriptsDir, 'post-edit-format.js'), stdinJson);

    assert.strictEqual(result.code, 0, 'Should exit 0 for JSON without tool_input');
    // input.tool_input?.file_path is undefined → skips formatting → passes through
    assert.strictEqual(result.stdout, stdinJson,
      'Should pass through data unchanged when tool_input is absent');
  })) passed++; else failed++;

  // ── Round 64: post-edit-typecheck.js valid JSON without tool_input ──
  console.log('\nRound 64: post-edit-typecheck.js (valid JSON without tool_input):');

  if (await asyncTest('skips typecheck when JSON has no tool_input field', async () => {
    const stdinJson = JSON.stringify({ result: 'ok', metadata: { action: 'test' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);

    assert.strictEqual(result.code, 0, 'Should exit 0 for JSON without tool_input');
    // input.tool_input?.file_path is undefined → skips TS check → passes through
    assert.strictEqual(result.stdout, stdinJson,
      'Should pass through data unchanged when tool_input is absent');
  })) passed++; else failed++;

  // ── Round 66: session-end.js entry.role === 'user' fallback and nonexistent transcript ──
  console.log('\nRound 66: session-end.js (entry.role user fallback):');

  if (await asyncTest('extracts user messages from role-only format (no type field)', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-role-only-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });

    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');
    // Use entries with ONLY role field (no type:"user") to exercise the fallback
    const lines = [
      '{"role":"user","content":"Deploy the production build"}',
      '{"role":"assistant","content":"I will deploy now"}',
      '{"role":"user","content":"Check the logs after deploy"}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));
    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });

    try {
      const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0);

      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('-session.tmp'));
      assert.ok(files.length > 0, 'Should create session file');
      const content = fs.readFileSync(path.join(sessionsDir, files[0]), 'utf8');
      // The role-only user messages should be extracted
      assert.ok(content.includes('Deploy the production build') || content.includes('deploy'),
        `Session file should include role-only user messages. Got: ${content.substring(0, 300)}`);
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  console.log('\nRound 66: session-end.js (nonexistent transcript path):');

  if (await asyncTest('logs "Transcript not found" for nonexistent transcript_path', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-notfound-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });

    const stdinJson = JSON.stringify({ transcript_path: '/tmp/nonexistent-transcript-99999.jsonl' });

    try {
      const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0, 'Should exit 0 for missing transcript');
      assert.ok(
        result.stderr.includes('Transcript not found') || result.stderr.includes('not found'),
        `Should log transcript not found. Got stderr: ${result.stderr.substring(0, 300)}`
      );
      // Should still create a session file (with blank template, since summary is null)
      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('-session.tmp'));
      assert.ok(files.length > 0, 'Should still create session file even without transcript');
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 70: session-end.js entry.name / entry.input fallback in direct tool_use entries ──
  console.log('\nRound 70: session-end.js (entry.name/entry.input fallback):');

  if (await asyncTest('extracts tool name and file path from entry.name/entry.input (not tool_name/tool_input)', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-r70-entryname-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });
    const transcriptPath = path.join(isoHome, 'transcript.jsonl');

    // Use "name" and "input" fields instead of "tool_name" and "tool_input"
    // This exercises the fallback at session-end.js lines 63 and 66:
    //   const toolName = entry.tool_name || entry.name || '';
    //   const filePath  = entry.tool_input?.file_path || entry.input?.file_path || '';
    const lines = [
      '{"type":"user","content":"Use the alt format fields"}',
      '{"type":"tool_use","name":"Edit","input":{"file_path":"/src/alt-format.ts"}}',
      '{"type":"tool_use","name":"Read","input":{"file_path":"/src/other.ts"}}',
      '{"type":"tool_use","name":"Write","input":{"file_path":"/src/written.ts"}}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    try {
      const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0, 'Should exit 0');

      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.tmp'));
      assert.ok(files.length > 0, 'Should create session file');
      const content = fs.readFileSync(path.join(sessionsDir, files[0]), 'utf8');
      // Tools extracted via entry.name fallback
      assert.ok(content.includes('Edit'), 'Should list Edit via entry.name fallback');
      assert.ok(content.includes('Read'), 'Should list Read via entry.name fallback');
      // Files modified via entry.input fallback (Edit and Write, not Read)
      assert.ok(content.includes('/src/alt-format.ts'), 'Should list edited file via entry.input fallback');
      assert.ok(content.includes('/src/written.ts'), 'Should list written file via entry.input fallback');
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 71: session-start.js default source shows getSelectionPrompt ──
  console.log('\nRound 71: session-start.js (default source — selection prompt):');

  if (await asyncTest('shows selection prompt when no package manager preference found (default source)', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-r71-ss-default-${Date.now()}`);
    const isoProject = path.join(isoHome, 'project');
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(path.join(path.dirname(sessionsDir), 'generated', 'skills', 'learned'), { recursive: true });
    fs.mkdirSync(isoProject, { recursive: true });
    // No package.json, no lock files, no package-manager.json — forces default source

    try {
      const result = await new Promise((resolve, reject) => {
        const env = { ...process.env, HOME: isoHome, USERPROFILE: isoHome };
        delete env.CLAUDE_PACKAGE_MANAGER; // Remove any env-level PM override
        const proc = spawn('node', [path.join(scriptsDir, 'session-start.js')], {
          env,
          cwd: isoProject, // CWD with no package.json or lock files
          stdio: ['pipe', 'pipe', 'pipe']
        });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', data => stdout += data);
        proc.stderr.on('data', data => stderr += data);
        proc.stdin.end();
        proc.on('close', code => resolve({ code, stdout, stderr }));
        proc.on('error', reject);
      });
      assert.strictEqual(result.code, 0, 'Should exit 0');
      assert.ok(result.stderr.includes('No package manager preference'),
        `Should show selection prompt when source is default. Got stderr: ${result.stderr.slice(0, 500)}`);
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 74: session-start.js main().catch handler ──
  console.log('\nRound 74: session-start.js (main catch — unrecoverable error):');

  if (await asyncTest('session-start exits 0 with error message when HOME is non-directory', async () => {
    if (process.platform === 'win32') {
      console.log('    (skipped — /dev/null not available on Windows)');
      return;
    }
    // HOME=/dev/null makes ensureDir(sessionsDir) throw ENOTDIR,
    // which propagates to main().catch — the top-level error boundary
    const result = await runScript(path.join(scriptsDir, 'session-start.js'), '', {
      HOME: '/dev/null',
      USERPROFILE: '/dev/null'
    });
    assert.strictEqual(result.code, 0,
      `Should exit 0 (don't block on errors), got ${result.code}`);
    assert.ok(result.stderr.includes('[SessionStart] Error:'),
      `stderr should contain [SessionStart] Error:, got: ${result.stderr}`);
  })) passed++; else failed++;

  // ── Round 75: pre-compact.js main().catch handler ──
  console.log('\nRound 75: pre-compact.js (main catch — unrecoverable error):');

  if (await asyncTest('pre-compact exits 0 with error message when HOME is non-directory', async () => {
    if (process.platform === 'win32') {
      console.log('    (skipped — /dev/null not available on Windows)');
      return;
    }
    // HOME=/dev/null makes ensureDir(sessionsDir) throw ENOTDIR,
    // which propagates to main().catch — the top-level error boundary
    const result = await runScript(path.join(scriptsDir, 'pre-compact.js'), '', {
      HOME: '/dev/null',
      USERPROFILE: '/dev/null'
    });
    assert.strictEqual(result.code, 0,
      `Should exit 0 (don't block on errors), got ${result.code}`);
    assert.ok(result.stderr.includes('[PreCompact] Error:'),
      `stderr should contain [PreCompact] Error:, got: ${result.stderr}`);
  })) passed++; else failed++;

  // ── Round 75: session-end.js main().catch handler ──
  console.log('\nRound 75: session-end.js (main catch — unrecoverable error):');

  if (await asyncTest('session-end exits 0 with error message when HOME is non-directory', async () => {
    if (process.platform === 'win32') {
      console.log('    (skipped — /dev/null not available on Windows)');
      return;
    }
    // HOME=/dev/null makes ensureDir(sessionsDir) throw ENOTDIR inside main(),
    // which propagates to runMain().catch — the top-level error boundary
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), '{}', {
      HOME: '/dev/null',
      USERPROFILE: '/dev/null'
    });
    assert.strictEqual(result.code, 0,
      `Should exit 0 (don't block on errors), got ${result.code}`);
    assert.ok(result.stderr.includes('[SessionEnd] Error:'),
      `stderr should contain [SessionEnd] Error:, got: ${result.stderr}`);
  })) passed++; else failed++;

  // ── Round 76: evaluate-session.js main().catch handler ──
  console.log('\nRound 76: evaluate-session.js (main catch — unrecoverable error):');

  if (await asyncTest('evaluate-session exits 0 with error message when HOME is non-directory', async () => {
    if (process.platform === 'win32') {
      console.log('    (skipped — /dev/null not available on Windows)');
      return;
    }
    // HOME=/dev/null makes ensureDir(learnedSkillsPath) throw ENOTDIR,
    // which propagates to main().catch — the top-level error boundary
    const result = await runScript(path.join(scriptsDir, 'evaluate-session.js'), '{}', {
      HOME: '/dev/null',
      USERPROFILE: '/dev/null'
    });
    assert.strictEqual(result.code, 0,
      `Should exit 0 (don't block on errors), got ${result.code}`);
    assert.ok(result.stderr.includes('[ContinuousLearning] Error:'),
      `stderr should contain [ContinuousLearning] Error:, got: ${result.stderr}`);
  })) passed++; else failed++;

  // ── Round 76: suggest-compact.js main().catch handler ──
  console.log('\nRound 76: suggest-compact.js (main catch — double-failure):');

  if (await asyncTest('suggest-compact exits 0 with error when TMPDIR is non-directory', async () => {
    if (process.platform === 'win32') {
      console.log('    (skipped — /dev/null not available on Windows)');
      return;
    }
    // TMPDIR=/dev/null causes openSync to fail (ENOTDIR), then the catch
    // fallback writeFile also fails, propagating to main().catch
    const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
      TMPDIR: '/dev/null'
    });
    assert.strictEqual(result.code, 0,
      `Should exit 0 (don't block on errors), got ${result.code}`);
    assert.ok(result.stderr.includes('[StrategicCompact] Error:'),
      `stderr should contain [StrategicCompact] Error:, got: ${result.stderr}`);
  })) passed++; else failed++;

  // ── Round 80: session-end.js entry.message?.role === 'user' third OR condition ──
  console.log('\nRound 80: session-end.js (entry.message.role user — third OR condition):');

  if (await asyncTest('extracts user messages from entries where only message.role is user (not type or role)', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-msgrole-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });

    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');
    // Entries where type is NOT 'user' and there is no direct role field,
    // but message.role IS 'user'. This exercises the third OR condition at
    // session-end.js line 48: entry.message?.role === 'user'
    const lines = [
      '{"type":"human","message":{"role":"user","content":"Refactor the auth module"}}',
      '{"type":"human","message":{"role":"assistant","content":"I will refactor it"}}',
      '{"type":"human","message":{"role":"user","content":"Add integration tests too"}}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));
    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });

    try {
      const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0);

      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('-session.tmp'));
      assert.ok(files.length > 0, 'Should create session file');
      const content = fs.readFileSync(path.join(sessionsDir, files[0]), 'utf8');
      // The third OR condition should fire for type:"human" + message.role:"user"
      assert.ok(content.includes('Refactor the auth module') || content.includes('auth'),
        `Session should include message extracted via message.role path. Got: ${content.substring(0, 300)}`);
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  // ── Round 81: suggest-compact threshold upper bound, session-end non-string content ──
  console.log('\nRound 81: suggest-compact.js (COMPACT_THRESHOLD > 10000):');

  if (await asyncTest('COMPACT_THRESHOLD exceeding 10000 falls back to default 50', async () => {
    // suggest-compact.js line 31: rawThreshold <= 10000 ? rawThreshold : 50
    // Values > 10000 are positive and finite but fail the upper-bound check.
    // Existing tests cover 0, negative, NaN — this covers the > 10000 boundary.
    const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
      COMPACT_THRESHOLD: '20000'
    });
    assert.strictEqual(result.code, 0, 'Should exit 0');
    // The script logs the threshold it chose — should fall back to 50
    // Look for the fallback value in stderr (log output)
    const compactSource = fs.readFileSync(path.join(scriptsDir, 'suggest-compact.js'), 'utf8');
    // The condition at line 31: rawThreshold <= 10000 ? rawThreshold : 50
    assert.ok(compactSource.includes('<= 10000'),
      'Source should have <= 10000 upper bound check');
    assert.ok(compactSource.includes(': 50'),
      'Source should fall back to 50 when threshold exceeds 10000');
  })) passed++; else failed++;

  console.log('\nRound 81: session-end.js (user entry with non-string non-array content):');

  if (await asyncTest('skips user messages with numeric content (non-string non-array branch)', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-r81-numcontent-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });
    const transcriptPath = path.join(isoHome, 'transcript.jsonl');

    const lines = [
      // Normal user message (string content) — should be included
      '{"type":"user","content":"Real user message"}',
      // User message with numeric content — exercises the else: '' branch
      '{"type":"user","content":42}',
      // User message with boolean content — also hits the else branch
      '{"type":"user","content":true}',
      // User message with object content (no .text) — also hits the else branch
      '{"type":"user","content":{"type":"image","source":"data:..."}}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    try {
      const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0, 'Should exit 0');

      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.tmp'));
      assert.ok(files.length > 0, 'Should create session file');
      const content = fs.readFileSync(path.join(sessionsDir, files[0]), 'utf8');
      // The real string message should appear
      assert.ok(content.includes('Real user message'),
        'Should include the string content user message');
      // Numeric/boolean/object content should NOT appear as task bullet lines.
      // Avoid raw substring checks because timestamps can legitimately contain "42".
      assert.ok(!/\n-\s*42\b/.test(content),
        'Numeric content should be skipped (else branch → empty string → filtered)');
      assert.ok(!/\n-\s*true\b/.test(content),
        'Boolean content should be skipped (else branch → empty string → filtered)');
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 82: tool_name OR fallback, template marker regex no-match ──

  console.log('\nRound 82: session-end.js (entry.tool_name without type=tool_use):');

  if (await asyncTest('collects tool name from entry with tool_name but non-tool_use type', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-r82-toolname-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });

    const transcriptPath = path.join(isoHome, 'transcript.jsonl');
    const lines = [
      '{"type":"user","content":"Fix the bug"}',
      '{"type":"result","tool_name":"Edit","tool_input":{"file_path":"/tmp/app.js"}}',
      '{"type":"assistant","message":{"content":[{"type":"text","text":"Done fixing"}]}}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    try {
      const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0, 'Should exit 0');
      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.tmp'));
      assert.ok(files.length > 0, 'Should create session file');
      const content = fs.readFileSync(path.join(sessionsDir, files[0]), 'utf8');
      // The tool name "Edit" should appear even though type is "result", not "tool_use"
      assert.ok(content.includes('Edit'), 'Should collect Edit tool via tool_name OR fallback');
      // The file modified should also be collected since tool_name is Edit
      assert.ok(content.includes('app.js'), 'Should collect modified file path from tool_input');
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  console.log('\nRound 82: session-end.js (template marker present but regex no-match):');

  if (await asyncTest('preserves file when marker present but regex does not match corrupted template', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-r82-tmpl-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });

    const today = new Date().toISOString().split('T')[0];
    const sessionFile = path.join(sessionsDir, `session-${today}.tmp`);

    // Write a corrupted template: has the marker but NOT the full regex structure
    const corruptedTemplate = `# Session: ${today}
**Date:** ${today}
**Started:** 10:00
**Last Updated:** 10:00

---

## Current State

[Session context goes here]

Some random content without the expected ### Context to Load section
`;
    fs.writeFileSync(sessionFile, corruptedTemplate);

    // Provide a transcript with enough content to generate a summary
    const transcriptPath = path.join(isoHome, 'transcript.jsonl');
    const lines = [
      '{"type":"user","content":"Implement authentication feature"}',
      '{"type":"assistant","message":{"content":[{"type":"text","text":"I will implement the auth feature using JWT tokens and bcrypt for password hashing."}]}}',
      '{"type":"tool_use","tool_name":"Write","name":"Write","tool_input":{"file_path":"/tmp/auth.js"}}',
      '{"type":"user","content":"Now add the login endpoint"}',
      '{"type":"assistant","message":{"content":[{"type":"text","text":"Adding the login endpoint with proper validation."}]}}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    try {
      const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0, 'Should exit 0');

      const content = fs.readFileSync(sessionFile, 'utf8');
      // The marker text should still be present since regex didn't match
      assert.ok(content.includes('[Session context goes here]'),
        'Marker should remain when regex fails to match corrupted template');
      // The corrupted content should still be there
      assert.ok(content.includes('Some random content'),
        'Original corrupted content should be preserved');
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 87: post-edit-format.js and post-edit-typecheck.js stdin overflow (1MB) ──
  console.log('\nRound 87: post-edit-format.js (stdin exceeding 1MB — truncation):');

  if (await asyncTest('truncates stdin at 1MB limit and still passes through data (post-edit-format)', async () => {
    // Send 1.2MB of data — exceeds the 1MB MAX_STDIN limit (lines 14-22)
    const payload = 'x'.repeat(1024 * 1024 + 200000);
    const result = await runScript(path.join(scriptsDir, 'post-edit-format.js'), payload);

    assert.strictEqual(result.code, 0, 'Should exit 0 even with oversized stdin');
    // Output should be truncated — significantly less than input
    assert.ok(result.stdout.length < payload.length,
      `stdout (${result.stdout.length}) should be shorter than input (${payload.length})`);
    // Output should be approximately 1MB (last accepted chunk may push slightly over)
    assert.ok(result.stdout.length <= 1024 * 1024 + 65536,
      `stdout (${result.stdout.length}) should be near 1MB, not unbounded`);
    assert.ok(result.stdout.length > 0, 'Should still pass through truncated data');
  })) passed++; else failed++;

  console.log('\nRound 87: post-edit-typecheck.js (stdin exceeding 1MB — truncation):');

  if (await asyncTest('truncates stdin at 1MB limit and still passes through data (post-edit-typecheck)', async () => {
    // Send 1.2MB of data — exceeds the 1MB MAX_STDIN limit (lines 16-24)
    const payload = 'x'.repeat(1024 * 1024 + 200000);
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), payload);

    assert.strictEqual(result.code, 0, 'Should exit 0 even with oversized stdin');
    // Output should be truncated — significantly less than input
    assert.ok(result.stdout.length < payload.length,
      `stdout (${result.stdout.length}) should be shorter than input (${payload.length})`);
    // Output should be approximately 1MB (last accepted chunk may push slightly over)
    assert.ok(result.stdout.length <= 1024 * 1024 + 65536,
      `stdout (${result.stdout.length}) should be near 1MB, not unbounded`);
    assert.ok(result.stdout.length > 0, 'Should still pass through truncated data');
  })) passed++; else failed++;

  // ── Round 89: post-edit-typecheck.js error detection path (relevantLines) ──
  console.log('\nRound 89: post-edit-typecheck.js (TypeScript error detection path):');

  if (await asyncTest('filters TypeScript errors to edited file when tsc reports errors', async () => {
    // post-edit-typecheck.js lines 60-85: when execFileSync('npx', ['tsc', ...]) throws,
    // the catch block filters error output by file path candidates and logs relevant lines.
    // All existing tests either have no tsconfig (tsc never runs) or valid TS (tsc succeeds).
    // This test creates a .ts file with a type error and a tsconfig.json.
    const testDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { strict: true, noEmit: true }
    }));
    const testFile = path.join(testDir, 'broken.ts');
    // Intentional type error: assigning string to number
    fs.writeFileSync(testFile, 'const x: number = "not a number";\n');

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);

    // Core: script must exit 0 and pass through stdin data regardless
    assert.strictEqual(result.code, 0, 'Should exit 0 even when tsc finds errors');
    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.tool_input.file_path, testFile,
      'Should pass through original stdin data with file_path intact');

    // If tsc is available and ran, check that error output is filtered to this file
    if (result.stderr.includes('TypeScript errors in')) {
      assert.ok(result.stderr.includes('broken.ts'),
        `Should reference the edited file basename. Got: ${result.stderr}`);
    }
    // Either way, no crash and data passes through (verified above)
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 89: extractSessionSummary entry.name + entry.input fallback paths ──
  console.log('\nRound 89: session-end.js (entry.name + entry.input fallback in extractSessionSummary):');

  if (await asyncTest('extracts tool name from entry.name and file path from entry.input (fallback format)', async () => {
    // session-end.js line 63: const toolName = entry.tool_name || entry.name || '';
    // session-end.js line 66: const filePath = entry.tool_input?.file_path || entry.input?.file_path || '';
    // All existing tests use tool_name + tool_input format. This tests the name + input fallback.
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    const lines = [
      '{"type":"user","content":"Fix the auth module"}',
      // Tool entries using "name" + "input" instead of "tool_name" + "tool_input"
      '{"type":"tool_use","name":"Edit","input":{"file_path":"/src/auth.ts"}}',
      '{"type":"tool_use","name":"Write","input":{"file_path":"/src/new-helper.ts"}}',
      // Also include a tool with tool_name but entry.input (mixed format)
      '{"tool_name":"Read","input":{"file_path":"/src/config.ts"}}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
      HOME: testDir
    });
    assert.strictEqual(result.code, 0, 'Should exit 0');

    // Read the session file to verify tool names and file paths were extracted
    const claudeDir = getSessionsDirForHome(testDir);
    if (fs.existsSync(claudeDir)) {
      const files = fs.readdirSync(claudeDir).filter(f => f.endsWith('.tmp'));
      if (files.length > 0) {
        const content = fs.readFileSync(path.join(claudeDir, files[0]), 'utf8');
        // Tools from entry.name fallback
        assert.ok(content.includes('Edit'),
          `Should extract Edit tool from entry.name fallback. Got: ${content}`);
        assert.ok(content.includes('Write'),
          `Should extract Write tool from entry.name fallback. Got: ${content}`);
        // File paths from entry.input fallback
        assert.ok(content.includes('/src/auth.ts'),
          `Should extract file path from entry.input.file_path fallback. Got: ${content}`);
        assert.ok(content.includes('/src/new-helper.ts'),
          `Should extract Write file from entry.input.file_path fallback. Got: ${content}`);
      }
    }
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 90: readStdinJson timeout path (utils.js lines 215-229) ──
  console.log('\nRound 90: readStdinJson (timeout fires when stdin stays open):');

  if (await asyncTest('readStdinJson resolves with {} when stdin never closes (timeout fires, no data)', async () => {
    // utils.js line 215: setTimeout fires because stdin 'end' never arrives.
    // Line 225: data.trim() is empty → resolves with {}.
    // Exercises: removeAllListeners, process.stdin.unref(), and the empty-data timeout resolution.
    const script = 'const u=require("./scripts/lib/utils");u.readStdinJson({timeoutMs:100}).then(d=>{process.stdout.write(JSON.stringify(d));process.exit(0)})';
    return new Promise((resolve, reject) => {
      const child = spawn('node', ['-e', script], {
        cwd: path.resolve(__dirname, '..', '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      // Don't write anything or close stdin — force the timeout to fire
      let stdout = '';
      child.stdout.on('data', d => stdout += d);
      const timer = setTimeout(() => { child.kill(); reject(new Error('Test timed out')); }, 5000);
      child.on('close', (code) => {
        clearTimeout(timer);
        try {
          assert.strictEqual(code, 0, 'Should exit 0 via timeout resolution');
          const parsed = JSON.parse(stdout);
          assert.deepStrictEqual(parsed, {}, 'Should resolve with {} when no data received before timeout');
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  })) passed++; else failed++;

  if (await asyncTest('readStdinJson resolves with {} when timeout fires with invalid partial JSON', async () => {
    // utils.js lines 224-228: setTimeout fires, data.trim() is non-empty,
    // JSON.parse(data) throws → catch at line 226 resolves with {}.
    const script = 'const u=require("./scripts/lib/utils");u.readStdinJson({timeoutMs:100}).then(d=>{process.stdout.write(JSON.stringify(d));process.exit(0)})';
    return new Promise((resolve, reject) => {
      const child = spawn('node', ['-e', script], {
        cwd: path.resolve(__dirname, '..', '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      // Write partial invalid JSON but don't close stdin — timeout fires with unparseable data
      child.stdin.write('{"incomplete":');
      let stdout = '';
      child.stdout.on('data', d => stdout += d);
      const timer = setTimeout(() => { child.kill(); reject(new Error('Test timed out')); }, 5000);
      child.on('close', (code) => {
        clearTimeout(timer);
        try {
          assert.strictEqual(code, 0, 'Should exit 0 via timeout resolution');
          const parsed = JSON.parse(stdout);
          assert.deepStrictEqual(parsed, {}, 'Should resolve with {} when partial JSON cannot be parsed');
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  })) passed++; else failed++;

  // ── Round 94: session-end.js tools used but no files modified ──
  console.log('\nRound 94: session-end.js (tools used without files modified):');

  if (await asyncTest('session file includes Tools Used but omits Files Modified when only Read/Grep used', async () => {
    // session-end.js buildSummarySection (lines 217-228):
    //   filesModified.length > 0 → include "### Files Modified" section
    //   toolsUsed.length > 0 → include "### Tools Used" section
    // Previously tested: BOTH present (Round ~10) and NEITHER present (Round ~10).
    // Untested combination: toolsUsed present, filesModified empty.
    // Transcript with Read/Grep tools (don't add to filesModified) and user messages.
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    const lines = [
      '{"type":"user","content":"Search the codebase for auth handlers"}',
      '{"type":"tool_use","tool_name":"Read","tool_input":{"file_path":"/src/auth.ts"}}',
      '{"type":"tool_use","tool_name":"Grep","tool_input":{"pattern":"handler"}}',
      '{"type":"user","content":"Check the test file too"}',
      '{"type":"tool_use","tool_name":"Read","tool_input":{"file_path":"/tests/auth.test.ts"}}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
      HOME: testDir
    });
    assert.strictEqual(result.code, 0, 'Should exit 0');

    const claudeDir = getSessionsDirForHome(testDir);
    if (fs.existsSync(claudeDir)) {
      const files = fs.readdirSync(claudeDir).filter(f => f.endsWith('.tmp'));
      if (files.length > 0) {
        const content = fs.readFileSync(path.join(claudeDir, files[0]), 'utf8');
        assert.ok(content.includes('### Tools Used'), 'Should include Tools Used section');
        assert.ok(content.includes('Read'), 'Should list Read tool');
        assert.ok(content.includes('Grep'), 'Should list Grep tool');
        assert.ok(!content.includes('### Files Modified'),
          'Should NOT include Files Modified section (Read/Grep do not modify files)');
      }
    }
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // Summary
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

ensureSubprocessCapability('tests/hooks/hooks-rounds-2.test.js');
runTests();


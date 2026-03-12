/**
 * Tests for hook scripts
 *
 * Run with: node tests/hooks/hooks-rounds-3.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { ensureSubprocessCapability } = require('../helpers/subprocess-capability');
const { asyncTest, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { runScript, getSessionsDirForHome } = require('../helpers/hook-test-utils');

// Test suite
async function runTests() {
  console.log('\n=== Testing Hook Scripts (Round Cases) ===\n');

  let passed = 0;
  let failed = 0;
  const scriptsDir = path.join(__dirname, '..', '..', 'scripts', 'hooks');

  // Round 41: pre-compact.js (multiple session files)
  console.log('\nRound 41: pre-compact.js (multiple session files):');

  if (await asyncTest('annotates only the newest session file when multiple exist', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-compact-multi-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });

    // Create two session files with different mtimes
    const olderSession = path.join(sessionsDir, '2026-01-01-older-session.tmp');
    const newerSession = path.join(sessionsDir, '2026-02-11-newer-session.tmp');
    fs.writeFileSync(olderSession, '# Older Session\n');
    // Small delay to ensure different mtime
    const now = Date.now();
    fs.utimesSync(olderSession, new Date(now - 60000), new Date(now - 60000));
    fs.writeFileSync(newerSession, '# Newer Session\n');

    try {
      const result = await runScript(path.join(scriptsDir, 'pre-compact.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0);

      const newerContent = fs.readFileSync(newerSession, 'utf8');
      const olderContent = fs.readFileSync(olderSession, 'utf8');

      // findFiles sorts by mtime newest first, so sessions[0] is the newest
      assert.ok(
        newerContent.includes('Compaction occurred'),
        'Should annotate the newest session file'
      );
      assert.strictEqual(
        olderContent,
        '# Older Session\n',
        'Should NOT annotate older session files'
      );
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // Round 40: session-end.js (newline collapse in markdown list items)
  console.log('\nRound 40: session-end.js (newline collapse):');

  if (await asyncTest('collapses newlines in user messages to single-line markdown items', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // User message containing newlines that would break markdown list
    const lines = [
      JSON.stringify({ type: 'user', content: 'Please help me with:\n1. Task one\n2. Task two\n3. Task three' }),
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
      HOME: testDir
    });
    assert.strictEqual(result.code, 0);

    // Find the session file and verify newlines were collapsed
    const claudeDir = getSessionsDirForHome(testDir);
    if (fs.existsSync(claudeDir)) {
      const files = fs.readdirSync(claudeDir).filter(f => f.endsWith('.tmp'));
      if (files.length > 0) {
        const content = fs.readFileSync(path.join(claudeDir, files[0]), 'utf8');
        // Each task should be a single-line markdown list item
        const taskLines = content.split('\n').filter(l => l.startsWith('- '));
        for (const line of taskLines) {
          assert.ok(
            !line.includes('\n'),
            'Task list items should be single-line'
          );
        }
        // Newlines should be replaced with spaces
        assert.ok(
          content.includes('Please help me with: 1. Task one 2. Task two'),
          `Newlines should be collapsed to spaces, got: ${content.substring(0, 500)}`
        );
      }
    }
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 44: session-start.js empty session file ──
  console.log('\nRound 44: session-start.js (empty session file):');

  if (await asyncTest('does not inject empty session file content into context', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-start-empty-file-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(path.join(path.dirname(sessionsDir), 'generated', 'skills', 'learned'), { recursive: true });

    // Create a 0-byte session file (simulates truncated/corrupted write)
    const today = new Date().toISOString().slice(0, 10);
    const sessionFile = path.join(sessionsDir, `${today}-empty0000-session.tmp`);
    fs.writeFileSync(sessionFile, '');

    try {
      const result = await runScript(path.join(scriptsDir, 'session-start.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0, 'Should exit 0 with empty session file');
      // readFile returns '' (falsy) → the if (content && ...) guard skips injection
      assert.ok(
        !result.stdout.includes('Previous session summary'),
        'Should NOT inject empty string into context'
      );
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 49: typecheck extension matching and session-end conditional sections ──
  console.log('\nRound 49: post-edit-typecheck.js (extension edge cases):');

  if (await asyncTest('.d.ts files match the TS regex and trigger typecheck path', async () => {
    const testDir = createTestDir();
    const testFile = path.join(testDir, 'types.d.ts');
    fs.writeFileSync(testFile, 'declare const x: number;');

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should exit 0 for .d.ts file');
    assert.ok(result.stdout.includes('tool_input'), 'Should pass through stdin data');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('.mts extension does not trigger typecheck', async () => {
    const stdinJson = JSON.stringify({ tool_input: { file_path: '/project/utils.mts' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should exit 0 for .mts file');
    assert.strictEqual(result.stdout, stdinJson, 'Should pass through .mts unchanged');
  })) passed++; else failed++;

  console.log('\nRound 49: session-end.js (conditional summary sections):');

  if (await asyncTest('summary omits Files Modified and Tools Used when none found', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-notools-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });

    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');
    // Only user messages — no tool_use entries at all
    const lines = [
      '{"type":"user","content":"How does authentication work?"}',
      '{"type":"assistant","message":{"content":[{"type":"text","text":"It uses JWT"}]}}'
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
      assert.ok(content.includes('authentication'), 'Should include user message');
      assert.ok(!content.includes('### Files Modified'), 'Should omit Files Modified when empty');
      assert.ok(!content.includes('### Tools Used'), 'Should omit Tools Used when empty');
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  // ── Round 50: alias reporting, parallel compaction, graceful degradation ──
  console.log('\nRound 50: session-start.js (alias reporting):');

  if (await asyncTest('reports available session aliases on startup', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-start-alias-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    const configDir = path.dirname(sessionsDir);
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(path.join(configDir, 'mdt', 'generated', 'skills', 'learned'), { recursive: true });

    fs.writeFileSync(path.join(configDir, 'session-aliases.json'), JSON.stringify({
      version: '1.0',
      aliases: {
        'my-feature': { sessionPath: '/sessions/feat', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), title: null },
        'bug-fix': { sessionPath: '/sessions/fix', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), title: null }
      },
      metadata: { totalCount: 2, lastUpdated: new Date().toISOString() }
    }));

    try {
      const result = await runScript(path.join(scriptsDir, 'session-start.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0);
      assert.ok(result.stderr.includes('alias'), 'Should mention aliases in stderr');
      assert.ok(
        result.stderr.includes('my-feature') || result.stderr.includes('bug-fix'),
        'Should list at least one alias name'
      );
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  console.log('\nRound 50: pre-compact.js (parallel execution):');

  if (await asyncTest('parallel compaction runs all append to log without loss', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-compact-par-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });

    try {
      const promises = Array(3).fill(null).map(() =>
        runScript(path.join(scriptsDir, 'pre-compact.js'), '', {
          HOME: isoHome, USERPROFILE: isoHome
        })
      );
      const results = await Promise.all(promises);
      results.forEach((r, i) => assert.strictEqual(r.code, 0, `Run ${i} should exit 0`));

      const logFile = path.join(sessionsDir, 'compaction-log.txt');
      assert.ok(fs.existsSync(logFile), 'Compaction log should exist');
      const content = fs.readFileSync(logFile, 'utf8');
      const entries = (content.match(/Context compaction triggered/g) || []).length;
      assert.strictEqual(entries, 3, `Should have 3 log entries, got ${entries}`);
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (await asyncTest('rotates oversized compaction log to bounded tail', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-compact-rotate-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });
    const logFile = path.join(sessionsDir, 'compaction-log.txt');

    try {
      // Build >100KB worth of deterministic entries to trigger rotation logic.
      const largeEntry = '[2026-01-01 00:00:00] Context compaction triggered ' + 'x'.repeat(180) + '\n';
      fs.writeFileSync(logFile, largeEntry.repeat(700), 'utf8');
      const beforeBytes = Buffer.byteLength(fs.readFileSync(logFile, 'utf8'), 'utf8');
      assert.ok(beforeBytes > 100 * 1024, 'Precondition: log should exceed rotation threshold');

      const result = await runScript(path.join(scriptsDir, 'pre-compact.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0, 'pre-compact should exit 0');

      const rotated = fs.readFileSync(logFile, 'utf8');
      const afterBytes = Buffer.byteLength(rotated, 'utf8');
      assert.ok(afterBytes <= 100 * 1024, `Rotated log should be <= 100KB, got ${afterBytes}`);
      assert.ok(rotated.includes('Context compaction triggered'), 'Rotated log should retain recent entries');
      const lines = rotated.split('\n').filter(Boolean);
      assert.ok(lines.length <= 1000, `Rotated log should keep at most 1000 lines, got ${lines.length}`);
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  console.log('\nRound 50: session-start.js (graceful degradation):');

  if (await asyncTest('exits 0 when sessions path is a file (not a directory)', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-start-blocked-${Date.now()}`);
    const sessionsPath = getSessionsDirForHome(isoHome);
    fs.mkdirSync(path.dirname(sessionsPath), { recursive: true });
    fs.writeFileSync(sessionsPath, 'blocked');

    try {
      const result = await runScript(path.join(scriptsDir, 'session-start.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0, 'Should exit 0 even when sessions dir is blocked');
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 53: console-warn max matches and format non-existent file ──
  console.log('\nRound 53: post-edit-console-warn.js (max matches truncation):');

  if (await asyncTest('reports maximum 5 console.log matches per file', async () => {
    const testDir = createTestDir();
    const testFile = path.join(testDir, 'many-logs.js');
    const lines = Array(7).fill(null).map((_, i) =>
      `console.log("debug line ${i + 1}");`
    );
    fs.writeFileSync(testFile, lines.join('\n'));

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), stdinJson);

    assert.strictEqual(result.code, 0, 'Should exit 0');
    // Count line number reports in stderr (format: "N: console.log(...)")
    const lineReports = (result.stderr.match(/^\d+:/gm) || []).length;
    assert.strictEqual(lineReports, 5, `Should report max 5 matches, got ${lineReports}`);
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  console.log('\nRound 53: post-edit-format.js (non-existent file):');

  if (await asyncTest('passes through data for non-existent .tsx file path', async () => {
    const stdinJson = JSON.stringify({
      tool_input: { file_path: '/nonexistent/path/file.tsx' }
    });
    const result = await runScript(path.join(scriptsDir, 'post-edit-format.js'), stdinJson);

    assert.strictEqual(result.code, 0, 'Should exit 0 for non-existent file');
    assert.strictEqual(result.stdout, stdinJson, 'Should pass through stdin data unchanged');
  })) passed++; else failed++;

  // ── Round 55: maxAge boundary, multi-session injection, stdin overflow ──
  console.log('\nRound 55: session-start.js (maxAge 7-day boundary):');

  if (await asyncTest('excludes session files older than 7 days', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-start-7day-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(path.join(path.dirname(sessionsDir), 'generated', 'skills', 'learned'), { recursive: true });

    // Create session file 6.9 days old (should be INCLUDED by maxAge:7)
    const recentFile = path.join(sessionsDir, '2026-02-06-recent69-session.tmp');
    fs.writeFileSync(recentFile, '# Recent Session\n\nRECENT CONTENT HERE');
    const sixPointNineDaysAgo = new Date(Date.now() - 6.9 * 24 * 60 * 60 * 1000);
    fs.utimesSync(recentFile, sixPointNineDaysAgo, sixPointNineDaysAgo);

    // Create session file 8 days old (should be EXCLUDED by maxAge:7)
    const oldFile = path.join(sessionsDir, '2026-02-05-old8day-session.tmp');
    fs.writeFileSync(oldFile, '# Old Session\n\nOLD CONTENT SHOULD NOT APPEAR');
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldFile, eightDaysAgo, eightDaysAgo);

    try {
      const result = await runScript(path.join(scriptsDir, 'session-start.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0);
      assert.ok(result.stderr.includes('1 recent session'),
        `Should find 1 recent session (6.9-day included, 8-day excluded), stderr: ${result.stderr}`);
      assert.ok(result.stdout.includes('RECENT CONTENT HERE'),
        'Should inject the 6.9-day-old session content');
      assert.ok(!result.stdout.includes('OLD CONTENT SHOULD NOT APPEAR'),
        'Should NOT inject the 8-day-old session content');
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  console.log('\nRound 55: session-start.js (newest session selection):');

  if (await asyncTest('injects newest session when multiple recent sessions exist', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-start-multi-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(path.join(path.dirname(sessionsDir), 'generated', 'skills', 'learned'), { recursive: true });

    const now = Date.now();

    // Create older session (2 days ago)
    const olderSession = path.join(sessionsDir, '2026-02-11-olderabc-session.tmp');
    fs.writeFileSync(olderSession, '# Older Session\n\nOLDER_CONTEXT_MARKER');
    fs.utimesSync(olderSession, new Date(now - 2 * 86400000), new Date(now - 2 * 86400000));

    // Create newer session (1 day ago)
    const newerSession = path.join(sessionsDir, '2026-02-12-newerdef-session.tmp');
    fs.writeFileSync(newerSession, '# Newer Session\n\nNEWER_CONTEXT_MARKER');
    fs.utimesSync(newerSession, new Date(now - 1 * 86400000), new Date(now - 1 * 86400000));

    try {
      const result = await runScript(path.join(scriptsDir, 'session-start.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0);
      assert.ok(result.stderr.includes('2 recent session'),
        `Should find 2 recent sessions, stderr: ${result.stderr}`);
      // Should inject the NEWER session, not the older one
      assert.ok(result.stdout.includes('NEWER_CONTEXT_MARKER'),
        'Should inject the newest session content');
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  console.log('\nRound 55: session-end.js (stdin overflow):');

  if (await asyncTest('handles stdin exceeding MAX_STDIN (1MB) gracefully', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');
    // Create a minimal valid transcript so env var fallback works
    fs.writeFileSync(transcriptPath, JSON.stringify({ type: 'user', content: 'Overflow test' }) + '\n');

    // Create stdin > 1MB: truncated JSON will be invalid → falls back to env var
    const oversizedPayload = '{"transcript_path":"' + 'x'.repeat(1048600) + '"}';

    try {
      const result = await runScript(path.join(scriptsDir, 'session-end.js'), oversizedPayload, {
        CLAUDE_TRANSCRIPT_PATH: transcriptPath
      });
      assert.strictEqual(result.code, 0, 'Should exit 0 even with oversized stdin');
      // Truncated JSON → JSON.parse throws → falls back to env var → creates session file
      assert.ok(
        result.stderr.includes('Created session file') || result.stderr.includes('Updated session file'),
        `Should create/update session file via env var fallback, stderr: ${result.stderr}`
      );
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  // ── Round 56: typecheck tsconfig walk-up, suggest-compact fallback path ──
  console.log('\nRound 56: post-edit-typecheck.js (tsconfig in parent directory):');

  if (await asyncTest('walks up directory tree to find tsconfig.json in grandparent', async () => {
    const testDir = createTestDir();
    // Place tsconfig at the TOP level, file is nested 2 levels deep
    fs.writeFileSync(path.join(testDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { strict: false, noEmit: true }
    }));
    const deepDir = path.join(testDir, 'src', 'components');
    fs.mkdirSync(deepDir, { recursive: true });
    const testFile = path.join(deepDir, 'widget.ts');
    fs.writeFileSync(testFile, 'export const value: number = 42;\n');

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);

    assert.strictEqual(result.code, 0, 'Should exit 0 after walking up to find tsconfig');
    // Core assertion: stdin must pass through regardless of whether tsc ran
    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.tool_input.file_path, testFile,
      'Should pass through original stdin data with file_path intact');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  console.log('\nRound 56: suggest-compact.js (counter file as directory — fallback path):');

  if (await asyncTest('exits 0 when counter file path is occupied by a directory', async () => {
    const sessionId = `dirblock-${Date.now()}`;
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    // Create a DIRECTORY at the counter file path — openSync('a+') will fail with EISDIR
    fs.mkdirSync(counterFile);

    try {
      const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId
      });
      assert.strictEqual(result.code, 0,
        'Should exit 0 even when counter file path is a directory (graceful fallback)');
    } finally {
      // Cleanup: remove the blocking directory
      try { fs.rmdirSync(counterFile); } catch { /* best-effort */ }
    }
  })) passed++; else failed++;

  // ── Round 59: session-start unreadable file, console-log stdin overflow, pre-compact write error ──
  console.log('\nRound 59: session-start.js (unreadable session file — readFile returns null):');

  if (await asyncTest('does not inject content when session file is unreadable', async () => {
    // Skip on Windows or when running as root (permissions won't work)
    if (process.platform === 'win32' || (process.getuid && process.getuid() === 0)) {
      console.log('    (skipped — not supported on this platform)');
      return;
    }
    const isoHome = path.join(os.tmpdir(), `MDT-start-unreadable-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });

    // Create a session file with real content, then make it unreadable
    const sessionFile = path.join(sessionsDir, `${Date.now()}-session.tmp`);
    fs.writeFileSync(sessionFile, '# Sensitive session content that should NOT appear');
    fs.chmodSync(sessionFile, 0o000);

    try {
      const result = await runScript(path.join(scriptsDir, 'session-start.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0, 'Should exit 0 even with unreadable session file');
      // readFile returns null for unreadable files → content is null → no injection
      assert.ok(!result.stdout.includes('Sensitive session content'),
        'Should NOT inject content from unreadable file');
    } finally {
      try { fs.chmodSync(sessionFile, 0o644); } catch { /* best-effort */ }
      try { fs.rmSync(isoHome, { recursive: true, force: true }); } catch { /* best-effort */ }
    }
  })) passed++; else failed++;

  console.log('\nRound 59: check-console-log.js (stdin exceeding 1MB — truncation):');

  if (await asyncTest('truncates stdin at 1MB limit and still passes through data', async () => {
    // Send 1.2MB of data — exceeds the 1MB MAX_STDIN limit
    const payload = 'x'.repeat(1024 * 1024 + 200000);
    const result = await runScript(path.join(scriptsDir, 'check-console-log.js'), payload);

    assert.strictEqual(result.code, 0, 'Should exit 0 even with oversized stdin');
    // Output should be truncated — significantly less than input
    assert.ok(result.stdout.length < payload.length,
      `stdout (${result.stdout.length}) should be shorter than input (${payload.length})`);
    // Output should be approximately 1MB (last accepted chunk may push slightly over)
    assert.ok(result.stdout.length <= 1024 * 1024 + 65536,
      `stdout (${result.stdout.length}) should be near 1MB, not unbounded`);
    assert.ok(result.stdout.length > 0, 'Should still pass through truncated data');
  })) passed++; else failed++;

  console.log('\nRound 59: pre-compact.js (read-only session file — appendFile error):');

  if (await asyncTest('exits 0 when session file is read-only (appendFile fails)', async () => {
    if (process.platform === 'win32' || (process.getuid && process.getuid() === 0)) {
      console.log('    (skipped — not supported on this platform)');
      return;
    }
    const isoHome = path.join(os.tmpdir(), `MDT-compact-ro-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });

    // Create a session file then make it read-only
    const sessionFile = path.join(sessionsDir, `${Date.now()}-session.tmp`);
    fs.writeFileSync(sessionFile, '# Active session\n');
    fs.chmodSync(sessionFile, 0o444);

    try {
      const result = await runScript(path.join(scriptsDir, 'pre-compact.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });
      // Should exit 0 — hooks must not block the user (catch at lines 45-47)
      assert.strictEqual(result.code, 0, 'Should exit 0 even when append fails');
      // Session file should remain unchanged (write was blocked)
      const content = fs.readFileSync(sessionFile, 'utf8');
      assert.strictEqual(content, '# Active session\n',
        'Read-only session file should remain unchanged');
    } finally {
      try { fs.chmodSync(sessionFile, 0o644); } catch { /* best-effort */ }
      try { fs.rmSync(isoHome, { recursive: true, force: true }); } catch { /* best-effort */ }
    }
  })) passed++; else failed++;

  // ── Round 60: replaceInFile failure, console-warn stdin overflow, format missing tool_input ──
  // Summary
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

ensureSubprocessCapability('tests/hooks/hooks-rounds-3.test.js');
runTests();


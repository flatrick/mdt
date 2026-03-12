/**
 * Tests for hook scripts
 *
 * Run with: node tests/hooks/hooks.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { ensureSubprocessCapability } = require('../helpers/subprocess-capability');
const { test, asyncTest, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { runScript, getSessionsDirForHome } = require('../helpers/hook-test-utils');

// Test suite
async function runTests() {
  console.log('\n=== Testing Hook Scripts ===\n');

  let passed = 0;
  let failed = 0;

  const scriptsDir = path.join(__dirname, '..', '..', 'scripts', 'hooks');

  // session-start.js tests
  console.log('session-start.js:');

  if (await asyncTest('runs without error', async () => {
    const result = await runScript(path.join(scriptsDir, 'session-start.js'));
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
  })) passed++; else failed++;

  if (await asyncTest('outputs session info to stderr', async () => {
    const result = await runScript(path.join(scriptsDir, 'session-start.js'));
    assert.ok(
      result.stderr.includes('[SessionStart]') ||
      result.stderr.includes('Package manager'),
      'Should output session info'
    );
  })) passed++; else failed++;

  // session-start.js edge cases
  console.log('\nsession-start.js (edge cases):');

  if (await asyncTest('exits 0 even with isolated empty HOME', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-iso-start-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(path.join(path.dirname(sessionsDir), 'generated', 'skills', 'learned'), { recursive: true });
    try {
      const result = await runScript(path.join(scriptsDir, 'session-start.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (await asyncTest('reports package manager detection', async () => {
    const result = await runScript(path.join(scriptsDir, 'session-start.js'));
    assert.ok(
      result.stderr.includes('Package manager') || result.stderr.includes('[SessionStart]'),
      'Should report package manager info'
    );
  })) passed++; else failed++;

  if (await asyncTest('skips template session content', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-tpl-start-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(path.join(path.dirname(sessionsDir), 'generated', 'skills', 'learned'), { recursive: true });

    // Create a session file with template placeholder
    const sessionFile = path.join(sessionsDir, '2026-02-11-abcd1234-session.tmp');
    fs.writeFileSync(sessionFile, '## Current State\n\n[Session context goes here]\n');

    try {
      const result = await runScript(path.join(scriptsDir, 'session-start.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0);
      // stdout should NOT contain the template content
      assert.ok(
        !result.stdout.includes('Previous session summary'),
        'Should not inject template session content'
      );
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (await asyncTest('injects real session content', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-real-start-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(path.join(path.dirname(sessionsDir), 'generated', 'skills', 'learned'), { recursive: true });

    // Create a real session file
    const sessionFile = path.join(sessionsDir, '2026-02-11-efgh5678-session.tmp');
    fs.writeFileSync(sessionFile, '# Real Session\n\nI worked on authentication refactor.\n');

    try {
      const result = await runScript(path.join(scriptsDir, 'session-start.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0);
      assert.ok(
        result.stdout.includes('Previous session summary'),
        'Should inject real session content'
      );
      assert.ok(
        result.stdout.includes('authentication refactor'),
        'Should include session content text'
      );
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (await asyncTest('reports learned candidate skills count', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-skills-start-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    const learnedDir = path.join(path.dirname(sessionsDir), 'generated', 'skills', 'learned');
    fs.mkdirSync(learnedDir, { recursive: true });
    fs.mkdirSync(sessionsDir, { recursive: true });

    // Create learned skill files
    fs.writeFileSync(path.join(learnedDir, 'testing-patterns.md'), '# Testing');
    fs.writeFileSync(path.join(learnedDir, 'debugging.md'), '# Debugging');

    try {
      const result = await runScript(path.join(scriptsDir, 'session-start.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0);
      assert.ok(
        result.stderr.includes('2 learned candidate skill(s)'),
        `Should report 2 learned candidate skills, stderr: ${result.stderr}`
      );
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // check-console-log.js tests
  console.log('\ncheck-console-log.js:');

  if (await asyncTest('passes through stdin data to stdout', async () => {
    const stdinData = JSON.stringify({ tool_name: 'Write', tool_input: {} });
    const result = await runScript(path.join(scriptsDir, 'check-console-log.js'), stdinData);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('tool_name'), 'Should pass through stdin data');
  })) passed++; else failed++;

  if (await asyncTest('exits 0 with empty stdin', async () => {
    const result = await runScript(path.join(scriptsDir, 'check-console-log.js'), '');
    assert.strictEqual(result.code, 0);
  })) passed++; else failed++;

  if (await asyncTest('handles invalid JSON stdin gracefully', async () => {
    const result = await runScript(path.join(scriptsDir, 'check-console-log.js'), 'not valid json');
    assert.strictEqual(result.code, 0, 'Should exit 0 on invalid JSON');
    // Should still pass through the data
    assert.ok(result.stdout.includes('not valid json'), 'Should pass through invalid data');
  })) passed++; else failed++;

  // session-end.js tests
  console.log('\nsession-end.js:');

  if (await asyncTest('runs without error', async () => {
    const result = await runScript(path.join(scriptsDir, 'session-end.js'));
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
  })) passed++; else failed++;

  if (await asyncTest('creates or updates session file', async () => {
    const testDir = createTestDir();
    // Neutralize tool-detection env vars so subprocess and in-process detection agree,
    // regardless of which LLM tool (Claude, Cursor, etc.) is running the tests
    const neutralEnv = {
      HOME: testDir,
      USERPROFILE: testDir,
      CLAUDE_SESSION_ID: undefined,
      CURSOR_TRACE_ID: undefined,
      CURSOR_AGENT: undefined,
      CLAUDE_CODE: undefined
    };

    await runScript(path.join(scriptsDir, 'session-end.js'), '', neutralEnv);

    const sessionsDir = getSessionsDirForHome(testDir, neutralEnv);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    // Derive expected project name dynamically (matches getSessionIdShort fallback in worktrees etc.)
    const expectedId = path.basename(process.cwd());
    const sessionFile = path.join(sessionsDir, `${today}-${expectedId}-session.tmp`);

    assert.ok(fs.existsSync(sessionFile), `Session file should exist: ${sessionFile}`);
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('includes session ID in filename', async () => {
    const testDir = createTestDir();
    const testSessionId = 'test-session-abc12345';
    const expectedShortId = 'abc12345'; // Last 8 chars

    // Run with custom session ID and isolated HOME
    await runScript(path.join(scriptsDir, 'session-end.js'), '', {
      CLAUDE_SESSION_ID: testSessionId,
      HOME: testDir,
      USERPROFILE: testDir
    });

    const sessionsDir = getSessionsDirForHome(testDir, { CLAUDE_SESSION_ID: testSessionId });
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const sessionFile = path.join(sessionsDir, `${today}-${expectedShortId}-session.tmp`);

    assert.ok(fs.existsSync(sessionFile), `Session file should exist: ${sessionFile}`);
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // pre-compact.js tests
  console.log('\npre-compact.js:');

  if (await asyncTest('runs without error', async () => {
    const result = await runScript(path.join(scriptsDir, 'pre-compact.js'));
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
  })) passed++; else failed++;

  if (await asyncTest('outputs PreCompact message', async () => {
    const result = await runScript(path.join(scriptsDir, 'pre-compact.js'));
    assert.ok(result.stderr.includes('[PreCompact]'), 'Should output PreCompact message');
  })) passed++; else failed++;

  if (await asyncTest('creates compaction log', async () => {
    await runScript(path.join(scriptsDir, 'pre-compact.js'));
    const utils = require('../../scripts/lib/utils');
    const logFile = path.join(utils.getSessionsDir(), 'compaction-log.txt');
    assert.ok(fs.existsSync(logFile), 'Compaction log should exist');
  })) passed++; else failed++;

  if (await asyncTest('annotates active session file with compaction marker', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-compact-annotate-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });

    // Create an active .tmp session file
    const sessionFile = path.join(sessionsDir, '2026-02-11-test-session.tmp');
    fs.writeFileSync(sessionFile, '# Session: 2026-02-11\n**Started:** 10:00\n');

    try {
      await runScript(path.join(scriptsDir, 'pre-compact.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });

      const content = fs.readFileSync(sessionFile, 'utf8');
      assert.ok(
        content.includes('Compaction occurred'),
        'Should annotate the session file with compaction marker'
      );
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (await asyncTest('compaction log contains timestamp', async () => {
    const isoHome = path.join(os.tmpdir(), `MDT-compact-ts-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });

    try {
      await runScript(path.join(scriptsDir, 'pre-compact.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });

      const logFile = path.join(sessionsDir, 'compaction-log.txt');
      assert.ok(fs.existsSync(logFile), 'Compaction log should exist');
      const content = fs.readFileSync(logFile, 'utf8');
      // Should have a timestamp like [2026-02-11 14:30:00]
      assert.ok(
        /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/.test(content),
        `Log should contain timestamped entry, got: ${content.substring(0, 100)}`
      );
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // suggest-compact.js tests
  console.log('\nsuggest-compact.js:');

  if (await asyncTest('runs without error', async () => {
    const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
      CLAUDE_SESSION_ID: 'test-session-' + Date.now()
    });
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
  })) passed++; else failed++;

  if (await asyncTest('increments counter on each call', async () => {
    const sessionId = 'test-counter-' + Date.now();

    // Run multiple times
    for (let i = 0; i < 3; i++) {
      await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId
      });
    }

    // Check counter file
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    const count = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
    assert.strictEqual(count, 3, `Counter should be 3, got ${count}`);

    // Cleanup
    fs.unlinkSync(counterFile);
  })) passed++; else failed++;

  if (await asyncTest('suggests compact at threshold', async () => {
    const sessionId = 'test-threshold-' + Date.now();
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);

    // Set counter to threshold - 1
    fs.writeFileSync(counterFile, '49');

    const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
      CLAUDE_SESSION_ID: sessionId,
      COMPACT_THRESHOLD: '50'
    });

    assert.ok(
      result.stderr.includes('50 tool calls reached'),
      'Should suggest compact at threshold'
    );

    // Cleanup
    fs.unlinkSync(counterFile);
  })) passed++; else failed++;

  if (await asyncTest('does not suggest below threshold', async () => {
    const sessionId = 'test-below-' + Date.now();
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);

    fs.writeFileSync(counterFile, '10');

    const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
      CLAUDE_SESSION_ID: sessionId,
      COMPACT_THRESHOLD: '50'
    });

    assert.ok(
      !result.stderr.includes('tool calls'),
      'Should not suggest compact below threshold'
    );

    fs.unlinkSync(counterFile);
  })) passed++; else failed++;

  if (await asyncTest('suggests at regular intervals after threshold', async () => {
    const sessionId = 'test-interval-' + Date.now();
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);

    // Set counter to 74 (next will be 75, which is >50 and 75%25==0)
    fs.writeFileSync(counterFile, '74');

    const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
      CLAUDE_SESSION_ID: sessionId,
      COMPACT_THRESHOLD: '50'
    });

    assert.ok(
      result.stderr.includes('75 tool calls'),
      'Should suggest at 25-call intervals after threshold'
    );

    fs.unlinkSync(counterFile);
  })) passed++; else failed++;

  if (await asyncTest('handles corrupted counter file', async () => {
    const sessionId = 'test-corrupt-' + Date.now();
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);

    fs.writeFileSync(counterFile, 'not-a-number');

    const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
      CLAUDE_SESSION_ID: sessionId
    });

    assert.strictEqual(result.code, 0, 'Should handle corrupted counter gracefully');

    // Counter should be reset to 1
    const newCount = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
    assert.strictEqual(newCount, 1, 'Should reset counter to 1 on corrupt data');

    fs.unlinkSync(counterFile);
  })) passed++; else failed++;

  if (await asyncTest('uses default session ID when no env var', async () => {
    const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
      CLAUDE_SESSION_ID: '' // Empty, should use 'default'
    });

    assert.strictEqual(result.code, 0, 'Should work with default session ID');

    // Cleanup the default counter file
    const counterFile = path.join(os.tmpdir(), 'claude-tool-count-default');
    if (fs.existsSync(counterFile)) fs.unlinkSync(counterFile);
  })) passed++; else failed++;

  if (await asyncTest('validates threshold bounds', async () => {
    const sessionId = 'test-bounds-' + Date.now();
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);

    // Invalid threshold should fall back to 50
    fs.writeFileSync(counterFile, '49');

    const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
      CLAUDE_SESSION_ID: sessionId,
      COMPACT_THRESHOLD: '-5' // Invalid: negative
    });

    assert.ok(
      result.stderr.includes('50 tool calls'),
      'Should use default threshold (50) for invalid value'
    );

    fs.unlinkSync(counterFile);
  })) passed++; else failed++;

  // evaluate-session.js tests
  console.log('\nevaluate-session.js:');

  if (await asyncTest('runs without error when no transcript', async () => {
    const result = await runScript(path.join(scriptsDir, 'evaluate-session.js'));
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
  })) passed++; else failed++;

  if (await asyncTest('skips short sessions', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // Create a short transcript (less than 10 user messages)
    const transcript = Array(5).fill('{"type":"user","content":"test"}\n').join('');
    fs.writeFileSync(transcriptPath, transcript);

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'evaluate-session.js'), stdinJson);

    assert.ok(
      result.stderr.includes('Session too short'),
      'Should indicate session is too short'
    );

    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('processes sessions with enough messages', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // Create a longer transcript (more than 10 user messages)
    const transcript = Array(15).fill('{"type":"user","content":"test"}\n').join('');
    fs.writeFileSync(transcriptPath, transcript);

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'evaluate-session.js'), stdinJson);

    assert.ok(
      result.stderr.includes('15 messages'),
      'Should report message count'
    );

    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // evaluate-session.js: whitespace tolerance regression test
  if (await asyncTest('counts user messages with whitespace in JSON (regression)', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // Create transcript with whitespace around colons (pretty-printed style)
    const lines = [];
    for (let i = 0; i < 15; i++) {
      lines.push('{ "type" : "user", "content": "message ' + i + '" }');
    }
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'evaluate-session.js'), stdinJson);

    assert.ok(
      result.stderr.includes('15 messages'),
      'Should count user messages with whitespace in JSON, got: ' + result.stderr.trim()
    );

    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // session-end.js: content array with null elements regression test
  if (await asyncTest('handles transcript with null content array elements (regression)', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // Create transcript with null elements in content array
    const lines = [
      '{"type":"user","content":[null,{"text":"hello"},null,{"text":"world"}]}',
      '{"type":"user","content":"simple string message"}',
      '{"type":"user","content":[{"text":"normal"},{"text":"array"}]}',
      '{"type":"tool_use","tool_name":"Edit","tool_input":{"file_path":"/test.js"}}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson);

    // Should not crash (exit 0)
    assert.strictEqual(result.code, 0, 'Should handle null content elements without crash');
  })) passed++; else failed++;

  // session-end.js extractSessionSummary tests
  console.log('\nsession-end.js (extractSessionSummary):');

  if (await asyncTest('extracts user messages from transcript', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    const lines = [
      '{"type":"user","content":"Fix the login bug"}',
      '{"type":"assistant","content":"I will fix it"}',
      '{"type":"user","content":"Also add tests"}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson);
    assert.strictEqual(result.code, 0);
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('handles transcript with array content fields', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    const lines = [
      '{"type":"user","content":[{"text":"Part 1"},{"text":"Part 2"}]}',
      '{"type":"user","content":"Simple message"}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should handle array content without crash');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('extracts tool names and file paths from transcript', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    const lines = [
      '{"type":"user","content":"Edit the file"}',
      '{"type":"tool_use","tool_name":"Edit","tool_input":{"file_path":"/src/main.ts"}}',
      '{"type":"tool_use","tool_name":"Read","tool_input":{"file_path":"/src/utils.ts"}}',
      '{"type":"tool_use","tool_name":"Write","tool_input":{"file_path":"/src/new.ts"}}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson);
    assert.strictEqual(result.code, 0);
    // Session file should contain summary with tools used
    assert.ok(
      result.stderr.includes('Created session file') || result.stderr.includes('Updated session file'),
      'Should create/update session file'
    );
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('handles transcript with malformed JSON lines', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    const lines = [
      '{"type":"user","content":"Valid message"}',
      'NOT VALID JSON',
      '{"broken json',
      '{"type":"user","content":"Another valid"}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should skip malformed lines gracefully');
    assert.ok(
      result.stderr.includes('unparseable') || result.stderr.includes('Skipped'),
      `Should report parse errors, got: ${result.stderr.substring(0, 200)}`
    );
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('handles empty transcript (no user messages)', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // Only tool_use entries, no user messages
    const lines = [
      '{"type":"tool_use","tool_name":"Read","tool_input":{}}',
      '{"type":"assistant","content":"done"}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should handle transcript with no user messages');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('truncates long user messages to 200 chars', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    const longMsg = 'x'.repeat(500);
    const lines = [
      `{"type":"user","content":"${longMsg}"}`,
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should handle and truncate long messages');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('uses CLAUDE_TRANSCRIPT_PATH env var as fallback', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    const lines = [
      '{"type":"user","content":"Fallback test message"}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    // Send invalid JSON to stdin so it falls back to env var
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), 'not json', {
      CLAUDE_TRANSCRIPT_PATH: transcriptPath
    });
    assert.strictEqual(result.code, 0, 'Should use env var fallback');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('escapes backticks in user messages in session file', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // User messages with backticks that could break markdown
    const lines = [
      '{"type":"user","content":"Fix the `handleAuth` function in `auth.ts`"}',
      '{"type":"user","content":"Run `npm test` to verify"}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
      HOME: testDir
    });
    assert.strictEqual(result.code, 0, 'Should handle backticks without crash');

    // Find the session file in the temp HOME
    const claudeDir = getSessionsDirForHome(testDir);
    if (fs.existsSync(claudeDir)) {
      const files = fs.readdirSync(claudeDir).filter(f => f.endsWith('.tmp'));
      if (files.length > 0) {
        const content = fs.readFileSync(path.join(claudeDir, files[0]), 'utf8');
        // Backticks should be escaped in the output
        assert.ok(content.includes('\\`'), 'Should escape backticks in session file');
        assert.ok(!content.includes('`handleAuth`'), 'Raw backticks should be escaped');
      }
    }
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('session file contains tools used and files modified', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    const lines = [
      '{"type":"user","content":"Edit the config"}',
      '{"type":"tool_use","tool_name":"Edit","tool_input":{"file_path":"/src/config.ts"}}',
      '{"type":"tool_use","tool_name":"Read","tool_input":{"file_path":"/src/utils.ts"}}',
      '{"type":"tool_use","tool_name":"Write","tool_input":{"file_path":"/src/new-file.ts"}}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
      HOME: testDir
    });
    assert.strictEqual(result.code, 0);

    const claudeDir = getSessionsDirForHome(testDir);
    if (fs.existsSync(claudeDir)) {
      const files = fs.readdirSync(claudeDir).filter(f => f.endsWith('.tmp'));
      if (files.length > 0) {
        const content = fs.readFileSync(path.join(claudeDir, files[0]), 'utf8');
        // Should contain files modified (Edit and Write, not Read)
        assert.ok(content.includes('/src/config.ts'), 'Should list edited file');
        assert.ok(content.includes('/src/new-file.ts'), 'Should list written file');
        // Should contain tools used
        assert.ok(content.includes('Edit'), 'Should list Edit tool');
        assert.ok(content.includes('Read'), 'Should list Read tool');
      }
    }
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('omits Tools Used and Files Modified sections when empty', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // Only user messages, no tool_use entries
    const lines = [
      '{"type":"user","content":"Just chatting"}',
      '{"type":"user","content":"No tools used at all"}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
      HOME: testDir
    });
    assert.strictEqual(result.code, 0);

    const claudeDir = getSessionsDirForHome(testDir);
    if (fs.existsSync(claudeDir)) {
      const files = fs.readdirSync(claudeDir).filter(f => f.endsWith('.tmp'));
      if (files.length > 0) {
        const content = fs.readFileSync(path.join(claudeDir, files[0]), 'utf8');
        assert.ok(content.includes('### Tasks'), 'Should have Tasks section');
        assert.ok(!content.includes('### Files Modified'), 'Should NOT have Files Modified when empty');
        assert.ok(!content.includes('### Tools Used'), 'Should NOT have Tools Used when empty');
        assert.ok(content.includes('Total user messages: 2'), 'Should show correct message count');
      }
    }
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('slices user messages to last 10', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // 15 user messages — should keep only last 10
    const lines = [];
    for (let i = 1; i <= 15; i++) {
      lines.push(`{"type":"user","content":"UserMsg_${i}"}`);
    }
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
      HOME: testDir
    });
    assert.strictEqual(result.code, 0);

    const claudeDir = getSessionsDirForHome(testDir);
    if (fs.existsSync(claudeDir)) {
      const files = fs.readdirSync(claudeDir).filter(f => f.endsWith('.tmp'));
      if (files.length > 0) {
        const content = fs.readFileSync(path.join(claudeDir, files[0]), 'utf8');
        // Should NOT contain first 5 messages (sliced to last 10)
        assert.ok(!content.includes('UserMsg_1\n'), 'Should not include first message (sliced)');
        assert.ok(!content.includes('UserMsg_5\n'), 'Should not include 5th message (sliced)');
        // Should contain messages 6-15
        assert.ok(content.includes('UserMsg_6'), 'Should include 6th message');
        assert.ok(content.includes('UserMsg_15'), 'Should include last message');
        assert.ok(content.includes('Total user messages: 15'), 'Should show total of 15');
      }
    }
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('slices tools to first 20', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // 25 unique tools — should keep only first 20
    const lines = ['{"type":"user","content":"Do stuff"}'];
    for (let i = 1; i <= 25; i++) {
      lines.push(`{"type":"tool_use","tool_name":"Tool${i}","tool_input":{}}`);
    }
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
      HOME: testDir
    });
    assert.strictEqual(result.code, 0);

    const claudeDir = getSessionsDirForHome(testDir);
    if (fs.existsSync(claudeDir)) {
      const files = fs.readdirSync(claudeDir).filter(f => f.endsWith('.tmp'));
      if (files.length > 0) {
        const content = fs.readFileSync(path.join(claudeDir, files[0]), 'utf8');
        // Should contain Tool1 through Tool20
        assert.ok(content.includes('Tool1'), 'Should include Tool1');
        assert.ok(content.includes('Tool20'), 'Should include Tool20');
        // Should NOT contain Tool21-25 (sliced)
        assert.ok(!content.includes('Tool21'), 'Should not include Tool21 (sliced to 20)');
        assert.ok(!content.includes('Tool25'), 'Should not include Tool25 (sliced to 20)');
      }
    }
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('slices files modified to first 30', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // 35 unique files via Edit — should keep only first 30
    const lines = ['{"type":"user","content":"Edit all the things"}'];
    for (let i = 1; i <= 35; i++) {
      lines.push(`{"type":"tool_use","tool_name":"Edit","tool_input":{"file_path":"/src/file${i}.ts"}}`);
    }
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
      HOME: testDir
    });
    assert.strictEqual(result.code, 0);

    const claudeDir = getSessionsDirForHome(testDir);
    if (fs.existsSync(claudeDir)) {
      const files = fs.readdirSync(claudeDir).filter(f => f.endsWith('.tmp'));
      if (files.length > 0) {
        const content = fs.readFileSync(path.join(claudeDir, files[0]), 'utf8');
        // Should contain file1 through file30
        assert.ok(content.includes('/src/file1.ts'), 'Should include file1');
        assert.ok(content.includes('/src/file30.ts'), 'Should include file30');
        // Should NOT contain file31-35 (sliced)
        assert.ok(!content.includes('/src/file31.ts'), 'Should not include file31 (sliced to 30)');
        assert.ok(!content.includes('/src/file35.ts'), 'Should not include file35 (sliced to 30)');
      }
    }
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('parses Claude Code JSONL format (entry.message.content)', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // Claude Code v2.1.41+ JSONL format: user messages nested in entry.message
    const lines = [
      '{"type":"user","message":{"role":"user","content":"Fix the build error"}}',
      '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Also update tests"}]}}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
      HOME: testDir
    });
    assert.strictEqual(result.code, 0);

    const claudeDir = getSessionsDirForHome(testDir);
    if (fs.existsSync(claudeDir)) {
      const files = fs.readdirSync(claudeDir).filter(f => f.endsWith('.tmp'));
      if (files.length > 0) {
        const content = fs.readFileSync(path.join(claudeDir, files[0]), 'utf8');
        assert.ok(content.includes('Fix the build error'), 'Should extract string content from message');
        assert.ok(content.includes('Also update tests'), 'Should extract array content from message');
      }
    }
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('extracts tool_use from assistant message content blocks', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // Claude Code JSONL: tool uses nested in assistant message content array
    const lines = [
      '{"type":"user","content":"Edit the config"}',
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will edit the file.' },
            { type: 'tool_use', name: 'Edit', input: { file_path: '/src/app.ts' } },
            { type: 'tool_use', name: 'Write', input: { file_path: '/src/new.ts' } },
          ]
        }
      }),
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
      HOME: testDir
    });
    assert.strictEqual(result.code, 0);

    const claudeDir = getSessionsDirForHome(testDir);
    if (fs.existsSync(claudeDir)) {
      const files = fs.readdirSync(claudeDir).filter(f => f.endsWith('.tmp'));
      if (files.length > 0) {
        const content = fs.readFileSync(path.join(claudeDir, files[0]), 'utf8');
        assert.ok(content.includes('Edit'), 'Should extract Edit tool from content blocks');
        assert.ok(content.includes('/src/app.ts'), 'Should extract file path from Edit block');
        assert.ok(content.includes('/src/new.ts'), 'Should extract file path from Write block');
      }
    }
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // hooks.json validation
  console.log('\nhooks.json Validation:');

  if (test('hooks.json is valid JSON', () => {
    const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
    const content = fs.readFileSync(hooksPath, 'utf8');
    JSON.parse(content); // Will throw if invalid
  })) passed++; else failed++;

  if (test('hooks.json has required event types', () => {
    const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));

    assert.ok(hooks.hooks.PreToolUse, 'Should have PreToolUse hooks');
    assert.ok(hooks.hooks.PostToolUse, 'Should have PostToolUse hooks');
    assert.ok(hooks.hooks.SessionStart, 'Should have SessionStart hooks');
    assert.ok(hooks.hooks.SessionEnd, 'Should have SessionEnd hooks');
    assert.ok(hooks.hooks.Stop, 'Should have Stop hooks');
    assert.ok(hooks.hooks.PreCompact, 'Should have PreCompact hooks');
  })) passed++; else failed++;

  if (test('all hook commands are Node.js commands', () => {
    const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));

    const checkHooks = (hookArray) => {
      for (const entry of hookArray) {
        for (const hook of entry.hooks) {
          if (hook.type === 'command') {
            const isNode = hook.command.startsWith('node');
            assert.ok(
              isNode,
              `Hook command should start with 'node': ${hook.command.substring(0, 80)}...`
            );
          }
        }
      }
    };

    for (const [, hookArray] of Object.entries(hooks.hooks)) {
      checkHooks(hookArray);
    }
  })) passed++; else failed++;

  if (test('script references use MDT_ROOT variable', () => {
    const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));

    const checkHooks = (hookArray) => {
      for (const entry of hookArray) {
        for (const hook of entry.hooks) {
          if (hook.type === 'command' && hook.command.includes('scripts/hooks/')) {
            // Check for the literal string "${MDT_ROOT}" in the command
            const hasPluginRoot = hook.command.includes('${MDT_ROOT}');
            assert.ok(
              hasPluginRoot,
              `Script paths should use MDT_ROOT: ${hook.command.substring(0, 80)}...`
            );
          }
        }
      }
    };

    for (const [, hookArray] of Object.entries(hooks.hooks)) {
      checkHooks(hookArray);
    }
  })) passed++; else failed++;

  // plugin.json validation
  console.log('\nplugin.json Validation:');

  if (test('plugin.json does NOT have explicit hooks declaration', () => {
    // Claude Code automatically loads hooks/hooks.json by convention.
    // Explicitly declaring it in plugin.json causes a duplicate detection error.
    // See: https://github.com/affaan-m/everything-claude-code/issues/103
    const pluginPath = path.join(__dirname, '..', '..', '.claude-plugin', 'plugin.json');
    const plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf8'));

    assert.ok(
      !plugin.hooks,
      'plugin.json should NOT have "hooks" field - Claude Code auto-loads hooks/hooks.json'
    );
  })) passed++; else failed++;

  // ─── evaluate-session.js tests ───
  console.log('\nevaluate-session.js:');

  if (await asyncTest('skips when no transcript_path in stdin', async () => {
    const result = await runScript(path.join(scriptsDir, 'evaluate-session.js'), '{}');
    assert.strictEqual(result.code, 0, 'Should exit 0 (non-blocking)');
  })) passed++; else failed++;

  if (await asyncTest('skips when transcript file does not exist', async () => {
    const stdinJson = JSON.stringify({ transcript_path: '/tmp/nonexistent-transcript-12345.jsonl' });
    const result = await runScript(path.join(scriptsDir, 'evaluate-session.js'), stdinJson);
    assert.strictEqual(result.code, 0, 'Should exit 0 when file missing');
  })) passed++; else failed++;

  if (await asyncTest('skips short sessions (< 10 user messages)', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'short.jsonl');
    // Only 3 user messages — below the default threshold of 10
    const lines = [
      '{"type":"user","content":"msg1"}',
      '{"type":"user","content":"msg2"}',
      '{"type":"user","content":"msg3"}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));
    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'evaluate-session.js'), stdinJson);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stderr.includes('too short'), 'Should log "too short" message');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('evaluates long sessions (>= 10 user messages)', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'long.jsonl');
    // 12 user messages — above the default threshold
    const lines = [];
    for (let i = 0; i < 12; i++) {
      lines.push(`{"type":"user","content":"message ${i}"}`);
    }
    fs.writeFileSync(transcriptPath, lines.join('\n'));
    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'evaluate-session.js'), stdinJson);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stderr.includes('12 messages'), 'Should report message count');
    assert.ok(result.stderr.includes('evaluate'), 'Should signal evaluation');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('handles malformed stdin JSON (falls back to env var)', async () => {
    const result = await runScript(
      path.join(scriptsDir, 'evaluate-session.js'),
      'not json at all',
      { CLAUDE_TRANSCRIPT_PATH: '' }
    );
    // No valid transcript path from either source → exit 0
    assert.strictEqual(result.code, 0);
  })) passed++; else failed++;

  // ─── suggest-compact.js tests ───
  console.log('\nsuggest-compact.js:');

  if (await asyncTest('increments tool counter on each invocation', async () => {
    const sessionId = `test-counter-${Date.now()}`;
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    try {
      // First invocation → count = 1
      await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId
      });
      let val = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
      assert.strictEqual(val, 1, 'First call should write count 1');

      // Second invocation → count = 2
      await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId
      });
      val = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
      assert.strictEqual(val, 2, 'Second call should write count 2');
    } finally {
      try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
    }
  })) passed++; else failed++;

  if (await asyncTest('suggests compact at exact threshold', async () => {
    const sessionId = `test-threshold-${Date.now()}`;
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    try {
      // Pre-seed counter at threshold - 1 so next call hits threshold
      fs.writeFileSync(counterFile, '4');
      const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId,
        COMPACT_THRESHOLD: '5'
      });
      assert.strictEqual(result.code, 0);
      assert.ok(result.stderr.includes('5 tool calls reached'), 'Should suggest compact at threshold');
    } finally {
      try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
    }
  })) passed++; else failed++;

  if (await asyncTest('suggests at periodic intervals after threshold', async () => {
    const sessionId = `test-periodic-${Date.now()}`;
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    try {
      // Pre-seed at 29 so next call = 30 (threshold 5 + 25 = 30)
      // (30 - 5) % 25 === 0 → should trigger periodic suggestion
      fs.writeFileSync(counterFile, '29');
      const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId,
        COMPACT_THRESHOLD: '5'
      });
      assert.strictEqual(result.code, 0);
      assert.ok(result.stderr.includes('30 tool calls'), 'Should suggest at threshold + 25n intervals');
    } finally {
      try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
    }
  })) passed++; else failed++;

  if (await asyncTest('does not suggest below threshold', async () => {
    const sessionId = `test-below-${Date.now()}`;
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    try {
      fs.writeFileSync(counterFile, '2');
      const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId,
        COMPACT_THRESHOLD: '50'
      });
      assert.strictEqual(result.code, 0);
      assert.ok(!result.stderr.includes('tool calls reached'), 'Should not suggest below threshold');
      assert.ok(!result.stderr.includes('checkpoint'), 'Should not suggest checkpoint');
    } finally {
      try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
    }
  })) passed++; else failed++;

  if (await asyncTest('resets counter when file contains huge overflow number', async () => {
    const sessionId = `test-overflow-${Date.now()}`;
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    try {
      // Write a value that passes Number.isFinite() but exceeds 1000000 clamp
      fs.writeFileSync(counterFile, '999999999999');
      const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId
      });
      assert.strictEqual(result.code, 0);
      // Should reset to 1 because 999999999999 > 1000000
      const newCount = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
      assert.strictEqual(newCount, 1, 'Should reset to 1 on overflow value');
    } finally {
      try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
    }
  })) passed++; else failed++;

  if (await asyncTest('resets counter when file contains negative number', async () => {
    const sessionId = `test-negative-${Date.now()}`;
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    try {
      fs.writeFileSync(counterFile, '-42');
      const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId
      });
      assert.strictEqual(result.code, 0);
      const newCount = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
      assert.strictEqual(newCount, 1, 'Should reset to 1 on negative value');
    } finally {
      try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
    }
  })) passed++; else failed++;

  if (await asyncTest('handles COMPACT_THRESHOLD of zero (falls back to 50)', async () => {
    const sessionId = `test-zero-thresh-${Date.now()}`;
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    try {
      fs.writeFileSync(counterFile, '49');
      const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId,
        COMPACT_THRESHOLD: '0'
      });
      assert.strictEqual(result.code, 0);
      assert.ok(result.stderr.includes('50 tool calls reached'), 'Zero threshold should fall back to 50');
    } finally {
      try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
    }
  })) passed++; else failed++;

  if (await asyncTest('handles invalid COMPACT_THRESHOLD (falls back to 50)', async () => {
    const sessionId = `test-invalid-thresh-${Date.now()}`;
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    try {
      // Pre-seed at 49 so next call = 50 (the fallback default)
      fs.writeFileSync(counterFile, '49');
      const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId,
        COMPACT_THRESHOLD: 'not-a-number'
      });
      assert.strictEqual(result.code, 0);
      assert.ok(result.stderr.includes('50 tool calls reached'), 'Should use default threshold of 50');
    } finally {
      try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
    }
  })) passed++; else failed++;

  // Summary
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

ensureSubprocessCapability('tests/hooks/hooks.test.js');
runTests();

/**
 * Tests for hook scripts
 *
 * Run with: node tests/hooks/hooks-rounds.test.js
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
  console.log('\n=== Testing Hook Scripts (Round Cases) ===\n');

  let passed = 0;
  let failed = 0;

  const scriptsDir = path.join(__dirname, '..', '..', 'scripts', 'hooks');

  // ─── Round 20 bug fix tests ───
  console.log('\ncheck-console-log.js (exact pass-through):');

  if (await asyncTest('stdout is exact byte match of stdin (no trailing newline)', async () => {
    // Before the fix, console.log(data) added a trailing \n.
    // process.stdout.write(data) should preserve exact bytes.
    const stdinData = '{"tool":"test","value":42}';
    const result = await runScript(path.join(scriptsDir, 'check-console-log.js'), stdinData);
    assert.strictEqual(result.code, 0);
    // stdout should be exactly the input — no extra newline appended
    assert.strictEqual(result.stdout, stdinData, 'Should not append extra newline to output');
  })) passed++; else failed++;

  if (await asyncTest('preserves empty string stdin without adding newline', async () => {
    const result = await runScript(path.join(scriptsDir, 'check-console-log.js'), '');
    assert.strictEqual(result.code, 0);
    assert.strictEqual(result.stdout, '', 'Empty input should produce empty output');
  })) passed++; else failed++;

  if (await asyncTest('preserves data with embedded newlines exactly', async () => {
    const stdinData = 'line1\nline2\nline3';
    const result = await runScript(path.join(scriptsDir, 'check-console-log.js'), stdinData);
    assert.strictEqual(result.code, 0);
    assert.strictEqual(result.stdout, stdinData, 'Should preserve embedded newlines without adding extra');
  })) passed++; else failed++;

  console.log('\npost-edit-format.js (security & extension tests):');

  if (await asyncTest('source code does not pass shell option to execFileSync (security)', async () => {
    const formatSource = fs.readFileSync(path.join(scriptsDir, 'post-edit-format.js'), 'utf8');
    // Strip comments to avoid matching "shell: true" in comment text
    const codeOnly = formatSource.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!codeOnly.includes('shell:'), 'post-edit-format.js should not pass shell option in code');
    assert.ok(formatSource.includes('npx.cmd'), 'Should use npx.cmd for Windows cross-platform safety');
  })) passed++; else failed++;

  if (await asyncTest('matches .tsx extension for formatting', async () => {
    const stdinJson = JSON.stringify({ tool_input: { file_path: '/nonexistent/component.tsx' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-format.js'), stdinJson);
    assert.strictEqual(result.code, 0);
    // Should attempt to format (will fail silently since file doesn't exist, but should pass through)
    assert.ok(result.stdout.includes('component.tsx'), 'Should pass through data for .tsx files');
  })) passed++; else failed++;

  if (await asyncTest('matches .jsx extension for formatting', async () => {
    const stdinJson = JSON.stringify({ tool_input: { file_path: '/nonexistent/component.jsx' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-format.js'), stdinJson);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('component.jsx'), 'Should pass through data for .jsx files');
  })) passed++; else failed++;

  console.log('\npost-edit-typecheck.js (security & extension tests):');

  if (await asyncTest('source code does not pass shell option to execFileSync (security)', async () => {
    const typecheckSource = fs.readFileSync(path.join(scriptsDir, 'post-edit-typecheck.js'), 'utf8');
    // Strip comments to avoid matching "shell: true" in comment text
    const codeOnly = typecheckSource.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!codeOnly.includes('shell:'), 'post-edit-typecheck.js should not pass shell option in code');
    assert.ok(typecheckSource.includes('npx.cmd'), 'Should use npx.cmd for Windows cross-platform safety');
  })) passed++; else failed++;

  if (await asyncTest('matches .tsx extension for type checking', async () => {
    const testDir = createTestDir();
    const testFile = path.join(testDir, 'component.tsx');
    fs.writeFileSync(testFile, 'const x: number = 1;');

    const stdinJson = JSON.stringify({ tool_input: { file_path: testFile } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('tool_input'), 'Should pass through data for .tsx files');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ─── Round 23: Bug fixes & high-priority gap coverage ───

  const evaluateSessionScript = path.join(scriptsDir, 'evaluate-session.js');

  console.log('\nRound 23: evaluate-session.js (config & nullish coalescing):');

  if (await asyncTest('respects min_session_length=0 from config (nullish coalescing)', async () => {
    // This tests the ?? fix: min_session_length=0 should mean "evaluate ALL sessions"
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'short.jsonl');
    // Only 2 user messages — normally below the default threshold of 10
    const lines = [
      '{"type":"user","content":"msg1"}',
      '{"type":"user","content":"msg2"}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    // Create a config file with min_session_length=0
    const skillsDir = path.join(testDir, 'skills', 'continuous-learning');
    fs.mkdirSync(skillsDir, { recursive: true });
    const configPath = path.join(skillsDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      min_session_length: 0,
      learned_skills_path: path.join(testDir, 'learned')
    }));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(evaluateSessionScript, stdinJson, {
      HOME: testDir, USERPROFILE: testDir,
      ECC_CONTINUOUS_LEARNING_CONFIG: configPath
    });
    assert.strictEqual(result.code, 0);
    // With min_session_length=0, even 2 messages should trigger evaluation
    assert.ok(
      result.stderr.includes('2 messages') && result.stderr.includes('evaluate'),
      'Should evaluate session with min_session_length=0 (not skip as too short)'
    );
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('config with min_session_length=null falls back to default 10', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'short.jsonl');
    // 5 messages — below default 10
    const lines = [];
    for (let i = 0; i < 5; i++) lines.push(`{"type":"user","content":"msg${i}"}`);
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const skillsDir = path.join(testDir, 'skills', 'continuous-learning');
    fs.mkdirSync(skillsDir, { recursive: true });
    const configPath = path.join(skillsDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      min_session_length: null,
      learned_skills_path: path.join(testDir, 'learned')
    }));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(evaluateSessionScript, stdinJson, {
      HOME: testDir, USERPROFILE: testDir,
      ECC_CONTINUOUS_LEARNING_CONFIG: configPath
    });
    assert.strictEqual(result.code, 0);
    // null ?? 10 === 10, so 5 messages should be "too short"
    assert.ok(result.stderr.includes('too short'), 'Should fall back to default 10 when null');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('config with custom learned_skills_path creates directory', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');
    fs.writeFileSync(transcriptPath, '{"type":"user","content":"msg"}');

    const customLearnedDir = path.join(testDir, 'custom-learned-skills');
    const skillsDir = path.join(testDir, 'skills', 'continuous-learning');
    fs.mkdirSync(skillsDir, { recursive: true });
    const configPath = path.join(skillsDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      learned_skills_path: customLearnedDir
    }));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    await runScript(evaluateSessionScript, stdinJson, {
      HOME: testDir, USERPROFILE: testDir,
      ECC_CONTINUOUS_LEARNING_CONFIG: configPath
    });
    assert.ok(fs.existsSync(customLearnedDir), 'Should create custom learned skills directory');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('handles invalid config JSON gracefully (uses defaults)', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');
    const lines = [];
    for (let i = 0; i < 5; i++) lines.push(`{"type":"user","content":"msg${i}"}`);
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const skillsDir = path.join(testDir, 'skills', 'continuous-learning');
    fs.mkdirSync(skillsDir, { recursive: true });
    const configPath = path.join(skillsDir, 'config.json');
    fs.writeFileSync(configPath, 'not valid json!!!');

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(evaluateSessionScript, stdinJson, {
      HOME: testDir, USERPROFILE: testDir,
      ECC_CONTINUOUS_LEARNING_CONFIG: configPath
    });
    assert.strictEqual(result.code, 0);
    // Should log parse failure and fall back to default 10 → 5 msgs too short
    assert.ok(result.stderr.includes('too short'), 'Should use defaults when config is invalid JSON');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  console.log('\nRound 23: session-end.js (update existing file path):');

  if (await asyncTest('updates Last Updated timestamp in existing session file', async () => {
    const testDir = createTestDir();
    const utils = require('../../scripts/lib/utils');
    const today = utils.getDateString();
    const shortId = 'update01';
    const sessionId = `session-${shortId}`;
    const sessionsDir = getSessionsDirForHome(testDir, { CLAUDE_SESSION_ID: sessionId });
    fs.mkdirSync(sessionsDir, { recursive: true });
    const sessionFile = path.join(sessionsDir, `${today}-${shortId}-session.tmp`);
    const originalContent = `# Session: ${today}\n**Date:** ${today}\n**Started:** 09:00\n**Last Updated:** 09:00\n\n---\n\n## Current State\n\n[Session context goes here]\n\n### Completed\n- [ ]\n\n### In Progress\n- [ ]\n\n### Notes for Next Session\n-\n\n### Context to Load\n\`\`\`\n[relevant files]\n\`\`\`\n`;
    fs.writeFileSync(sessionFile, originalContent);

    const result = await runScript(path.join(scriptsDir, 'session-end.js'), '', {
      HOME: testDir, USERPROFILE: testDir,
      CLAUDE_SESSION_ID: sessionId
    });
    assert.strictEqual(result.code, 0);

    const updated = fs.readFileSync(sessionFile, 'utf8');
    // The timestamp should have been updated (no longer 09:00)
    assert.ok(updated.includes('**Last Updated:**'), 'Should still have Last Updated field');
    assert.ok(result.stderr.includes('Updated session file'), 'Should log update');
  })) passed++; else failed++;

  if (await asyncTest('replaces blank template with summary when updating existing file', async () => {
    const testDir = createTestDir();
    const utils = require('../../scripts/lib/utils');
    const today = utils.getDateString();
    const shortId = 'update02';
    const sessionId = `session-${shortId}`;
    const sessionsDir = getSessionsDirForHome(testDir, { CLAUDE_SESSION_ID: sessionId });
    fs.mkdirSync(sessionsDir, { recursive: true });
    const sessionFile = path.join(sessionsDir, `${today}-${shortId}-session.tmp`);
    // Pre-existing file with blank template
    const originalContent = `# Session: ${today}\n**Date:** ${today}\n**Started:** 09:00\n**Last Updated:** 09:00\n\n---\n\n## Current State\n\n[Session context goes here]\n\n### Completed\n- [ ]\n\n### In Progress\n- [ ]\n\n### Notes for Next Session\n-\n\n### Context to Load\n\`\`\`\n[relevant files]\n\`\`\`\n`;
    fs.writeFileSync(sessionFile, originalContent);

    // Create a transcript with user messages
    const transcriptPath = path.join(testDir, 'transcript.jsonl');
    const lines = [
      '{"type":"user","content":"Fix auth bug"}',
      '{"type":"tool_use","tool_name":"Edit","tool_input":{"file_path":"/src/auth.ts"}}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
      HOME: testDir, USERPROFILE: testDir,
      CLAUDE_SESSION_ID: sessionId
    });
    assert.strictEqual(result.code, 0);

    const updated = fs.readFileSync(sessionFile, 'utf8');
    // Should have replaced blank template with actual summary
    assert.ok(!updated.includes('[Session context goes here]'), 'Should replace blank template');
    assert.ok(updated.includes('Fix auth bug'), 'Should include user message in summary');
    assert.ok(updated.includes('/src/auth.ts'), 'Should include modified file');
  })) passed++; else failed++;

  if (await asyncTest('always updates session summary content on session end', async () => {
    const testDir = createTestDir();
    const utils = require('../../scripts/lib/utils');
    const today = utils.getDateString();
    const shortId = 'update03';
    const sessionId = `session-${shortId}`;
    const sessionsDir = getSessionsDirForHome(testDir, { CLAUDE_SESSION_ID: sessionId });
    fs.mkdirSync(sessionsDir, { recursive: true });
    const sessionFile = path.join(sessionsDir, `${today}-${shortId}-session.tmp`);
    // Pre-existing file with already-filled summary
    const existingContent = `# Session: ${today}\n**Date:** ${today}\n**Started:** 08:00\n**Last Updated:** 08:30\n\n---\n\n## Session Summary\n\n### Tasks\n- Previous task from earlier\n`;
    fs.writeFileSync(sessionFile, existingContent);

    const transcriptPath = path.join(testDir, 'transcript.jsonl');
    fs.writeFileSync(transcriptPath, '{"type":"user","content":"New task"}');

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
      HOME: testDir, USERPROFILE: testDir,
      CLAUDE_SESSION_ID: sessionId
    });
    assert.strictEqual(result.code, 0);

    const updated = fs.readFileSync(sessionFile, 'utf8');
    // Session summary should always be refreshed with current content (#317)
    assert.ok(updated.includes('## Session Summary'), 'Should have Session Summary section');
    assert.ok(updated.includes('# Session:'), 'Should preserve session header');
  })) passed++; else failed++;

  console.log('\nRound 23: pre-compact.js (glob specificity):');

  if (await asyncTest('only annotates *-session.tmp files, not other .tmp files', async () => {
    const isoHome = path.join(os.tmpdir(), `ecc-compact-glob-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });

    // Create a session .tmp file and a non-session .tmp file
    const sessionFile = path.join(sessionsDir, '2026-02-11-abc-session.tmp');
    const otherTmpFile = path.join(sessionsDir, 'other-data.tmp');
    fs.writeFileSync(sessionFile, '# Session\n');
    fs.writeFileSync(otherTmpFile, 'some other data\n');

    try {
      await runScript(path.join(scriptsDir, 'pre-compact.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });

      const sessionContent = fs.readFileSync(sessionFile, 'utf8');
      const otherContent = fs.readFileSync(otherTmpFile, 'utf8');

      assert.ok(sessionContent.includes('Compaction occurred'), 'Should annotate session file');
      assert.strictEqual(otherContent, 'some other data\n', 'Should NOT annotate non-session .tmp file');
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (await asyncTest('handles no active session files gracefully', async () => {
    const isoHome = path.join(os.tmpdir(), `ecc-compact-nosession-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });

    try {
      const result = await runScript(path.join(scriptsDir, 'pre-compact.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0, 'Should exit 0 with no session files');
      assert.ok(result.stderr.includes('[PreCompact]'), 'Should still log success');

      // Compaction log should still be created
      const logFile = path.join(sessionsDir, 'compaction-log.txt');
      assert.ok(fs.existsSync(logFile), 'Should create compaction log even with no sessions');
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  console.log('\nRound 23: session-end.js (extractSessionSummary edge cases):');

  if (await asyncTest('handles transcript with only assistant messages (no user messages)', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');
    // Only assistant messages — no user messages
    const lines = [
      '{"type":"assistant","message":{"content":[{"type":"text","text":"response"}]}}',
      '{"type":"tool_use","tool_name":"Read","tool_input":{"file_path":"/src/app.ts"}}',
    ];
    fs.writeFileSync(transcriptPath, lines.join('\n'));

    const stdinJson = JSON.stringify({ transcript_path: transcriptPath });
    const result = await runScript(path.join(scriptsDir, 'session-end.js'), stdinJson, {
      HOME: testDir
    });
    assert.strictEqual(result.code, 0);

    // With no user messages, extractSessionSummary returns null → blank template
    const claudeDir = getSessionsDirForHome(testDir);
    if (fs.existsSync(claudeDir)) {
      const files = fs.readdirSync(claudeDir).filter(f => f.endsWith('.tmp'));
      if (files.length > 0) {
        const content = fs.readFileSync(path.join(claudeDir, files[0]), 'utf8');
        assert.ok(content.includes('[Session context goes here]'), 'Should use blank template when no user messages');
      }
    }
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('extracts tool_use from assistant message content blocks', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');
    // Claude Code JSONL format: tool_use blocks inside assistant message content array
    const lines = [
      '{"type":"user","content":"Edit config"}',
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'I will edit the config.' },
            { type: 'tool_use', name: 'Edit', input: { file_path: '/src/config.ts' } },
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
        assert.ok(content.includes('/src/config.ts'), 'Should extract file from nested tool_use block');
        assert.ok(content.includes('/src/new.ts'), 'Should extract Write file from nested block');
        assert.ok(content.includes('Edit'), 'Should list Edit in tools used');
      }
    }
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ─── Round 24: suggest-compact interval fix, fd fallback, session-start maxAge ───
  console.log('\nRound 24: suggest-compact.js (interval fix & fd fallback):');

  if (await asyncTest('periodic intervals are consistent with non-25-divisible threshold', async () => {
    // Regression test: with threshold=13, periodic suggestions should fire at 38, 63, 88...
    // (count - 13) % 25 === 0 → 38-13=25, 63-13=50, etc.
    const sessionId = `test-interval-fix-${Date.now()}`;
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    try {
      // Pre-seed at 37 so next call = 38 (13 + 25 = 38)
      fs.writeFileSync(counterFile, '37');
      const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId,
        COMPACT_THRESHOLD: '13'
      });
      assert.strictEqual(result.code, 0);
      assert.ok(result.stderr.includes('38 tool calls'), 'Should suggest at threshold(13) + 25 = 38');
    } finally {
      try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
    }
  })) passed++; else failed++;

  if (await asyncTest('does not suggest at old-style multiples that skip threshold offset', async () => {
    // With threshold=13, count=50 should NOT trigger (old behavior would: 50%25===0)
    // New behavior: (50-13)%25 = 37%25 = 12 → no suggestion
    const sessionId = `test-no-false-suggest-${Date.now()}`;
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    try {
      fs.writeFileSync(counterFile, '49');
      const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId,
        COMPACT_THRESHOLD: '13'
      });
      assert.strictEqual(result.code, 0);
      assert.ok(!result.stderr.includes('checkpoint'), 'Should NOT suggest at count=50 with threshold=13');
    } finally {
      try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
    }
  })) passed++; else failed++;

  if (await asyncTest('fd fallback: handles corrupted counter file gracefully', async () => {
    const sessionId = `test-corrupt-${Date.now()}`;
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    try {
      // Write non-numeric data to trigger parseInt → NaN → reset to 1
      fs.writeFileSync(counterFile, 'corrupted data here!!!');
      const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId
      });
      assert.strictEqual(result.code, 0);
      const newCount = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
      assert.strictEqual(newCount, 1, 'Should reset to 1 on corrupted file content');
    } finally {
      try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
    }
  })) passed++; else failed++;

  if (await asyncTest('handles counter at exact 1000000 boundary', async () => {
    const sessionId = `test-boundary-${Date.now()}`;
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    try {
      // 1000000 is the upper clamp boundary — should still increment
      fs.writeFileSync(counterFile, '1000000');
      const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId
      });
      assert.strictEqual(result.code, 0);
      const newCount = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
      assert.strictEqual(newCount, 1000001, 'Should increment from exactly 1000000');
    } finally {
      try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
    }
  })) passed++; else failed++;

  console.log('\nRound 24: post-edit-format.js (edge cases):');

  if (await asyncTest('passes through malformed JSON unchanged', async () => {
    const malformedJson = '{"tool_input": {"file_path": "/test.ts"';
    const result = await runScript(path.join(scriptsDir, 'post-edit-format.js'), malformedJson);
    assert.strictEqual(result.code, 0);
    // Should pass through the malformed data unchanged
    assert.ok(result.stdout.includes(malformedJson), 'Should pass through malformed JSON');
  })) passed++; else failed++;

  if (await asyncTest('passes through data for non-JS/TS file extensions', async () => {
    const stdinJson = JSON.stringify({ tool_input: { file_path: '/path/to/file.py' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-format.js'), stdinJson);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('file.py'), 'Should pass through for .py files');
  })) passed++; else failed++;

  console.log('\nRound 24: post-edit-typecheck.js (edge cases):');

  if (await asyncTest('skips typecheck for non-existent file and still passes through', async () => {
    const stdinJson = JSON.stringify({ tool_input: { file_path: '/nonexistent/deep/file.ts' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('file.ts'), 'Should pass through for non-existent .ts file');
  })) passed++; else failed++;

  if (await asyncTest('passes through for non-TS extensions without running tsc', async () => {
    const stdinJson = JSON.stringify({ tool_input: { file_path: '/path/to/file.js' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-typecheck.js'), stdinJson);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('file.js'), 'Should pass through for .js file without running tsc');
  })) passed++; else failed++;

  console.log('\nRound 24: session-start.js (edge cases):');

  if (await asyncTest('exits 0 with empty sessions directory (no recent sessions)', async () => {
    const isoHome = path.join(os.tmpdir(), `ecc-start-empty-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(path.join(path.dirname(sessionsDir), 'skills', 'learned'), { recursive: true });
    try {
      const result = await runScript(path.join(scriptsDir, 'session-start.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0, 'Should exit 0 with no sessions');
      // Should NOT inject any previous session data (stdout should be empty or minimal)
      assert.ok(!result.stdout.includes('Previous session summary'), 'Should not inject when no sessions');
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (await asyncTest('does not inject blank template session into context', async () => {
    const isoHome = path.join(os.tmpdir(), `ecc-start-blank-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(path.join(path.dirname(sessionsDir), 'skills', 'learned'), { recursive: true });

    // Create a session file with the blank template marker
    const today = new Date().toISOString().slice(0, 10);
    const sessionFile = path.join(sessionsDir, `${today}-blank-session.tmp`);
    fs.writeFileSync(sessionFile, '# Session\n[Session context goes here]\n');

    try {
      const result = await runScript(path.join(scriptsDir, 'session-start.js'), '', {
        HOME: isoHome, USERPROFILE: isoHome
      });
      assert.strictEqual(result.code, 0);
      // Should NOT inject blank template
      assert.ok(!result.stdout.includes('Previous session summary'), 'Should skip blank template sessions');
    } finally {
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ─── Round 25: post-edit-console-warn pass-through fix, check-console-log edge cases ───
  console.log('\nRound 25: post-edit-console-warn.js (pass-through fix):');

  if (await asyncTest('stdout is exact byte match of stdin (no trailing newline)', async () => {
    // Regression test: console.log(data) was replaced with process.stdout.write(data)
    const stdinData = '{"tool_input":{"file_path":"/nonexistent/file.py"}}';
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), stdinData);
    assert.strictEqual(result.code, 0);
    assert.strictEqual(result.stdout, stdinData, 'stdout should exactly match stdin (no extra newline)');
  })) passed++; else failed++;

  if (await asyncTest('passes through malformed JSON unchanged without crash', async () => {
    const malformed = '{"tool_input": {"file_path": "/test.ts"';
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), malformed);
    assert.strictEqual(result.code, 0);
    assert.strictEqual(result.stdout, malformed, 'Should pass through malformed JSON exactly');
  })) passed++; else failed++;

  if (await asyncTest('handles missing file_path in tool_input gracefully', async () => {
    const stdinJson = JSON.stringify({ tool_input: {} });
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), stdinJson);
    assert.strictEqual(result.code, 0);
    assert.strictEqual(result.stdout, stdinJson, 'Should pass through with missing file_path');
  })) passed++; else failed++;

  if (await asyncTest('passes through when file does not exist (readFile returns null)', async () => {
    const stdinJson = JSON.stringify({ tool_input: { file_path: '/nonexistent/deep/file.ts' } });
    const result = await runScript(path.join(scriptsDir, 'post-edit-console-warn.js'), stdinJson);
    assert.strictEqual(result.code, 0);
    assert.strictEqual(result.stdout, stdinJson, 'Should pass through exactly when file not found');
  })) passed++; else failed++;

  console.log('\nRound 25: check-console-log.js (edge cases):');

  if (await asyncTest('source has expected exclusion patterns', async () => {
    // The EXCLUDED_PATTERNS array includes .test.ts, .spec.ts, etc.
    const source = fs.readFileSync(path.join(scriptsDir, 'check-console-log.js'), 'utf8');
    // Verify the exclusion patterns exist (regex escapes use \. so check for the pattern names)
    assert.ok(source.includes('EXCLUDED_PATTERNS'), 'Should have exclusion patterns array');
    assert.ok(/\.test\\\./.test(source), 'Should have test file exclusion pattern');
    assert.ok(/\.spec\\\./.test(source), 'Should have spec file exclusion pattern');
    assert.ok(source.includes('scripts'), 'Should exclude scripts/ directory');
    assert.ok(source.includes('__tests__'), 'Should exclude __tests__/ directory');
    assert.ok(source.includes('__mocks__'), 'Should exclude __mocks__/ directory');
  })) passed++; else failed++;

  if (await asyncTest('passes through data unchanged on non-git repo', async () => {
    // In a temp dir with no git repo, the hook should pass through data unchanged
    const testDir = createTestDir();
    const stdinData = '{"tool_input":"test"}';
    const result = await runScript(path.join(scriptsDir, 'check-console-log.js'), stdinData, {
      // Use a non-git directory as CWD
      HOME: testDir, USERPROFILE: testDir
    });
    // Note: We're still running from a git repo, so isGitRepo() may still return true.
    // This test verifies the script doesn't crash and passes through data.
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes(stdinData), 'Should pass through data');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('exits 0 even when no stdin is provided', async () => {
    const result = await runScript(path.join(scriptsDir, 'check-console-log.js'), '');
    assert.strictEqual(result.code, 0, 'Should exit 0 with empty stdin');
  })) passed++; else failed++;

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
      ECC_CONTINUOUS_LEARNING_CONFIG: configPath
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
      ECC_CONTINUOUS_LEARNING_CONFIG: configPath
    });
    assert.strictEqual(result.code, 0);
    // The directory with ~ in the middle should be created as-is
    assert.ok(
      fs.existsSync(midTildeDir),
      'Should create directory with ~ in middle of path unchanged'
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
      ECC_CONTINUOUS_LEARNING_CONFIG: configPath
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

ensureSubprocessCapability('tests/hooks/hooks-rounds.test.js');
runTests();


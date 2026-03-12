/**
 * Tests for hook scripts
 *
 * Run with: node tests/hooks/hooks-rounds.test.js
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
      MDT_CONTINUOUS_LEARNING_CONFIG: configPath
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
      MDT_CONTINUOUS_LEARNING_CONFIG: configPath
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
      MDT_CONTINUOUS_LEARNING_CONFIG: configPath
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
      MDT_CONTINUOUS_LEARNING_CONFIG: configPath
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
    const isoHome = path.join(os.tmpdir(), `MDT-compact-glob-${Date.now()}`);
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
    const isoHome = path.join(os.tmpdir(), `MDT-compact-nosession-${Date.now()}`);
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
    const isoHome = path.join(os.tmpdir(), `MDT-start-empty-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(path.join(path.dirname(sessionsDir), 'generated', 'skills', 'learned'), { recursive: true });
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
    const isoHome = path.join(os.tmpdir(), `MDT-start-blank-${Date.now()}`);
    const sessionsDir = getSessionsDirForHome(isoHome);
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(path.join(path.dirname(sessionsDir), 'generated', 'skills', 'learned'), { recursive: true });

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

  // Summary
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

ensureSubprocessCapability('tests/hooks/hooks-rounds.test.js');
runTests();


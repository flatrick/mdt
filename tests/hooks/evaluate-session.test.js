/**
 * Tests for scripts/hooks/evaluate-session.js
 *
 * Run with: node tests/hooks/evaluate-session.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { evaluateSession, expandConfiguredPath } = require('../../scripts/hooks/evaluate-session');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');

function createTranscript(dir, messageCount) {
  const filePath = path.join(dir, 'transcript.jsonl');
  const lines = [];
  for (let i = 0; i < messageCount; i++) {
    lines.push(JSON.stringify({ type: 'user', content: `Message ${i + 1}` }));
    lines.push(JSON.stringify({ type: 'assistant', content: `Response ${i + 1}` }));
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
  return filePath;
}

function runTests() {
  console.log('\n=== Testing evaluate-session.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('returns too-short for 9 user messages with default threshold', () => {
    const testDir = createTestDir('eval-session-test-');
    const transcript = createTranscript(testDir, 9);
    const logs = [];
    try {
      const result = evaluateSession({
        input: { transcript_path: transcript },
        env: { ...process.env, DATA_DIR: path.join(testDir, '.cursor', 'mdt') },
        logger: msg => logs.push(msg)
      });
      assert.strictEqual(result.shouldEvaluate, false);
      assert.strictEqual(result.reason, 'too-short');
      assert.strictEqual(result.messageCount, 9);
      assert.ok(logs.some(msg => msg.includes('too short')));
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  if (test('returns evaluate for 10 user messages with default threshold', () => {
    const testDir = createTestDir('eval-session-test-');
    const transcript = createTranscript(testDir, 10);
    const logs = [];
    try {
      const result = evaluateSession({
        input: { transcript_path: transcript },
        env: { ...process.env, DATA_DIR: path.join(testDir, '.cursor', 'mdt') },
        logger: msg => logs.push(msg)
      });
      assert.strictEqual(result.shouldEvaluate, true);
      assert.strictEqual(result.reason, 'evaluate');
      assert.strictEqual(result.messageCount, 10);
      assert.ok(logs.some(msg => msg.includes('evaluate for extractable patterns')));
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  if (test('returns missing-transcript when transcript path is absent', () => {
    const testDir = createTestDir('eval-session-test-');
    try {
      const result = evaluateSession({ input: {}, env: { ...process.env, DATA_DIR: path.join(testDir, '.cursor', 'mdt') } });
      assert.strictEqual(result.shouldEvaluate, false);
      assert.strictEqual(result.reason, 'missing-transcript');
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  if (test('falls back to CLAUDE_TRANSCRIPT_PATH env var', () => {
    const testDir = createTestDir('eval-session-test-');
    const transcript = createTranscript(testDir, 15);
    try {
      const result = evaluateSession({
        input: {},
        env: { ...process.env, CLAUDE_TRANSCRIPT_PATH: transcript, DATA_DIR: path.join(testDir, '.cursor', 'mdt') }
      });
      assert.strictEqual(result.shouldEvaluate, true);
      assert.strictEqual(result.messageCount, 15);
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  if (test('counts user messages when JSON has spaces around colon', () => {
    const testDir = createTestDir('eval-session-test-');
    const filePath = path.join(testDir, 'spaced.jsonl');
    const lines = [];
    for (let i = 0; i < 12; i++) {
      lines.push(`{"type" : "user", "content": "msg ${i}"}`);
      lines.push(`{"type" : "assistant", "content": "resp ${i}"}`);
    }
    fs.writeFileSync(filePath, lines.join('\n') + '\n');
    try {
      const result = evaluateSession({ input: { transcript_path: filePath }, env: { ...process.env, DATA_DIR: path.join(testDir, '.cursor', 'mdt') } });
      assert.strictEqual(result.shouldEvaluate, true);
      assert.strictEqual(result.messageCount, 12);
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  if (test('falls back to defaults when config JSON is invalid', () => {
    const testDir = createTestDir('eval-session-test-');
    const configPath = path.join(testDir, 'config.json');
    const transcript = createTranscript(testDir, 12);
    const logs = [];
    fs.writeFileSync(configPath, 'NOT VALID JSON {{{ corrupt data !!!', 'utf8');
    try {
      const result = evaluateSession({
        input: { transcript_path: transcript },
        env: { ...process.env, MDT_CONTINUOUS_LEARNING_CONFIG: configPath, DATA_DIR: path.join(testDir, '.cursor', 'mdt') },
        logger: msg => logs.push(msg)
      });
      assert.strictEqual(result.shouldEvaluate, true);
      assert.ok(logs.some(msg => msg.includes('Failed to parse config')));
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  if (test('expands ~ in learned_skills_path config', () => {
    const testDir = createTestDir('eval-session-test-');
    const configPath = path.join(testDir, 'config.json');
    const transcript = createTranscript(testDir, 12);
    fs.writeFileSync(configPath, JSON.stringify({
      min_session_length: 10,
      learned_skills_path: '~/custom-learned-skills-dir'
    }));
    try {
      const result = evaluateSession({
        input: { transcript_path: transcript },
        env: { ...process.env, MDT_CONTINUOUS_LEARNING_CONFIG: configPath }
      });
      assert.strictEqual(result.shouldEvaluate, true);
      assert.ok(result.learnedSkillsPath.includes('custom-learned-skills-dir'));
      assert.ok(result.learnedSkillsPath.includes(os.homedir()));
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  if (test('expands <data> placeholder in learned_skills_path config', () => {
    const testDir = createTestDir('eval-session-test-');
    const configPath = path.join(testDir, 'config.json');
    const transcript = createTranscript(testDir, 12);
    const dataDir = path.join(testDir, '.cursor', 'mdt');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({
      min_session_length: 10,
      learned_skills_path: '<data>/generated/skills/learned'
    }));
    try {
      const result = evaluateSession({
        input: { transcript_path: transcript },
        env: { ...process.env, DATA_DIR: dataDir, MDT_CONTINUOUS_LEARNING_CONFIG: configPath }
      });
      assert.strictEqual(result.shouldEvaluate, true);
      assert.strictEqual(result.learnedSkillsPath, path.join(dataDir, 'generated', 'skills', 'learned'));
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  if (test('expandConfiguredPath leaves mid-path tildes untouched', () => {
    const value = path.join('C:\\tmp', 'some~dir', 'skills');
    assert.strictEqual(expandConfiguredPath(value), value);
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

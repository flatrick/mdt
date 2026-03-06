/**
 * Tests for scripts/hooks/suggest-compact.js
 *
 * Run with: node tests/hooks/suggest-compact.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { evaluateCompactSuggestion } = require('../../scripts/hooks/suggest-compact');

function test(name, fn) {
  try {
    fn();
    console.log(` ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(` ✗ ${name}`);
    console.log(` Error: ${err.message}`);
    return false;
  }
}

function getCounterFilePath(sessionId) {
  return path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
}

function runCompact(envOverrides = {}) {
  const env = { ...process.env, ...envOverrides };
  const logs = [];
  const result = evaluateCompactSuggestion({
    env,
    logger: msg => logs.push(msg)
  });
  return {
    code: 0,
    stderr: logs.join('\n'),
    ...result
  };
}

function runTests() {
  console.log('\n=== Testing suggest-compact.js ===\n');

  let passed = 0;
  let failed = 0;

  const testSession = `test-compact-${Date.now()}`;
  const counterFile = getCounterFilePath(testSession);

  function cleanupCounter(file = counterFile) {
    try { fs.unlinkSync(file); } catch { /* ignore */ }
  }

  console.log('Basic counter functionality:');

  if (test('creates counter file on first run', () => {
    cleanupCounter();
    const result = runCompact({ CLAUDE_SESSION_ID: testSession });
    assert.strictEqual(result.code, 0);
    assert.ok(fs.existsSync(counterFile));
    const count = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
    assert.strictEqual(count, 1);
    cleanupCounter();
  })) passed++; else failed++;

  if (test('increments counter on subsequent runs', () => {
    cleanupCounter();
    runCompact({ CLAUDE_SESSION_ID: testSession });
    runCompact({ CLAUDE_SESSION_ID: testSession });
    runCompact({ CLAUDE_SESSION_ID: testSession });
    const count = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
    assert.strictEqual(count, 3);
    cleanupCounter();
  })) passed++; else failed++;

  console.log('\nThreshold suggestion:');

  if (test('suggests compact at threshold (COMPACT_THRESHOLD=3)', () => {
    cleanupCounter();
    runCompact({ CLAUDE_SESSION_ID: testSession, COMPACT_THRESHOLD: '3' });
    runCompact({ CLAUDE_SESSION_ID: testSession, COMPACT_THRESHOLD: '3' });
    const result = runCompact({ CLAUDE_SESSION_ID: testSession, COMPACT_THRESHOLD: '3' });
    assert.ok(result.stderr.includes('3 tool calls reached') || result.stderr.includes('consider /compact'));
    cleanupCounter();
  })) passed++; else failed++;

  if (test('does NOT suggest compact before threshold', () => {
    cleanupCounter();
    runCompact({ CLAUDE_SESSION_ID: testSession, COMPACT_THRESHOLD: '5' });
    const result = runCompact({ CLAUDE_SESSION_ID: testSession, COMPACT_THRESHOLD: '5' });
    assert.ok(!result.stderr.includes('StrategicCompact'));
    cleanupCounter();
  })) passed++; else failed++;

  console.log('\nInterval suggestion:');

  if (test('suggests at threshold + 25 interval', () => {
    cleanupCounter();
    fs.writeFileSync(counterFile, '27');
    const result = runCompact({ CLAUDE_SESSION_ID: testSession, COMPACT_THRESHOLD: '3' });
    assert.ok(result.stderr.includes('28 tool calls') || result.stderr.includes('checkpoint'));
    cleanupCounter();
  })) passed++; else failed++;

  console.log('\nEnvironment variable handling:');

  if (test('uses default threshold (50) when COMPACT_THRESHOLD is not set', () => {
    cleanupCounter();
    fs.writeFileSync(counterFile, '49');
    const result = runCompact({ CLAUDE_SESSION_ID: testSession });
    assert.ok(result.stderr.includes('50 tool calls reached'));
    cleanupCounter();
  })) passed++; else failed++;

  if (test('ignores invalid COMPACT_THRESHOLD (negative)', () => {
    cleanupCounter();
    fs.writeFileSync(counterFile, '49');
    const result = runCompact({ CLAUDE_SESSION_ID: testSession, COMPACT_THRESHOLD: '-5' });
    assert.ok(result.stderr.includes('50 tool calls reached'));
    cleanupCounter();
  })) passed++; else failed++;

  if (test('ignores non-numeric COMPACT_THRESHOLD', () => {
    cleanupCounter();
    fs.writeFileSync(counterFile, '49');
    const result = runCompact({ CLAUDE_SESSION_ID: testSession, COMPACT_THRESHOLD: 'abc' });
    assert.ok(result.stderr.includes('50 tool calls reached'));
    cleanupCounter();
  })) passed++; else failed++;

  console.log('\nCorrupted counter file:');

  if (test('resets counter on corrupted file content', () => {
    cleanupCounter();
    fs.writeFileSync(counterFile, 'not-a-number');
    runCompact({ CLAUDE_SESSION_ID: testSession });
    const count = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
    assert.strictEqual(count, 1);
    cleanupCounter();
  })) passed++; else failed++;

  if (test('resets counter on extremely large value', () => {
    cleanupCounter();
    fs.writeFileSync(counterFile, '9999999');
    runCompact({ CLAUDE_SESSION_ID: testSession });
    const count = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
    assert.strictEqual(count, 1);
    cleanupCounter();
  })) passed++; else failed++;

  if (test('handles empty counter file', () => {
    cleanupCounter();
    fs.writeFileSync(counterFile, '');
    runCompact({ CLAUDE_SESSION_ID: testSession });
    const count = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
    assert.strictEqual(count, 1);
    cleanupCounter();
  })) passed++; else failed++;

  console.log('\nSession isolation:');

  if (test('uses separate counter files per session ID', () => {
    const sessionA = `compact-a-${Date.now()}`;
    const sessionB = `compact-b-${Date.now()}`;
    const fileA = getCounterFilePath(sessionA);
    const fileB = getCounterFilePath(sessionB);
    try {
      runCompact({ CLAUDE_SESSION_ID: sessionA });
      runCompact({ CLAUDE_SESSION_ID: sessionA });
      runCompact({ CLAUDE_SESSION_ID: sessionB });
      const countA = parseInt(fs.readFileSync(fileA, 'utf8').trim(), 10);
      const countB = parseInt(fs.readFileSync(fileB, 'utf8').trim(), 10);
      assert.strictEqual(countA, 2);
      assert.strictEqual(countB, 1);
    } finally {
      cleanupCounter(fileA);
      cleanupCounter(fileB);
    }
  })) passed++; else failed++;

  console.log('\nExit code:');

  if (test('always returns code 0 semantics', () => {
    cleanupCounter();
    const result = runCompact({ CLAUDE_SESSION_ID: testSession });
    assert.strictEqual(result.code, 0);
    cleanupCounter();
  })) passed++; else failed++;

  console.log('\nThreshold boundary values:');

  if (test('rejects COMPACT_THRESHOLD=0 (falls back to 50)', () => {
    cleanupCounter();
    fs.writeFileSync(counterFile, '49');
    const result = runCompact({ CLAUDE_SESSION_ID: testSession, COMPACT_THRESHOLD: '0' });
    assert.ok(result.stderr.includes('50 tool calls reached'));
    cleanupCounter();
  })) passed++; else failed++;

  if (test('accepts COMPACT_THRESHOLD=10000 (boundary max)', () => {
    cleanupCounter();
    fs.writeFileSync(counterFile, '9999');
    const result = runCompact({ CLAUDE_SESSION_ID: testSession, COMPACT_THRESHOLD: '10000' });
    assert.ok(result.stderr.includes('10000 tool calls reached'));
    cleanupCounter();
  })) passed++; else failed++;

  if (test('rejects COMPACT_THRESHOLD=10001 (falls back to 50)', () => {
    cleanupCounter();
    fs.writeFileSync(counterFile, '49');
    const result = runCompact({ CLAUDE_SESSION_ID: testSession, COMPACT_THRESHOLD: '10001' });
    assert.ok(result.stderr.includes('50 tool calls reached'));
    cleanupCounter();
  })) passed++; else failed++;

  if (test('float COMPACT_THRESHOLD is parseInt-ed', () => {
    cleanupCounter();
    fs.writeFileSync(counterFile, '49');
    const result = runCompact({ CLAUDE_SESSION_ID: testSession, COMPACT_THRESHOLD: '3.5' });
    assert.strictEqual(result.code, 0);
    assert.ok(!result.stderr.includes('StrategicCompact'));
    cleanupCounter();
  })) passed++; else failed++;

  if (test('counter value at exact boundary 1000000 is valid', () => {
    cleanupCounter();
    fs.writeFileSync(counterFile, '999999');
    runCompact({ CLAUDE_SESSION_ID: testSession, COMPACT_THRESHOLD: '3' });
    const count = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
    assert.strictEqual(count, 1000000);
    cleanupCounter();
  })) passed++; else failed++;

  if (test('counter value at 1000001 is clamped (reset to 1)', () => {
    cleanupCounter();
    fs.writeFileSync(counterFile, '1000001');
    runCompact({ CLAUDE_SESSION_ID: testSession });
    const count = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
    assert.strictEqual(count, 1);
    cleanupCounter();
  })) passed++; else failed++;

  console.log('\nDefault session ID fallback (Round 64):');

  if (test('uses "default" session ID when CLAUDE_SESSION_ID is empty', () => {
    const defaultCounterFile = getCounterFilePath('default');
    cleanupCounter(defaultCounterFile);
    try {
      const result = runCompact({ CLAUDE_SESSION_ID: '' });
      assert.strictEqual(result.code, 0);
      assert.ok(fs.existsSync(defaultCounterFile));
      const count = parseInt(fs.readFileSync(defaultCounterFile, 'utf8').trim(), 10);
      assert.strictEqual(count, 1);
    } finally {
      cleanupCounter(defaultCounterFile);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

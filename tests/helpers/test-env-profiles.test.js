/**
 * Tests for tests/helpers/test-env-profiles.js
 *
 * Run with: node tests/helpers/test-env-profiles.test.js
 */

const assert = require('assert');
const { test } = require('./test-runner');
const { BASE_TEST_ENV, TEST_ENV_PROFILES, buildTestEnv } = require('./test-env-profiles');

function runTests() {
  console.log('\n=== Testing test-env-profiles.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('exports minimal safe defaults', () => {
    assert.strictEqual(BASE_TEST_ENV.FORCE_COLOR, '0');
    assert.strictEqual(BASE_TEST_ENV.NO_COLOR, '1');
  })) passed++; else failed++;

  if (test('supports expected tool profiles', () => {
    assert.ok(TEST_ENV_PROFILES.claude);
    assert.ok(TEST_ENV_PROFILES.cursor);
    assert.ok(TEST_ENV_PROFILES.codex);
    assert.ok(TEST_ENV_PROFILES.gemini);
    assert.ok(TEST_ENV_PROFILES.neutral);
  })) passed++; else failed++;

  if (test('builds claude profile signals', () => {
    const env = buildTestEnv('claude');
    assert.strictEqual(env.CLAUDE_CODE, '1');
    assert.strictEqual(env.CLAUDE_SESSION_ID, 'test-claude-session');
    assert.ok(!('CURSOR_AGENT' in env));
    assert.ok(!('CURSOR_TRACE_ID' in env));
  })) passed++; else failed++;

  if (test('builds cursor profile signals', () => {
    const env = buildTestEnv('cursor');
    assert.strictEqual(env.CURSOR_AGENT, '1');
    assert.strictEqual(env.CURSOR_TRACE_ID, 'test-cursor-trace');
    assert.ok(!('CLAUDE_SESSION_ID' in env));
    assert.ok(!('CLAUDE_CODE' in env));
  })) passed++; else failed++;

  if (test('builds codex and gemini profile signals', () => {
    const codexEnv = buildTestEnv('codex');
    const geminiEnv = buildTestEnv('gemini');

    assert.strictEqual(codexEnv.CODEX_SESSION_ID, 'test-codex-session');
    assert.ok(!('CLAUDE_SESSION_ID' in codexEnv));
    assert.ok(!('CURSOR_AGENT' in codexEnv));

    assert.strictEqual(geminiEnv.GEMINI_SESSION_ID, 'test-gemini-session');
    assert.ok(!('CLAUDE_SESSION_ID' in geminiEnv));
    assert.ok(!('CURSOR_AGENT' in geminiEnv));
  })) passed++; else failed++;


  if (test('defaults to neutral profile when omitted', () => {
    const env = buildTestEnv();
    assert.ok(!('CLAUDE_SESSION_ID' in env));
    assert.ok(!('CLAUDE_CODE' in env));
    assert.ok(!('CURSOR_AGENT' in env));
    assert.ok(!('CURSOR_TRACE_ID' in env));
  })) passed++; else failed++;

  if (test('neutral profile removes known tool detection vars', () => {
    const env = buildTestEnv('neutral');
    assert.ok(!('CLAUDE_SESSION_ID' in env));
    assert.ok(!('CLAUDE_CODE' in env));
    assert.ok(!('CURSOR_AGENT' in env));
    assert.ok(!('CURSOR_TRACE_ID' in env));
  })) passed++; else failed++;

  if (test('overrides can explicitly unset keys via undefined and null', () => {
    const env = buildTestEnv('claude', {
      CLAUDE_SESSION_ID: undefined,
      CLAUDE_CODE: null,
      CUSTOM_KEY: 'custom-value'
    });

    assert.ok(!('CLAUDE_SESSION_ID' in env));
    assert.ok(!('CLAUDE_CODE' in env));
    assert.strictEqual(env.CUSTOM_KEY, 'custom-value');
  })) passed++; else failed++;

  if (test('throws for unknown profiles', () => {
    assert.throws(() => buildTestEnv('unknown-tool-profile'));
  })) passed++; else failed++;

  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

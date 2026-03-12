/**
 * Tests for scripts/lib/detect-env.js
 *
 * Run with: node tests/lib/detect-env.test.js
 */

const assert = require('assert');
const path = require('path');

const { createDetectEnv } = require('../../scripts/lib/detect-env');
const { test } = require('../helpers/test-runner');

function runTests() {
  console.log('\n=== Testing detect-env.js ===\n');

  let passed = 0;
  let failed = 0;

  // Tool detection
  console.log('Tool Detection:');

  if (
    test('detects Cursor when CURSOR_AGENT=1', () => {
      const env = { CURSOR_AGENT: '1' };
      const d = createDetectEnv({ env });
      assert.strictEqual(d.tool, 'cursor');
      assert.strictEqual(d.getTool(), 'cursor');
    })
  )
    passed++;
  else failed++;

  if (
    test('detects Claude when CLAUDE_SESSION_ID set', () => {
      const env = { CLAUDE_SESSION_ID: 'abc-123' };
      const d = createDetectEnv({ env });
      assert.strictEqual(d.tool, 'claude');
    })
  )
    passed++;
  else failed++;

  if (
    test('Cursor wins when both Cursor and Claude signals present', () => {
      const env = { CURSOR_AGENT: '1', CLAUDE_SESSION_ID: 'abc-123' };
      const d = createDetectEnv({ env });
      assert.strictEqual(d.tool, 'cursor');
    })
  )
    passed++;
  else failed++;

  if (
    test('falls back to unknown when no tool signals', () => {
      const env = {};
      const d = createDetectEnv({ env });
      assert.strictEqual(d.tool, 'unknown');
    })
  )
    passed++;
  else failed++;

  if (
    test('uses CLAUDE_SESSION_ID over CLAUDE_CODE when both are present', () => {
      const env = { CLAUDE_SESSION_ID: 'abc-123', CLAUDE_CODE: '1' };
      const d = createDetectEnv({ env });
      assert.strictEqual(d.tool, 'claude');
      assert.strictEqual(d.getTool(), 'claude');
    })
  )
    passed++;
  else failed++;

  if (
    test('uses CLAUDE_CODE=1 as Claude signal when session id is absent', () => {
      const env = { CLAUDE_CODE: '1' };
      const d = createDetectEnv({ env });
      assert.strictEqual(d.tool, 'claude');
    })
  )
    passed++;
  else failed++;

  if (
    test('detects Codex when CODEX_AGENT=1', () => {
      const env = { CODEX_AGENT: '1' };
      const d = createDetectEnv({ env });
      assert.strictEqual(d.tool, 'codex');
    })
  )
    passed++;
  else failed++;

  if (
    test('treats non-truthy detection values as neutral (unknown)', () => {
      const env = {
        CURSOR_AGENT: '0',
        CLAUDE_CODE: '0',
        CLAUDE_SESSION_ID: ''
      };
      const d = createDetectEnv({ env });
      assert.strictEqual(d.tool, 'unknown');
    })
  )
    passed++;
  else failed++;

  if (
    test('treats unrelated environment variables as neutral (unknown)', () => {
      const env = { NODE_ENV: 'test', CI: '1' };
      const d = createDetectEnv({ env });
      assert.strictEqual(d.tool, 'unknown');
    })
  )
    passed++;
  else failed++;

  // Config directory resolution
  console.log('\nConfig Directory Resolution:');

  if (
    test('uses CONFIG_DIR when it exists', () => {
      const env = { CONFIG_DIR: '/custom/config' };
      const existsSync = (p) => p === '/custom/config';
      const d = createDetectEnv({ env, existsSync });
      assert.strictEqual(d.configDir, '/custom/config');
      assert.strictEqual(d.getConfigDir(), '/custom/config');
    })
  )
    passed++;
  else failed++;

  if (
    test('falls back to ~/.cursor for Cursor when CONFIG_DIR missing', () => {
      const home = '/home/test';
      const env = { CURSOR_AGENT: '1', CONFIG_DIR: '/does/not/exist' };
      const existsSync = () => false;
      const logs = [];
      const d = createDetectEnv({
        env,
        existsSync,
        homedir: () => home,
        logWarn: (m) => logs.push(m)
      });
      assert.strictEqual(d.configDir, path.join(home, '.cursor'));
      assert.ok(logs.some((m) => m.includes('CONFIG_DIR is set')));
    })
  )
    passed++;
  else failed++;

  if (
    test('defaults to ~/.cursor for Cursor when CONFIG_DIR unset', () => {
      const home = '/home/test';
      const env = { CURSOR_AGENT: '1' };
      const d = createDetectEnv({ env, homedir: () => home, existsSync: () => false });
      assert.strictEqual(d.configDir, path.join(home, '.cursor'));
    })
  )
    passed++;
  else failed++;

  if (
    test('defaults to ~/.claude for Claude when CONFIG_DIR unset', () => {
      const home = '/home/test';
      const env = { CLAUDE_SESSION_ID: 'sess-1' };
      const d = createDetectEnv({ env, homedir: () => home, existsSync: () => false });
      assert.strictEqual(d.configDir, path.join(home, '.claude'));
    })
  )
    passed++;
  else failed++;

  if (
    test('defaults to ~/.codex for Codex when CONFIG_DIR unset', () => {
      const home = '/home/test';
      const env = { CODEX_AGENT: '1' };
      const d = createDetectEnv({ env, homedir: () => home, existsSync: () => false });
      assert.strictEqual(d.configDir, path.join(home, '.codex'));
    })
  )
    passed++;
  else failed++;

  if (
    test('unknown tool prefers ~/.cursor when both configs missing', () => {
      const home = '/home/test';
      const env = {};
      const existsSync = () => false;
      const d = createDetectEnv({ env, homedir: () => home, existsSync });
      assert.strictEqual(d.configDir, path.join(home, '.cursor'));
    })
  )
    passed++;
  else failed++;

  if (
    test('unknown tool picks ~/.cursor when cursor skills exist', () => {
      const home = '/home/test';
      const env = {};
      const cursorSkills = path.join(home, '.cursor', 'skills');
      const existsSync = (p) => p === cursorSkills;
      const d = createDetectEnv({ env, homedir: () => home, existsSync });
      assert.strictEqual(d.configDir, path.join(home, '.cursor'));
    })
  )
    passed++;
  else failed++;

  if (
    test('unknown tool picks ~/.claude when only Claude skills exist', () => {
      const home = '/home/test';
      const env = {};
      const claudeSkills = path.join(home, '.claude', 'skills');
      const existsSync = (p) => p === claudeSkills;
      const d = createDetectEnv({ env, homedir: () => home, existsSync });
      assert.strictEqual(d.configDir, path.join(home, '.claude'));
    })
  )
    passed++;
  else failed++;

  // Data directory resolution
  console.log('\nData Directory Resolution:');

  if (
    test('uses DATA_DIR when it exists', () => {
      const home = '/home/test';
      const env = { CURSOR_AGENT: '1', DATA_DIR: '/custom/data' };
      const existsSync = (p) => p === '/custom/data';
      const d = createDetectEnv({ env, homedir: () => home, existsSync });
      assert.strictEqual(d.dataDir, '/custom/data');
      assert.strictEqual(d.getDataDir(), '/custom/data');
    })
  )
    passed++;
  else failed++;

  if (
    test('explicit CONFIG_DIR also anchors data dir before legacy Claude fallback', () => {
      const home = '/home/test';
      const env = { CONFIG_DIR: '/custom/config' };
      const existsSync = (p) => p === '/custom/config' || p === path.join(home, '.claude', 'homunculus');
      const d = createDetectEnv({ env, homedir: () => home, existsSync });
      assert.strictEqual(d.dataDir, path.join('/custom/config', 'mdt'));
      assert.strictEqual(d.getDataDir(), path.join('/custom/config', 'mdt'));
    })
  )
    passed++;
  else failed++;

  if (
    test('prefers homunculus next to configDir when present', () => {
      const home = '/home/test';
      const configDir = path.join(home, '.cursor');
      const homunculusDir = path.join(configDir, 'homunculus');
      const env = { CURSOR_AGENT: '1' };
      const existsSync = (p) => p === homunculusDir;
      const d = createDetectEnv({ env, homedir: () => home, existsSync });
      assert.strictEqual(d.dataDir, path.join(configDir, 'mdt'));
    })
  )
    passed++;
  else failed++;

  if (
    test('falls back to legacy ~/.claude when homunculus exists there', () => {
      const home = '/home/test';
      const legacyHomunculus = path.join(home, '.claude', 'homunculus');
      const env = { CURSOR_AGENT: '1' };
      const existsSync = (p) => p === legacyHomunculus;
      const d = createDetectEnv({ env, homedir: () => home, existsSync });
      assert.strictEqual(d.dataDir, path.join(home, '.cursor', 'mdt'));
    })
  )
    passed++;
  else failed++;

  if (
    test('uses configDir as dataDir when no homunculus exists', () => {
      const home = '/home/test';
      const env = { CURSOR_AGENT: '1' };
      const existsSync = () => false;
      const d = createDetectEnv({ env, homedir: () => home, existsSync });
      assert.strictEqual(d.dataDir, path.join(home, '.cursor', 'mdt'));
    })
  )
    passed++;
  else failed++;

  // Platform detection
  console.log('\nPlatform Detection:');

  if (
    test('detects Windows platform flags', () => {
      const d = createDetectEnv({ platform: 'win32', readFileSync: () => '' });
      const info = d.getPlatformInfo();
      assert.strictEqual(info.isWindows, true);
      assert.strictEqual(info.isMacOS, false);
      assert.strictEqual(info.isLinux, false);
      assert.strictEqual(info.isWSL, false);
    })
  )
    passed++;
  else failed++;

  if (
    test('detects macOS platform flags', () => {
      const d = createDetectEnv({ platform: 'darwin', readFileSync: () => '' });
      const info = d.getPlatformInfo();
      assert.strictEqual(info.isMacOS, true);
      assert.strictEqual(info.isWindows, false);
      assert.strictEqual(info.isLinux, false);
      assert.strictEqual(info.isWSL, false);
    })
  )
    passed++;
  else failed++;

  if (
    test('detects generic Linux platform flags', () => {
      const d = createDetectEnv({ platform: 'linux', readFileSync: () => 'Linux version' });
      const info = d.getPlatformInfo();
      assert.strictEqual(info.isLinux, true);
      assert.strictEqual(info.isWindows, false);
      assert.strictEqual(info.isMacOS, false);
      assert.strictEqual(info.isWSL, false);
    })
  )
    passed++;
  else failed++;

  if (
    test('detects WSL when /proc/version contains microsoft', () => {
      const d = createDetectEnv({
        platform: 'linux',
        readFileSync: () => 'Linux version 5.15.90.1-microsoft-standard-WSL2'
      });
      const info = d.getPlatformInfo();
      assert.strictEqual(info.isLinux, true);
      assert.strictEqual(info.isWSL, true);
    })
  )
    passed++;
  else failed++;

  // Session ID
  console.log('\nSession ID Resolution:');

  if (
    test('prefers CLAUDE_SESSION_ID', () => {
      const env = { CLAUDE_SESSION_ID: 'sess-abc-123', CURSOR_TRACE_ID: 'trace-xyz' };
      const d = createDetectEnv({ env });
      assert.strictEqual(d.sessionId, 'sess-abc-123');
      assert.strictEqual(d.getSessionId(), 'sess-abc-123');
    })
  )
    passed++;
  else failed++;

  if (
    test('falls back to CURSOR_TRACE_ID when no CLAUDE_SESSION_ID', () => {
      const env = { CURSOR_TRACE_ID: 'trace-xyz' };
      const d = createDetectEnv({ env });
      assert.strictEqual(d.sessionId, 'trace-xyz');
    })
  )
    passed++;
  else failed++;

  if (
    test('uses CODEX_SESSION_ID when tool-specific signal is set', () => {
      const env = { CODEX_SESSION_ID: 'codex-sess-1' };
      const d = createDetectEnv({ env });
      assert.strictEqual(d.sessionId, 'codex-sess-1');
    })
  )
    passed++;
  else failed++;

  if (
    test('generates stable session ID when no signals present', () => {
      const env = {};
      const d = createDetectEnv({ env });
      const first = d.sessionId;
      const second = d.getSessionId();
      assert.ok(first && typeof first === 'string');
      assert.strictEqual(first, second, 'Session ID should be stable within instance');
    })
  )
    passed++;
  else failed++;

  // Derived paths
  console.log('\nDerived Paths:');

  if (
    test('computes derived skills/hooks/homunculus paths', () => {
      const home = '/home/test';
      const env = { CURSOR_AGENT: '1' };
      const existsSync = () => false;
      const d = createDetectEnv({ env, homedir: () => home, existsSync });
      const pathsInfo = d.getPaths();
      const expectedConfig = path.join(home, '.cursor');
      const expectedData = path.join(expectedConfig, 'mdt');
      assert.strictEqual(pathsInfo.configDir, expectedConfig);
      assert.strictEqual(pathsInfo.dataDir, expectedData);
      assert.strictEqual(pathsInfo.mdtDir, expectedData);
      assert.strictEqual(pathsInfo.skillsDir, path.join(expectedConfig, 'skills'));
      assert.strictEqual(pathsInfo.hooksDir, path.join(expectedConfig, 'hooks'));
      assert.strictEqual(pathsInfo.homunculusDir, path.join(expectedData, 'homunculus'));
    })
  )
    passed++;
  else failed++;

  const total = passed + failed;
  console.log('\nSummary:');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${total}`);

  // Required for tests/run-all.js aggregation
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
  runTests();
}

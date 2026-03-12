/**
 * Tests for skill runtime scripts (Node.js .js — cross-platform, no .ps1/.sh).
 *
 * Run with: node tests/scripts/node-runtime-scripts.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { ensureSubprocessCapability } = require('../helpers/subprocess-capability');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');

function runNode(scriptPath, stdin = '', options = {}) {
  return spawnSync('node', [scriptPath], {
    input: stdin,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 15000,
    cwd: options.cwd || path.join(__dirname, '..', '..'),
    ...options
  });
}

function runTests() {
  console.log('\n=== Testing Skill Runtime Scripts (Node.js) ===\n');

  let passed = 0;
  let failed = 0;

  const repoRoot = path.join(__dirname, '..', '..');
  const scripts = [
    'scripts/codex-observer.js',
    'scripts/hooks/evaluate-session.js',
    'skills/strategic-compact/suggest-compact.js',
    'skills/continuous-learning-manual/scripts/detect-project.js',
    'skills/continuous-learning-manual/agents/start-observer.js',
    'skills/skill-stocktake/scripts/scan.js',
    'skills/skill-stocktake/scripts/quick-diff.js',
    'skills/skill-stocktake/scripts/save-results.js',
  ];

  console.log('File Presence:');
  if (test('all expected .js scripts exist', () => {
    for (const rel of scripts) {
      const full = path.join(repoRoot, rel);
      assert.ok(fs.existsSync(full), `Missing script: ${rel}`);
    }
  })) passed++; else failed++;

  console.log('\nScript Smoke Tests:');
  if (test('evaluate-session.js exits 0 with empty stdin', () => {
    const result = runNode(path.join(repoRoot, 'scripts/hooks/evaluate-session.js'), '', { cwd: repoRoot });
    assert.strictEqual(result.status, 0, `Expected 0, got ${result.status} stderr=${result.stderr}`);
  })) passed++; else failed++;

  if (test('suggest-compact.js emits threshold message when threshold=1', () => {
    const result = spawnSync('node', [path.join(repoRoot, 'skills/strategic-compact/suggest-compact.js')], {
      encoding: 'utf8',
      input: '{}',
      cwd: repoRoot,
      env: { ...process.env, CLAUDE_SESSION_ID: `js-smoke-${Date.now()}`, COMPACT_THRESHOLD: '1' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    assert.strictEqual(result.status, 0, `Expected 0, got ${result.status}`);
    assert.ok((result.stderr || '').includes('tool calls reached'), `Expected threshold message, got stderr: ${result.stderr}`);
  })) passed++; else failed++;

  if (test('detect-project.js returns JSON payload', () => {
    const result = runNode(path.join(repoRoot, 'skills/continuous-learning-manual/scripts/detect-project.js'), '', { cwd: repoRoot });
    assert.strictEqual(result.status, 0, `Expected 0, got ${result.status}`);
    const payload = JSON.parse((result.stdout || '').trim());
    assert.ok(payload.id, 'Expected id in payload');
    assert.ok(payload.project_dir, 'Expected project_dir in payload');
  })) passed++; else failed++;

  if (test('scan.js emits expected top-level JSON fields', () => {
    const result = runNode(path.join(repoRoot, 'skills/skill-stocktake/scripts/scan.js'), '', { cwd: repoRoot });
    assert.strictEqual(result.status, 0, `Expected 0, got ${result.status}`);
    const payload = JSON.parse((result.stdout || '').trim());
    assert.ok(payload.scan_summary, 'Expected scan_summary');
    assert.ok(Array.isArray(payload.skills), 'Expected skills array');
  })) passed++; else failed++;

  if (test('save-results.js bootstraps results file from stdin JSON', () => {
    const tmpDir = createTestDir('js-save-');
    const resultsPath = path.join(tmpDir, 'results.json');
    try {
      const stdin = JSON.stringify({ mode: 'quick', skills: { demo: { path: '<config>/skills/demo/SKILL.md', verdict: 'Keep' } } });
      const res = spawnSync('node', [path.join(repoRoot, 'skills/skill-stocktake/scripts/save-results.js'), resultsPath], {
        input: stdin,
        encoding: 'utf8',
        cwd: repoRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      assert.strictEqual(res.status, 0, `Expected 0, got ${res.status} stderr=${res.stderr}`);
      const saved = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      assert.ok(saved.evaluated_at, 'Expected evaluated_at field');
      assert.ok(saved.skills && saved.skills.demo, 'Expected merged skills');
    } finally {
      cleanupTestDir(tmpDir);
    }
  })) passed++; else failed++;

  if (test('quick-diff.js reports new skill files after old evaluated_at', () => {
    const tmpDir = createTestDir('js-diff-');
    try {
      const globalSkillsDir = path.join(tmpDir, '.claude', 'skills', 'demo-skill');
      fs.mkdirSync(globalSkillsDir, { recursive: true });
      fs.writeFileSync(path.join(globalSkillsDir, 'SKILL.md'), '# Demo');
      const resultsPath = path.join(tmpDir, 'results.json');
      fs.writeFileSync(resultsPath, JSON.stringify({ evaluated_at: '2000-01-01T00:00:00Z', skills: {} }));

      const result = spawnSync('node', [path.join(repoRoot, 'skills/skill-stocktake/scripts/quick-diff.js'), resultsPath], {
        encoding: 'utf8',
        cwd: repoRoot,
        env: { ...process.env, SKILL_STOCKTAKE_GLOBAL_DIR: path.join(tmpDir, '.claude', 'skills'), SKILL_STOCKTAKE_PROJECT_DIR: '' },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      assert.strictEqual(result.status, 0, `Expected 0, got ${result.status} stderr=${result.stderr}`);
      const payload = JSON.parse((result.stdout || '').trim());
      assert.ok(Array.isArray(payload), 'Expected array output');
      assert.ok(payload.length >= 1, 'Expected at least one changed/new entry');
      assert.strictEqual(payload[0].is_new, true, 'Expected new entry to be marked is_new=true');
    } finally {
      cleanupTestDir(tmpDir);
    }
  })) passed++; else failed++;

  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

ensureSubprocessCapability('tests/scripts/node-runtime-scripts.test.js');
runTests();

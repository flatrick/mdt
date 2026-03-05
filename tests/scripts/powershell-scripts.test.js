/**
 * Tests for Windows PowerShell script counterparts.
 *
 * Run with: node tests/scripts/powershell-scripts.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

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

function getPowerShellExe() {
  const candidates = ['pwsh', 'powershell'];
  for (const exe of candidates) {
    const result = spawnSync(exe, ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    });
    if (result.status === 0) {
      return exe;
    }
  }
  return null;
}

function runPwsh(exe, args, options = {}) {
  return spawnSync(exe, args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 15000,
    ...options
  });
}

function runPwshWithStdin(exe, args, stdin, options = {}) {
  return spawnSync(exe, args, {
    input: stdin,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 15000,
    ...options
  });
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function runTests() {
  console.log('\n=== Testing PowerShell Script Counterparts ===\n');

  let passed = 0;
  let failed = 0;

  const repoRoot = path.join(__dirname, '..', '..');
  const scripts = [
    'skills/continuous-learning/evaluate-session.ps1',
    'skills/strategic-compact/suggest-compact.ps1',
    'skills/continuous-learning-v2/scripts/detect-project.ps1',
    'skills/continuous-learning-v2/agents/start-observer.ps1',
    'skills/skill-stocktake/scripts/scan.ps1',
    'skills/skill-stocktake/scripts/quick-diff.ps1',
    'skills/skill-stocktake/scripts/save-results.ps1',
  ];

  console.log('File Presence:');
  if (test('all expected .ps1 scripts exist', () => {
    for (const rel of scripts) {
      const full = path.join(repoRoot, rel);
      assert.ok(fs.existsSync(full), `Missing script: ${rel}`);
    }
  })) passed++; else failed++;

  const pwshExe = getPowerShellExe();
  if (!pwshExe) {
    console.log('\nPowerShell Runtime:');
    console.log('  ✓ skipped runtime tests (pwsh/powershell not found)');
    console.log('\n=== Test Results ===');
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total:  ${passed + failed}\n`);
    process.exit(failed > 0 ? 1 : 0);
  }

  console.log('\nPowerShell Syntax:');
  if (test('all scripts parse with PowerShell parser', () => {
    for (const rel of scripts) {
      const full = path.join(repoRoot, rel).replace(/\\/g, '/');
      const cmd = `$parseErrors = @(); [void][System.Management.Automation.Language.Parser]::ParseFile('${full}',[ref]$null,[ref]$parseErrors); if($parseErrors.Count -gt 0){ $parseErrors | ForEach-Object { Write-Output $_.Message }; exit 1 }`;
      const result = runPwsh(pwshExe, ['-NoProfile', '-NonInteractive', '-Command', cmd], { cwd: repoRoot });
      assert.strictEqual(result.status, 0, `Parse failed for ${rel}: ${result.stdout}${result.stderr}`);
    }
  })) passed++; else failed++;

  console.log('\nScript Smoke Tests:');
  if (test('evaluate-session.ps1 exits 0 with empty stdin', () => {
    const rel = 'skills/continuous-learning/evaluate-session.ps1';
    const result = runPwshWithStdin(
      pwshExe,
      ['-NoProfile', '-NonInteractive', '-File', rel],
      '',
      { cwd: repoRoot }
    );
    assert.strictEqual(result.status, 0, `Expected 0, got ${result.status} stderr=${result.stderr}`);
  })) passed++; else failed++;

  if (test('suggest-compact.ps1 emits threshold message when threshold=1', () => {
    const rel = 'skills/strategic-compact/suggest-compact.ps1';
    const result = runPwsh(
      pwshExe,
      ['-NoProfile', '-NonInteractive', '-File', rel],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          CLAUDE_SESSION_ID: `ps1-smoke-${Date.now()}`,
          COMPACT_THRESHOLD: '1'
        }
      }
    );
    assert.strictEqual(result.status, 0, `Expected 0, got ${result.status}`);
    assert.ok(
      (result.stderr || '').includes('tool calls reached'),
      `Expected threshold message, got stderr: ${result.stderr}`
    );
  })) passed++; else failed++;

  if (test('detect-project.ps1 -AsJson returns JSON payload', () => {
    const rel = 'skills/continuous-learning-v2/scripts/detect-project.ps1';
    const result = runPwsh(
      pwshExe,
      ['-NoProfile', '-NonInteractive', '-File', rel, '-AsJson'],
      { cwd: repoRoot }
    );
    assert.strictEqual(result.status, 0, `Expected 0, got ${result.status}`);
    const payload = JSON.parse((result.stdout || '').trim());
    assert.ok(payload.id, 'Expected id in payload');
    assert.ok(payload.project_dir, 'Expected project_dir in payload');
  })) passed++; else failed++;

  if (test('scan.ps1 emits expected top-level JSON fields', () => {
    const rel = 'skills/skill-stocktake/scripts/scan.ps1';
    const result = runPwsh(
      pwshExe,
      ['-NoProfile', '-NonInteractive', '-File', rel],
      { cwd: repoRoot }
    );
    assert.strictEqual(result.status, 0, `Expected 0, got ${result.status}`);
    const payload = JSON.parse((result.stdout || '').trim());
    assert.ok(payload.scan_summary, 'Expected scan_summary');
    assert.ok(Array.isArray(payload.skills), 'Expected skills array');
  })) passed++; else failed++;

  if (test('save-results.ps1 bootstraps results file from stdin JSON', () => {
    const rel = 'skills/skill-stocktake/scripts/save-results.ps1';
    const tmpDir = makeTempDir('ps1-save-');
    const resultsPath = path.join(tmpDir, 'results.json');
    try {
      const stdin = JSON.stringify({
        mode: 'quick',
        skills: {
          demo: { path: '~/.claude/skills/demo/SKILL.md', verdict: 'Keep' }
        }
      });
      const result = runPwshWithStdin(
        pwshExe,
        ['-NoProfile', '-NonInteractive', '-File', rel, resultsPath],
        stdin,
        { cwd: repoRoot }
      );
      assert.strictEqual(result.status, 0, `Expected 0, got ${result.status} stderr=${result.stderr}`);
      const saved = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      assert.ok(saved.evaluated_at, 'Expected evaluated_at field');
      assert.ok(saved.skills && saved.skills.demo, 'Expected merged skills');
    } finally {
      cleanup(tmpDir);
    }
  })) passed++; else failed++;

  if (test('quick-diff.ps1 reports new skill files after old evaluated_at', () => {
    const rel = 'skills/skill-stocktake/scripts/quick-diff.ps1';
    const tmpDir = makeTempDir('ps1-diff-');
    try {
      const globalSkillsDir = path.join(tmpDir, '.claude', 'skills', 'demo-skill');
      fs.mkdirSync(globalSkillsDir, { recursive: true });
      fs.writeFileSync(path.join(globalSkillsDir, 'SKILL.md'), '# Demo');

      const resultsPath = path.join(tmpDir, 'results.json');
      fs.writeFileSync(resultsPath, JSON.stringify({
        evaluated_at: '2000-01-01T00:00:00Z',
        skills: {}
      }));

      const result = runPwsh(
        pwshExe,
        ['-NoProfile', '-NonInteractive', '-File', rel, resultsPath],
        {
          cwd: repoRoot,
          env: {
            ...process.env,
            SKILL_STOCKTAKE_GLOBAL_DIR: path.join(tmpDir, '.claude', 'skills'),
            SKILL_STOCKTAKE_PROJECT_DIR: ''
          }
        }
      );

      assert.strictEqual(result.status, 0, `Expected 0, got ${result.status} stderr=${result.stderr}`);
      const payload = JSON.parse((result.stdout || '').trim());
      assert.ok(Array.isArray(payload), 'Expected array output');
      assert.ok(payload.length >= 1, 'Expected at least one changed/new entry');
      assert.strictEqual(payload[0].is_new, true, 'Expected new entry to be marked is_new=true');
    } finally {
      cleanup(tmpDir);
    }
  })) passed++; else failed++;

  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

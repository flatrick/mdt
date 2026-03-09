/**
 * Unit tests for scripts/install-mdt.js argument parsing and dry-run planning.
 *
 * Run with: node tests/scripts/install-mdt-unit.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test } = require('../helpers/test-runner');
const {
  parseArgsFrom,
  getAvailablePackages,
  loadPackageManifest,
  buildInstallPlan,
  resolveSelectedPackages,
  installClaudeContentDirs,
  installCursorCoreDirs,
  installGeminiContent
} = require('../../scripts/install-mdt');

function withTempDir(prefix, callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    callback(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function runTests() {
  console.log('\n=== Testing install-mdt.js (unit) ===\n');

  let passed = 0;
  let failed = 0;

  if (test('parseArgsFrom parses list and dry-run flags', () => {
    const parsed = parseArgsFrom(['--target', 'cursor', '--global', '--list', '--dry-run', 'typescript']);
    assert.strictEqual(parsed.target, 'cursor');
    assert.strictEqual(parsed.globalScope, true);
    assert.strictEqual(parsed.listMode, true);
    assert.strictEqual(parsed.dryRun, true);
    assert.deepStrictEqual(parsed.packageNames, ['typescript']);
  })) passed++; else failed++;

  if (test('parseArgsFrom defaults to claude target with no flags', () => {
    const parsed = parseArgsFrom([]);
    assert.strictEqual(parsed.target, 'claude');
    assert.strictEqual(parsed.globalScope, false);
    assert.strictEqual(parsed.listMode, false);
    assert.strictEqual(parsed.dryRun, false);
    assert.deepStrictEqual(parsed.packageNames, []);
  })) passed++; else failed++;

  if (test('buildInstallPlan returns codex plan without language requirement', () => {
    const plan = buildInstallPlan({ target: 'codex', globalScope: false, packageNames: [] });
    assert.ok(plan.some((line) => line.includes('[dry-run] Target: codex')));
    assert.ok(plan.some((line) => line.includes('Would install from')));
  })) passed++; else failed++;

  if (test('getAvailablePackages lists explicit package manifests', () => {
    assert.ok(getAvailablePackages().includes('typescript'));
    assert.ok(getAvailablePackages().includes('python'));
    assert.ok(getAvailablePackages().includes('sql'));
    assert.ok(getAvailablePackages().includes('dotnet'));
    assert.ok(getAvailablePackages().includes('rust'));
    assert.ok(getAvailablePackages().includes('bash'));
    assert.ok(getAvailablePackages().includes('powershell'));
  })) passed++; else failed++;

  if (test('loadPackageManifest throws for unknown package', () => {
    assert.throws(() => loadPackageManifest('typescirpt'), /Unknown package 'typescirpt'/);
  })) passed++; else failed++;

  if (test('loadPackageManifest loads typescript cursor package details', () => {
    const manifest = loadPackageManifest('typescript');
    assert.strictEqual(manifest.name, 'typescript');
    assert.ok(manifest.description.includes('TypeScript'));
    assert.strictEqual(manifest.ruleDirectory, 'typescript');
    assert.ok(manifest.agents.includes('planner.md'));
    assert.ok(manifest.commands.includes('plan.md'));
    assert.ok(manifest.skills.includes('coding-standards'));
    assert.ok(Array.isArray(manifest.tools.cursor.rules));
    assert.ok(manifest.tools.cursor.rules.includes('typescript-coding-style.md'));
    assert.deepStrictEqual(manifest.tools.cursor.skills, ['frontend-slides']);
  })) passed++; else failed++;

  if (test('loadPackageManifest loads python explicit package details', () => {
    const manifest = loadPackageManifest('python');
    assert.strictEqual(manifest.name, 'python');
    assert.strictEqual(manifest.ruleDirectory, 'python');
    assert.ok(manifest.agents.includes('python-reviewer.md'));
    assert.ok(manifest.commands.includes('python-review.md'));
    assert.ok(manifest.skills.includes('python-patterns'));
    assert.ok(Array.isArray(manifest.tools.cursor.rules));
    assert.ok(manifest.tools.cursor.rules.includes('python-coding-style.md'));
  })) passed++; else failed++;

  if (test('buildInstallPlan includes global cursor rule-skip note and packages', () => {
    const plan = buildInstallPlan({ target: 'cursor', globalScope: true, packageNames: ['typescript'] });
    assert.ok(plan.some((line) => line.includes('Target: cursor (global)')));
    assert.ok(plan.some((line) => line.includes('Packages: typescript')));
    assert.ok(plan.some((line) => line.includes('Would skip file-based rules')));
  })) passed++; else failed++;

  if (test('buildInstallPlan includes claude runtime scripts detail', () => {
    const plan = buildInstallPlan({ target: 'claude', globalScope: false, packageNames: ['typescript'] });
    assert.ok(plan.some((line) => line.includes('runtime scripts')));
    assert.ok(plan.some((line) => line.includes('scripts/hooks + scripts/lib')));
    assert.ok(plan.some((line) => line.includes('Packages: typescript')));
  })) passed++; else failed++;

  if (test('buildInstallPlan includes gemini local paths', () => {
    const plan = buildInstallPlan({ target: 'gemini', globalScope: false, packageNames: ['typescript'] });
    assert.ok(plan.some((l) => l.includes('Target: gemini')));
    assert.ok(plan.some((l) => l.includes('.agent')));
    assert.ok(plan.some((line) => line.includes('Packages: typescript')));
  })) passed++; else failed++;

  if (test('buildInstallPlan includes gemini global paths', () => {
    const plan = buildInstallPlan({ target: 'gemini', globalScope: true, packageNames: ['typescript'] });
    assert.ok(plan.some((l) => l.includes('Target: gemini (global)')));
    assert.ok(plan.some((l) => l.includes('GEMINI.md')));
  })) passed++; else failed++;

  if (test('buildInstallPlan claude project-level installs to cwd .claude', () => {
    const plan = buildInstallPlan({ target: 'claude', globalScope: false, packageNames: ['typescript'] });
    assert.ok(plan.some((line) => line.includes('.claude')));
    assert.ok(plan.some((line) => line.includes('project-relative')));
    assert.ok(!plan.some((line) => line.includes('Target: claude (global)')));
  })) passed++; else failed++;

  if (test('buildInstallPlan claude global installs to home .claude', () => {
    const plan = buildInstallPlan({ target: 'claude', globalScope: true, packageNames: ['typescript'] });
    const home = require('os').homedir();
    assert.ok(plan.some((line) => line.includes('Target: claude (global)')));
    assert.ok(plan.some((line) => line.includes(home)));
    assert.ok(!plan.some((line) => line.includes('project-relative')));
  })) passed++; else failed++;

  if (test('parseArgsFrom parses --global for claude target', () => {
    const parsed = parseArgsFrom(['--global', 'typescript']);
    assert.strictEqual(parsed.target, 'claude');
    assert.strictEqual(parsed.globalScope, true);
    assert.deepStrictEqual(parsed.packageNames, ['typescript']);
  })) passed++; else failed++;

  if (test('installClaudeContentDirs copies only selected shared assets', () => {
    withTempDir('mdt-install-claude-', (tempDir) => {
      installClaudeContentDirs(tempDir, resolveSelectedPackages(['typescript']));

      assert.ok(fs.existsSync(path.join(tempDir, 'agents', 'planner.md')));
      assert.ok(!fs.existsSync(path.join(tempDir, 'agents', 'python-reviewer.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'commands', 'plan.md')));
      assert.ok(!fs.existsSync(path.join(tempDir, 'commands', 'python-review.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'coding-standards', 'SKILL.md')));
      assert.ok(!fs.existsSync(path.join(tempDir, 'skills', 'python-patterns', 'SKILL.md')));
    });
  })) passed++; else failed++;

  if (test('installCursorCoreDirs copies only selected agents and cursor skills', () => {
    withTempDir('mdt-install-cursor-', (tempDir) => {
      installCursorCoreDirs(tempDir, resolveSelectedPackages(['typescript']));

      assert.ok(fs.existsSync(path.join(tempDir, 'agents', 'planner.md')));
      assert.ok(!fs.existsSync(path.join(tempDir, 'agents', 'python-reviewer.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'frontend-slides', 'SKILL.md')));
      assert.ok(!fs.existsSync(path.join(tempDir, 'skills', 'verification-loop', 'SKILL.md')));
    });
  })) passed++; else failed++;

  if (test('installGeminiContent copies only selected shared assets', () => {
    withTempDir('mdt-install-gemini-', (tempDir) => {
      const agentDir = path.join(tempDir, '.agent');
      const geminiDir = path.join(tempDir, '.gemini');
      installGeminiContent(agentDir, geminiDir, resolveSelectedPackages(['typescript']));

      assert.ok(fs.existsSync(path.join(agentDir, 'workflows', 'planner.md')));
      assert.ok(!fs.existsSync(path.join(agentDir, 'workflows', 'python-reviewer.md')));
      assert.ok(fs.existsSync(path.join(agentDir, 'skills', 'coding-standards', 'SKILL.md')));
      assert.ok(!fs.existsSync(path.join(agentDir, 'skills', 'python-patterns', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(geminiDir, 'commands', 'plan.toml')));
      assert.ok(!fs.existsSync(path.join(geminiDir, 'commands', 'python-review.toml')));
    });
  })) passed++; else failed++;

  if (test('installClaudeContentDirs warns for missing manifest-selected assets', () => {
    withTempDir('mdt-install-warn-', (tempDir) => {
      const originalError = console.error;
      const captured = [];
      console.error = (message) => captured.push(String(message));
      try {
        installClaudeContentDirs(tempDir, [{
          name: 'broken',
          agents: ['missing-agent.md'],
          commands: ['missing-command.md'],
          skills: ['missing-skill']
        }]);
      } finally {
        console.error = originalError;
      }

      assert.ok(captured.some((line) => line.includes("Package-selected agent 'missing-agent.md'")));
      assert.ok(captured.some((line) => line.includes("Package-selected command 'missing-command.md'")));
      assert.ok(captured.some((line) => line.includes("Package-selected skill 'missing-skill'")));
    });
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

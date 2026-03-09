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
  assertPackageRequirements,
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

  if (test('resolveSelectedPackages composes extends with stable union ordering', () => {
    withTempDir('mdt-package-resolve-', (tempDir) => {
      const packagesDir = path.join(tempDir, 'packages');
      fs.mkdirSync(path.join(packagesDir, 'base-a'), { recursive: true });
      fs.mkdirSync(path.join(packagesDir, 'base-b'), { recursive: true });
      fs.mkdirSync(path.join(packagesDir, 'child'), { recursive: true });

      fs.writeFileSync(path.join(packagesDir, 'base-a', 'package.json'), JSON.stringify({
        name: 'base-a',
        description: 'Base A',
        ruleDirectory: 'typescript',
        requires: {
          hooks: true,
          tools: ['claude', 'cursor']
        },
        rules: ['common/coding-style.md', 'base-a/rule.md'],
        agents: ['planner.md'],
        commands: ['plan.md'],
        skills: ['verification-loop'],
        tools: {
          cursor: { rules: ['common-coding-style.md'], skills: ['frontend-slides'] },
          gemini: { rules: ['common-coding-style.md'] }
        }
      }), 'utf8');

      fs.writeFileSync(path.join(packagesDir, 'base-b', 'package.json'), JSON.stringify({
        name: 'base-b',
        description: 'Base B',
        ruleDirectory: 'python',
        requires: {
          runtimeScripts: true,
          sessionData: true,
          tools: ['cursor']
        },
        rules: ['common/testing.md', 'base-b/rule.md'],
        agents: ['code-reviewer.md'],
        commands: ['verify.md'],
        skills: ['security-review'],
        tools: {
          cursor: { rules: ['common-testing.md'], skills: ['frontend-slides', 'extra-skill'] },
          gemini: { rules: ['common-testing.md'] }
        }
      }), 'utf8');

      fs.writeFileSync(path.join(packagesDir, 'child', 'package.json'), JSON.stringify({
        name: 'child',
        description: 'Child',
        ruleDirectory: 'rust',
        extends: ['base-a', 'base-b'],
        requires: {
          tools: ['claude', 'cursor', 'gemini']
        },
        rules: ['child/rule.md', 'base-a/rule.md'],
        agents: ['planner.md', 'security-reviewer.md'],
        commands: ['plan.md', 'code-review.md'],
        skills: ['verification-loop', 'coding-standards'],
        tools: {
          cursor: { rules: ['child-rule.md', 'common-coding-style.md'], skills: ['child-skill', 'extra-skill'] },
          gemini: { rules: ['child-rule.md'] }
        }
      }), 'utf8');

      const [resolved] = resolveSelectedPackages(['child'], { packagesDir });
      assert.deepStrictEqual(resolved.extends, ['base-a', 'base-b']);
      assert.deepStrictEqual(resolved.rules, [
        'common/coding-style.md',
        'base-a/rule.md',
        'common/testing.md',
        'base-b/rule.md',
        'child/rule.md'
      ]);
      assert.deepStrictEqual(resolved.agents, ['planner.md', 'code-reviewer.md', 'security-reviewer.md']);
      assert.deepStrictEqual(resolved.commands, ['plan.md', 'verify.md', 'code-review.md']);
      assert.deepStrictEqual(resolved.skills, ['verification-loop', 'security-review', 'coding-standards']);
      assert.deepStrictEqual(resolved.tools.cursor.rules, ['common-coding-style.md', 'common-testing.md', 'child-rule.md']);
      assert.deepStrictEqual(resolved.tools.cursor.skills, ['frontend-slides', 'extra-skill', 'child-skill']);
      assert.deepStrictEqual(resolved.tools.gemini.rules, ['common-coding-style.md', 'common-testing.md', 'child-rule.md']);
      assert.deepStrictEqual(resolved.requires, {
        hooks: true,
        runtimeScripts: true,
        sessionData: true,
        tools: ['cursor']
      });
    });
  })) passed++; else failed++;

  if (test('resolveSelectedPackages rejects extends cycles', () => {
    withTempDir('mdt-package-cycle-', (tempDir) => {
      const packagesDir = path.join(tempDir, 'packages');
      fs.mkdirSync(path.join(packagesDir, 'alpha'), { recursive: true });
      fs.mkdirSync(path.join(packagesDir, 'beta'), { recursive: true });

      fs.writeFileSync(path.join(packagesDir, 'alpha', 'package.json'), JSON.stringify({
        name: 'alpha',
        description: 'Alpha',
        ruleDirectory: 'typescript',
        extends: ['beta'],
        rules: [],
        agents: [],
        commands: [],
        skills: [],
        tools: { cursor: { rules: [], skills: [] }, gemini: { rules: [] } }
      }), 'utf8');

      fs.writeFileSync(path.join(packagesDir, 'beta', 'package.json'), JSON.stringify({
        name: 'beta',
        description: 'Beta',
        ruleDirectory: 'typescript',
        extends: ['alpha'],
        rules: [],
        agents: [],
        commands: [],
        skills: [],
        tools: { cursor: { rules: [], skills: [] }, gemini: { rules: [] } }
      }), 'utf8');

      assert.throws(
        () => resolveSelectedPackages(['alpha'], { packagesDir }),
        /Package extends cycle detected: alpha -> beta -> alpha/
      );
    });
  })) passed++; else failed++;

  if (test('loadPackageManifest loads typescript cursor package details', () => {
    const manifest = loadPackageManifest('typescript');
    assert.strictEqual(manifest.name, 'typescript');
    assert.ok(manifest.description.includes('TypeScript'));
    assert.strictEqual(manifest.ruleDirectory, 'typescript');
    assert.ok(Array.isArray(manifest.rules));
    assert.ok(manifest.rules.includes('common/coding-style.md'));
    assert.ok(manifest.rules.includes('typescript/coding-style.md'));
    assert.ok(manifest.agents.includes('planner.md'));
    assert.ok(manifest.commands.includes('plan.md'));
    assert.ok(manifest.skills.includes('coding-standards'));
    assert.ok(Array.isArray(manifest.tools.cursor.rules));
    assert.ok(manifest.tools.cursor.rules.includes('typescript-coding-style.md'));
    assert.ok(Array.isArray(manifest.tools.gemini.rules));
    assert.ok(manifest.tools.gemini.rules.includes('typescript-coding-style.md'));
    assert.deepStrictEqual(manifest.tools.cursor.skills, ['frontend-slides']);
    assert.deepStrictEqual(manifest.requires, {});
  })) passed++; else failed++;

  if (test('loadPackageManifest loads python explicit package details', () => {
    const manifest = loadPackageManifest('python');
    assert.strictEqual(manifest.name, 'python');
    assert.strictEqual(manifest.ruleDirectory, 'python');
    assert.ok(Array.isArray(manifest.rules));
    assert.ok(manifest.rules.includes('common/coding-style.md'));
    assert.ok(manifest.rules.includes('python/coding-style.md'));
    assert.ok(manifest.agents.includes('python-reviewer.md'));
    assert.ok(manifest.commands.includes('python-review.md'));
    assert.ok(manifest.skills.includes('python-patterns'));
    assert.ok(Array.isArray(manifest.tools.cursor.rules));
    assert.ok(manifest.tools.cursor.rules.includes('python-coding-style.md'));
    assert.ok(Array.isArray(manifest.tools.gemini.rules));
    assert.ok(manifest.tools.gemini.rules.includes('python-coding-style.md'));
    assert.deepStrictEqual(manifest.requires, {});
  })) passed++; else failed++;

  if (test('loadPackageManifest loads capability package requires metadata', () => {
    const manifest = loadPackageManifest('continuous-learning');
    assert.strictEqual(manifest.name, 'continuous-learning');
    assert.deepStrictEqual(manifest.requires, {
      hooks: true,
      runtimeScripts: true,
      sessionData: true,
      tools: ['claude', 'cursor']
    });
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

  if (test('buildInstallPlan warns when package requires experimental Cursor hooks', () => {
    const plan = buildInstallPlan({ target: 'cursor', globalScope: false, packageNames: ['continuous-learning'] });
    assert.ok(plan.some((line) => line.includes('Warning: package \'continuous-learning\' requires hooks')));
    assert.ok(plan.some((line) => line.includes('Cursor hook support is experimental')));
  })) passed++; else failed++;

  if (test('buildInstallPlan rejects packages that do not support the selected target', () => {
    assert.throws(
      () => buildInstallPlan({ target: 'gemini', globalScope: false, packageNames: ['continuous-learning'] }),
      /Package 'continuous-learning' does not support target 'gemini'/
    );
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

  if (test('assertPackageRequirements rejects unsupported targets and warns for experimental Cursor hooks', () => {
    assert.throws(
      () => assertPackageRequirements('gemini', resolveSelectedPackages(['continuous-learning'])),
      /Package 'continuous-learning' does not support target 'gemini'/
    );

    const warnings = assertPackageRequirements('cursor', resolveSelectedPackages(['continuous-learning']));
    assert.ok(warnings.some((line) => line.includes("package 'continuous-learning' requires hooks")));
    assert.ok(warnings.some((line) => line.includes('Cursor hook support is experimental')));
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

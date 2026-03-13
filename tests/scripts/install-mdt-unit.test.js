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
  assertSkillRequirements,
  getSkillRequirementWarnings,
  installClaudeContentDirs,
  installCursorCoreDirs,
  installCodexSkills
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
    const parsed = parseArgsFrom(['--target', 'cursor', '--global', '--list', '--dry-run', '--dev', 'typescript']);
    assert.strictEqual(parsed.target, 'cursor');
    assert.strictEqual(parsed.globalScope, true);
    assert.strictEqual(parsed.listMode, true);
    assert.strictEqual(parsed.dryRun, true);
    assert.strictEqual(parsed.devMode, true);
    assert.deepStrictEqual(parsed.packageNames, ['typescript']);
  })) passed++; else failed++;

  if (test('parseArgsFrom parses explicit project dir', () => {
    const parsed = parseArgsFrom(['--target', 'codex', '--project-dir', 'C:\\temp\\repo', 'typescript']);
    assert.strictEqual(parsed.target, 'codex');
    assert.strictEqual(parsed.projectDir, path.resolve('C:\\temp\\repo'));
    assert.deepStrictEqual(parsed.packageNames, ['typescript']);
  })) passed++; else failed++;

  if (test('parseArgsFrom accepts public tool aliases for direct script use', () => {
    const parsed = parseArgsFrom(['--tool', 'cursor', '--config-root', 'C:\\temp\\.cursor', 'typescript']);
    assert.strictEqual(parsed.target, 'cursor');
    assert.strictEqual(parsed.overrideDir, path.resolve('C:\\temp\\.cursor'));
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

  if (test('buildInstallPlan returns codex global plan by default', () => {
    const plan = buildInstallPlan({ target: 'codex', devMode: false, packageNames: ['typescript', 'continuous-learning'] });
    assert.ok(plan.some((line) => line.includes('[dry-run] Target: codex (global)')));
    assert.ok(plan.some((line) => line.includes('Packages: typescript, continuous-learning')));
    assert.ok(plan.some((line) => line.includes(path.join(os.homedir(), '.codex'))));
    assert.ok(plan.some((line) => line.includes(path.join(os.homedir(), '.codex', 'mdt'))));
    assert.ok(plan.some((line) => line.includes(path.join(os.homedir(), '.codex', 'mdt', 'hardening'))));
  })) passed++; else failed++;

  if (test('buildInstallPlan returns codex global-only plan', () => {
    const plan = buildInstallPlan({ target: 'codex', devMode: false, packageNames: ['typescript'] });
    assert.ok(plan.some((line) => line.includes('[dry-run] Target: codex (global)')));
    assert.ok(plan.some((line) => line.includes(path.join(os.homedir(), '.codex'))));
    assert.ok(!plan.some((line) => line.includes(path.join(process.cwd(), '.codex'))));
  })) passed++; else failed++;

  if (test('buildInstallPlan uses override dir for redirected installs', () => {
    withTempDir('mdt-install-plan-', (tempDir) => {
      const plan = buildInstallPlan({ target: 'cursor', devMode: false, overrideDir: tempDir, packageNames: ['typescript'] });
      assert.ok(plan.some((line) => line.includes(`Tool config root: ${tempDir}`)));
      assert.ok(plan.some((line) => line.includes(path.join(tempDir, 'mdt'))));
    });
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
          cursor: { rules: ['common-coding-style.md'], skills: ['frontend-slides'] }
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
          cursor: { rules: ['common-testing.md'], skills: ['frontend-slides', 'extra-skill'] }
        }
      }), 'utf8');

      fs.writeFileSync(path.join(packagesDir, 'child', 'package.json'), JSON.stringify({
        name: 'child',
        description: 'Child',
        ruleDirectory: 'rust',
        extends: ['base-a', 'base-b'],
        requires: {
          tools: ['claude', 'cursor']
        },
        rules: ['child/rule.md', 'base-a/rule.md'],
        agents: ['planner.md', 'security-reviewer.md'],
        commands: ['plan.md', 'code-review.md'],
        skills: ['verification-loop', 'coding-standards'],
        tools: {
          cursor: { rules: ['child-rule.md', 'common-coding-style.md'], skills: ['child-skill', 'extra-skill'] }
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
        tools: { cursor: { rules: [], skills: [] } }
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
        tools: { cursor: { rules: [], skills: [] } }
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
    assert.deepStrictEqual(manifest.tools.cursor.skills, ['frontend-slides']);
    assert.deepStrictEqual(manifest.tools.cursor.commands, ['plan.md', 'tdd.md', 'verify.md', 'commit.md', 'code-review.md', 'e2e.md', 'security.md', 'build-fix.md', 'refactor-clean.md']);
    assert.deepStrictEqual(manifest.tools.codex.rules, ['common-coding-style.md', 'common-testing.md', 'common-security.md', 'common-git-workflow.md']);
    assert.deepStrictEqual(manifest.tools.codex.skills, ['coding-standards', 'tdd-workflow', 'verification-loop', 'security-review', 'backend-patterns', 'frontend-patterns', 'e2e-testing']);
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
    assert.deepStrictEqual(manifest.tools.cursor.commands, []);
    assert.deepStrictEqual(manifest.requires, {});
  })) passed++; else failed++;

  if (test('loadPackageManifest loads capability package requires metadata', () => {
    const manifest = loadPackageManifest('continuous-learning');
    assert.strictEqual(manifest.name, 'continuous-learning');
    assert.deepStrictEqual(manifest.requires, {
      runtimeScripts: true,
      sessionData: true,
      tools: ['claude', 'cursor', 'codex']
    });
    assert.deepStrictEqual(manifest.tools.claude.skills, ['ai-learning']);
    assert.deepStrictEqual(manifest.tools.cursor.skills, ['ai-learning']);
    assert.deepStrictEqual(manifest.tools.codex.skills, ['ai-learning']);
    assert.deepStrictEqual(manifest.tools.cursor.commands, [
      'instinct-export.md',
      'instinct-import.md',
      'instinct-status.md',
      'learn.md',
      'projects.md',
      'promote.md',
      'skill-create.md'
    ]);
  })) passed++; else failed++;

  if (test('loadPackageManifest loads codex observer package as separate opt-in layer', () => {
    const manifest = loadPackageManifest('continuous-learning-observer');
    assert.strictEqual(manifest.name, 'continuous-learning-observer');
    assert.deepStrictEqual(manifest.extends, ['continuous-learning']);
    assert.deepStrictEqual(manifest.tools.codex.scripts, ['codex-observer.js']);
    assert.deepStrictEqual(manifest.requires, {
      runtimeScripts: true,
      sessionData: true,
      tools: ['codex']
    });
  })) passed++; else failed++;

  if (test('buildInstallPlan includes global cursor rule install and packages', () => {
    const plan = buildInstallPlan({ target: 'cursor', devMode: false, packageNames: ['typescript'] });
    assert.ok(plan.some((line) => line.includes('Target: cursor (global)')));
    assert.ok(plan.some((line) => line.includes('Packages: typescript')));
    assert.ok(plan.some((line) => line.includes('Would install Cursor rules')));
    assert.ok(plan.some((line) => line.includes(path.join(os.homedir(), '.cursor', 'mdt', 'hardening'))));
  })) passed++; else failed++;

  if (test('buildInstallPlan includes claude runtime scripts detail', () => {
    const plan = buildInstallPlan({ target: 'claude', devMode: false, packageNames: ['typescript'] });
    assert.ok(plan.some((line) => line.includes('runtime scripts')));
    assert.ok(plan.some((line) => line.includes(path.join(os.homedir(), '.claude', 'mdt'))));
    assert.ok(plan.some((line) => line.includes(path.join(os.homedir(), '.claude', 'mdt', 'hardening'))));
    assert.ok(plan.some((line) => line.includes('Packages: typescript')));
  })) passed++; else failed++;

  if (test('buildInstallPlan does not warn about optional hooks for cursor continuous learning', () => {
    const plan = buildInstallPlan({ target: 'cursor', devMode: false, packageNames: ['continuous-learning'] });
    // ai-learning has optional hooks — no hook warning expected for cursor
    assert.ok(!plan.some((line) => line.includes("skill 'ai-learning' depends on hooks")));
  })) passed++; else failed++;

  if (test('buildInstallPlan advertises dev smoke surfaces for audited tools', () => {
    const claudePlan = buildInstallPlan({ target: 'claude', devMode: true, packageNames: ['continuous-learning'] });
    const cursorPlan = buildInstallPlan({ target: 'cursor', devMode: true, packageNames: ['continuous-learning'] });
    const codexPlan = buildInstallPlan({ target: 'codex', devMode: true, packageNames: ['continuous-learning'] });

    assert.ok(claudePlan.some((line) => line.includes('Claude dev smoke scripts')));
    assert.ok(cursorPlan.some((line) => line.includes('Cursor dev smoke command')));
    assert.ok(codexPlan.some((line) => line.includes('Codex dev skills (mdt-dev-smoke, mdt-dev-verify)')));
  })) passed++; else failed++;

  if (test('buildInstallPlan claude installs globally by default', () => {
    const plan = buildInstallPlan({ target: 'claude', devMode: false, packageNames: ['typescript'] });
    assert.ok(plan.some((line) => line.includes('.claude')));
    assert.ok(plan.some((line) => line.includes(path.join(os.homedir(), '.claude', 'mdt'))));
    assert.ok(plan.some((line) => line.includes('Target: claude (global)')));
  })) passed++; else failed++;

  if (test('buildInstallPlan claude global installs to home .claude', () => {
    const plan = buildInstallPlan({ target: 'claude', devMode: false, packageNames: ['typescript'] });
    const home = require('os').homedir();
    assert.ok(plan.some((line) => line.includes('Target: claude (global)')));
    assert.ok(plan.some((line) => line.includes(home)));
    assert.ok(plan.some((line) => line.includes(path.join(home, '.claude', 'mdt'))));
  })) passed++; else failed++;

  if (test('parseArgsFrom parses --global for claude target', () => {
    const parsed = parseArgsFrom(['--global', 'typescript']);
    assert.strictEqual(parsed.target, 'claude');
    assert.strictEqual(parsed.globalScope, true);
    assert.deepStrictEqual(parsed.packageNames, ['typescript']);
  })) passed++; else failed++;

  if (test('parseArgsFrom parses --override for redirected installs', () => {
    const parsed = parseArgsFrom(['--target', 'cursor', '--override', 'C:\\temp\\.cursor', 'typescript']);
    assert.strictEqual(parsed.target, 'cursor');
    assert.strictEqual(parsed.overrideDir, path.resolve('C:\\temp\\.cursor'));
    assert.deepStrictEqual(parsed.packageNames, ['typescript']);
  })) passed++; else failed++;

  if (test('installClaudeContentDirs copies only selected shared assets', () => {
    withTempDir('mdt-install-claude-', (tempDir) => {
      installClaudeContentDirs(tempDir, resolveSelectedPackages(['typescript', 'continuous-learning']));

      assert.ok(fs.existsSync(path.join(tempDir, 'agents', 'planner.md')));
      assert.ok(!fs.existsSync(path.join(tempDir, 'agents', 'python-reviewer.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'commands', 'plan.md')));
      assert.ok(!fs.existsSync(path.join(tempDir, 'commands', 'python-review.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'coding-standards', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'coding-standards', 'skill.meta.json')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'ai-learning', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'ai-learning', 'skill.meta.json')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'ai-learning', 'SKILL.md')));
      assert.ok(!fs.existsSync(path.join(tempDir, 'skills', 'python-patterns', 'SKILL.md')));
    });
  })) passed++; else failed++;

  if (test('installClaudeContentDirs includes public docs skill and dev-only smoke command in dev mode', () => {
    withTempDir('mdt-install-claude-dev-', (tempDir) => {
      installClaudeContentDirs(tempDir, resolveSelectedPackages(['typescript']), true);
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'docs-steward', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'commands', 'mdt-dev-smoke.md')));
    });
  })) passed++; else failed++;

  if (test('installCursorCoreDirs copies selected shared skills and cursor skills only', () => {
    withTempDir('mdt-install-cursor-', (tempDir) => {
      installCursorCoreDirs(tempDir, resolveSelectedPackages(['typescript', 'continuous-learning']));

      assert.ok(fs.existsSync(path.join(tempDir, 'agents', 'planner.md')));
      assert.ok(!fs.existsSync(path.join(tempDir, 'agents', 'python-reviewer.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'frontend-slides', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'ai-learning', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'ai-learning', 'SKILL.md')));
      assert.ok(!fs.existsSync(path.join(tempDir, 'skills', 'rust-patterns', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'commands', 'docs-audit.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'commands', 'instinct-status.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'commands', 'instinct-export.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'commands', 'instinct-import.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'commands', 'install-rules.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'commands', 'plan.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'commands', 'projects.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'commands', 'promote.md')));
      assert.ok(!fs.existsSync(path.join(tempDir, 'commands', 'mdt-dev-smoke.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'docs-steward', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'commands', 'learn.md')));

      const planCommand = fs.readFileSync(path.join(tempDir, 'commands', 'plan.md'), 'utf8');
      const docsAuditCommand = fs.readFileSync(path.join(tempDir, 'commands', 'docs-audit.md'), 'utf8');
      const installRulesCommand = fs.readFileSync(path.join(tempDir, 'commands', 'install-rules.md'), 'utf8');
      assert.ok(planCommand.includes('Wait for explicit user confirmation before making code changes.'));
      assert.ok(!planCommand.includes('Use Cursor’s custom command UI'));
      assert.ok(docsAuditCommand.includes('# Docs Audit'));
      assert.ok(docsAuditCommand.includes('docs-steward'));
      assert.ok(installRulesCommand.includes('mdt.js bridge materialize --tool cursor --surface rules'));
    });
  })) passed++; else failed++;

  if (test('installCursorCoreDirs adds dev-only smoke command in dev mode', () => {
    withTempDir('mdt-install-cursor-dev-', (tempDir) => {
      installCursorCoreDirs(tempDir, resolveSelectedPackages(['typescript']), true);
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'docs-steward', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'commands', 'mdt-dev-smoke.md')));
    });
  })) passed++; else failed++;

  if (test('installCodexSkills copies selected package skills from codex-template sources only', () => {
    withTempDir('mdt-install-codex-', (tempDir) => {
      installCodexSkills(resolveSelectedPackages(['typescript', 'continuous-learning']), tempDir);

      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'coding-standards', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'coding-standards', 'skill.meta.json')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'docs-steward', 'SKILL.md')));
      assert.ok(!fs.existsSync(path.join(tempDir, 'skills', 'mdt-dev-verify', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'ai-learning', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'ai-learning', 'skill.meta.json')));
      // Codex install must not include the hooks/ directory (no hook runtime in Codex)
      assert.ok(!fs.existsSync(path.join(tempDir, 'skills', 'ai-learning', 'hooks')));
      assert.ok(!fs.existsSync(path.join(tempDir, 'skills', 'python-patterns', 'SKILL.md')));
    });
  })) passed++; else failed++;

  if (test('installCodexSkills adds only dev verifier and dev smoke skills in dev mode', () => {
    withTempDir('mdt-install-codex-dev-', (tempDir) => {
      installCodexSkills(resolveSelectedPackages(['typescript', 'continuous-learning']), tempDir, true);
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'mdt-dev-verify', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'mdt-dev-smoke', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'docs-steward', 'SKILL.md')));
    });
  })) passed++; else failed++;

  if (test('installCodexSkills does not inherit top-level shared package skills for codex', () => {
    withTempDir('mdt-install-codex-explicit-', (tempDir) => {
      const packagesDir = path.join(tempDir, 'packages');
      fs.mkdirSync(path.join(packagesDir, 'explicit-codex'), { recursive: true });
      fs.writeFileSync(path.join(packagesDir, 'explicit-codex', 'package.json'), JSON.stringify({
        name: 'explicit-codex',
        description: 'Codex explicit skill selection test',
        ruleDirectory: 'typescript',
        rules: [],
        agents: [],
        commands: [],
        skills: ['ai-learning'],
        tools: {
          codex: {
            skills: ['docs-steward']
          }
        }
      }), 'utf8');

      installCodexSkills(resolveSelectedPackages(['explicit-codex'], { packagesDir }), tempDir);

      assert.ok(fs.existsSync(path.join(tempDir, 'skills', 'docs-steward', 'SKILL.md')));
      assert.ok(!fs.existsSync(path.join(tempDir, 'skills', 'ai-learning', 'SKILL.md')));
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

  if (test('assertPackageRequirements warns for experimental Cursor hooks', () => {
    const warnings = assertPackageRequirements('cursor', resolveSelectedPackages(['continuous-learning']));
    assert.deepStrictEqual(warnings, []);
    assert.deepStrictEqual(assertPackageRequirements('codex', resolveSelectedPackages(['continuous-learning'])), []);
  })) passed++; else failed++;

  if (test('getSkillRequirementWarnings does not warn about hooks for codex manual continuous learning', () => {
    const warnings = getSkillRequirementWarnings('codex', resolveSelectedPackages(['continuous-learning']));
    assert.ok(!warnings.some((line) => line.includes('hooks')), `Unexpected hook warning: ${warnings.join('\n')}`);
  })) passed++; else failed++;

  if (test('getSkillRequirementWarnings does not warn about optional hooks for cursor', () => {
    const warnings = getSkillRequirementWarnings('cursor', resolveSelectedPackages(['continuous-learning']));
    // ai-learning has optional hooks — no hook warning expected for cursor
    assert.ok(
      !warnings.some((line) => line.includes("skill 'ai-learning'")),
      `Unexpected cursor hook warning: ${warnings.join('\n')}`
    );
  })) passed++; else failed++;

  if (test('getSkillRequirementWarnings does not warn about automatic hooks for claude', () => {
    const warnings = getSkillRequirementWarnings('claude', resolveSelectedPackages(['continuous-learning']));
    assert.ok(
      !warnings.some((line) => line.includes("skill 'ai-learning'")),
      `Unexpected Claude warning: ${warnings.join('\n')}`
    );
  })) passed++; else failed++;

  if (test('assertSkillRequirements accepts companion skills satisfied by the baseline install set', () => {
    withTempDir('mdt-package-skill-warn-', (tempDir) => {
      const packagesDir = path.join(tempDir, 'packages');
      fs.mkdirSync(path.join(packagesDir, 'demo'), { recursive: true });
      fs.writeFileSync(path.join(packagesDir, 'demo', 'package.json'), JSON.stringify({
        name: 'demo',
        description: 'Demo',
        ruleDirectory: 'typescript',
        rules: ['common/development-workflow.md', 'common/testing.md'],
        agents: [],
        commands: [],
        skills: ['tdd-workflow'],
        tools: {}
      }), 'utf8');

      assert.doesNotThrow(() => assertSkillRequirements('claude', resolveSelectedPackages(['demo'], { packagesDir })));
    });
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

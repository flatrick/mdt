/**
 * Tests for scripts/install-mdt.js
 *
 * Run with: node tests/scripts/install-mdt.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ensureSubprocessCapability } = require('../helpers/subprocess-capability');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { buildTestEnv } = require('../helpers/test-env-profiles');

function runInstaller(args, options = {}) {
  const repoRoot = path.join(__dirname, '..', '..');
  const installerPath = path.join(repoRoot, 'scripts', 'install-mdt.js');
  const installerArgs = [installerPath];
  if (options.projectDir) {
    installerArgs.push('--project-dir', options.projectDir);
  }
  installerArgs.push(...args);
  return spawnSync('node', installerArgs, {
    encoding: 'utf8',
    cwd: options.cwd || repoRoot,
    env: buildTestEnv(options.profile || 'neutral', options.env || {}),
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 20000
  });
}

function assertSuccess(result, context) {
  assert.strictEqual(
    result.status,
    0,
    `${context} should exit 0, got ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
}

function runCase(testCase, counters) {
  if (test(testCase.name, testCase.run)) {
    counters.passed++;
  } else {
    counters.failed++;
  }
}

function runTests() {
  console.log('\n=== Testing install-mdt.js ===\n');

  const counters = { passed: 0, failed: 0 };
  const testCases = [
    {
      name: 'claude install copies runtime scripts and docs validators only',
      run: () => {
        const tmpHome = createTestDir('mdt-install-claude-');
        const claudeBase = path.join(tmpHome, '.claude');

        try {
          const result = runInstaller(['--global', 'typescript'], {
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome,
              CLAUDE_BASE_DIR: claudeBase
            }
          });
          assertSuccess(result, 'claude install');

          assert.ok(fs.existsSync(path.join(claudeBase, 'scripts', 'hooks', 'session-start.js')));
          assert.ok(fs.existsSync(path.join(claudeBase, 'scripts', 'lib', 'utils.js')));
          assert.ok(fs.existsSync(path.join(claudeBase, 'scripts', 'ci', 'validate-markdown-links.js')));
          assert.ok(fs.existsSync(path.join(claudeBase, 'scripts', 'ci', 'validate-markdown-path-refs.js')));
          assert.ok(fs.existsSync(path.join(claudeBase, 'scripts', 'ci', 'markdown-utils.js')));
          assert.ok(!fs.existsSync(path.join(claudeBase, 'scripts', 'ci', 'validate-install-packages.js')), 'only selected docs validators should be installed');
          assert.ok(!fs.existsSync(path.join(claudeBase, 'scripts', 'install-mdt.js')), 'top-level installer must not be installed');
        } finally {
          cleanupTestDir(tmpHome);
        }
      }
    },
    {
      name: 'cursor install copies runtime scripts and docs validators only',
      run: () => {
        const tmpHome = createTestDir('mdt-install-cursor-home-');
        const tmpProject = createTestDir('mdt-install-cursor-proj-');

        try {
          const result = runInstaller(['--target', 'cursor', 'typescript'], {
            cwd: tmpProject,
            projectDir: tmpProject,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(result, 'cursor install');

          const cursorRoot = path.join(tmpProject, '.cursor');
          assert.ok(fs.existsSync(path.join(cursorRoot, 'scripts', 'hooks', 'session-start.js')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'scripts', 'lib', 'utils.js')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'scripts', 'ci', 'validate-markdown-links.js')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'scripts', 'ci', 'validate-markdown-path-refs.js')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'scripts', 'ci', 'markdown-utils.js')));
          assert.ok(!fs.existsSync(path.join(cursorRoot, 'scripts', 'ci', 'validate-install-packages.js')), 'only selected docs validators should be installed');
          assert.ok(!fs.existsSync(path.join(cursorRoot, 'scripts', 'install-mdt.js')), 'top-level installer must not be installed');
        } finally {
          cleanupTestDir(tmpHome);
          cleanupTestDir(tmpProject);
        }
      }
    },
    {
      name: 'cursor install copies selected shared skills and cursor skills only',
      run: () => {
        const tmpHome = createTestDir('mdt-install-cursor-skills-home-');
        const tmpProject = createTestDir('mdt-install-cursor-skills-proj-');

        try {
          const result = runInstaller(['--target', 'cursor', 'typescript', 'continuous-learning'], {
            cwd: tmpProject,
            projectDir: tmpProject,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(result, 'cursor package install');

          const cursorRoot = path.join(tmpProject, '.cursor');
          assert.ok(
            fs.existsSync(path.join(cursorRoot, 'skills', 'documentation-steward', 'SKILL.md')),
            'Cursor install should copy the shared documentation-steward skill'
          );
          assert.ok(
            fs.existsSync(path.join(cursorRoot, 'skills', 'frontend-slides', 'SKILL.md')),
            'Cursor install should copy the declared frontend-slides skill'
          );
          assert.ok(
            fs.existsSync(path.join(cursorRoot, 'skills', 'continuous-learning-manual', 'SKILL.md')),
            'Cursor install should copy selected shared capability skills'
          );
          assert.ok(
            fs.existsSync(path.join(cursorRoot, 'skills', 'continuous-learning-automatic', 'SKILL.md')),
            'Cursor install should copy the Cursor-facing automatic learning skill from the shared skills tree'
          );
          assert.ok(
            fs.existsSync(path.join(cursorRoot, 'rules', 'typescript-coding-style.md')),
            'Cursor install should copy package-declared TypeScript rules'
          );
          assert.ok(
            !fs.existsSync(path.join(cursorRoot, 'skills', 'rust-patterns')),
            'Cursor install should not copy unrelated shared rust skills'
          );
          assert.ok(
            !fs.existsSync(path.join(cursorRoot, 'rules', 'python-coding-style.md')),
            'Cursor install should not copy unrelated Cursor rules'
          );
          assert.ok(
            !fs.existsSync(path.join(cursorRoot, 'skills', 'sqlserver-patterns')),
            'Cursor install should not copy unrelated shared sql skills'
          );
        } finally {
          cleanupTestDir(tmpHome);
          cleanupTestDir(tmpProject);
        }
      }
    },
    {
      name: 'cursor install copies only package-selected Cursor command prompts',
      run: () => {
        const tmpHome = createTestDir('mdt-install-cursor-commands-home-');
        const tmpProject = createTestDir('mdt-install-cursor-commands-proj-');

        try {
          const result = runInstaller(['--target', 'cursor', 'typescript', 'continuous-learning'], {
            cwd: tmpProject,
            projectDir: tmpProject,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(result, 'cursor package install with commands');

          const cursorRoot = path.join(tmpProject, '.cursor');
          const commandsRoot = path.join(cursorRoot, 'commands');

          assert.ok(
            fs.existsSync(path.join(commandsRoot, 'docs-health.md')),
            'Cursor install should copy the docs-health command prompt'
          );
          assert.ok(
            fs.existsSync(path.join(commandsRoot, 'plan.md')),
            'Cursor install should copy the plan command template from cursor-template/commands for typescript'
          );
          assert.ok(
            fs.existsSync(path.join(commandsRoot, 'tdd.md')),
            'Cursor install should copy the tdd command template from cursor-template/commands for typescript'
          );
          assert.ok(
            fs.existsSync(path.join(commandsRoot, 'verify.md')),
            'Cursor install should copy the verify command template from cursor-template/commands for typescript'
          );
          assert.ok(
            fs.existsSync(path.join(commandsRoot, 'code-review.md')),
            'Cursor install should copy the code-review command template from cursor-template/commands for typescript'
          );
          assert.ok(
            fs.existsSync(path.join(commandsRoot, 'smoke.md')),
            'Cursor install should copy the smoke command prompt from cursor-template/commands for typescript'
          );
          assert.ok(
            fs.existsSync(path.join(commandsRoot, 'learn.md')),
            'Cursor install should copy the learn command template from cursor-template/commands for continuous-learning'
          );
          assert.ok(
            fs.existsSync(path.join(commandsRoot, 'skill-create.md')),
            'Cursor install should copy the skill-create command prompt from cursor-template/commands for continuous-learning'
          );

          const docsHealthCommand = fs.readFileSync(path.join(commandsRoot, 'docs-health.md'), 'utf8');
          const planCommand = fs.readFileSync(path.join(commandsRoot, 'plan.md'), 'utf8');
          const smokeCommand = fs.readFileSync(path.join(commandsRoot, 'smoke.md'), 'utf8');
          const verifyCommand = fs.readFileSync(path.join(commandsRoot, 'verify.md'), 'utf8');
          const learnCommand = fs.readFileSync(path.join(commandsRoot, 'learn.md'), 'utf8');

          assert.ok(
            docsHealthCommand.includes('DOCS HEALTH: PASS|PARTIAL|FAIL'),
            'Cursor docs-health command should contain the documentation audit report contract'
          );
          assert.ok(
            planCommand.includes('Wait for explicit user confirmation before making code changes.'),
            'Cursor plan command should contain a real planning workflow prompt'
          );
          assert.ok(
            !planCommand.includes('Use Cursor’s custom command UI'),
            'Cursor plan command should no longer be a setup template'
          );
          assert.ok(
            smokeCommand.includes('SMOKE: PASS|FAIL|PARTIAL'),
            'Cursor smoke command should contain the quick sanity-check report contract'
          );
          assert.ok(
            verifyCommand.includes('VERIFICATION: PASS|FAIL'),
            'Cursor verify command should contain the verification report contract'
          );
          assert.ok(
            learnCommand.includes('Session Learning Summary'),
            'Cursor learn command should contain the reusable learning workflow'
          );

          assert.ok(fs.existsSync(path.join(commandsRoot, 'e2e.md')), 'e2e command should be installed');
          assert.ok(fs.existsSync(path.join(commandsRoot, 'security.md')), 'security command should be installed');
          assert.ok(fs.existsSync(path.join(commandsRoot, 'build-fix.md')), 'build-fix command should be installed');
          assert.ok(fs.existsSync(path.join(commandsRoot, 'refactor-clean.md')), 'refactor-clean command should be installed');

          const e2eCommand = fs.readFileSync(path.join(commandsRoot, 'e2e.md'), 'utf8');
          const securityCommand = fs.readFileSync(path.join(commandsRoot, 'security.md'), 'utf8');
          assert.ok(e2eCommand.includes('Page Object Model'), 'e2e command should reference Page Object Model');
          assert.ok(securityCommand.includes('CRITICAL'), 'security command should include severity levels');
        } finally {
          cleanupTestDir(tmpHome);
          cleanupTestDir(tmpProject);
        }
      }
    },
    {
      name: 'cursor install supports explicit project dir',
      run: () => {
        const tmpHome = createTestDir('mdt-install-cursor-path-home-');
        const tmpInvoker = createTestDir('mdt-install-cursor-path-invoker-');
        const tmpProject = createTestDir('mdt-install-cursor-path-proj-');

        try {
          const result = runInstaller(['--target', 'cursor', 'typescript'], {
            cwd: tmpInvoker,
            projectDir: tmpProject,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(result, 'cursor install with explicit project dir');

          assert.ok(fs.existsSync(path.join(tmpProject, '.cursor', 'rules', 'typescript-coding-style.md')));
          assert.ok(!fs.existsSync(path.join(tmpInvoker, '.cursor')));
        } finally {
          cleanupTestDir(tmpHome);
          cleanupTestDir(tmpInvoker);
          cleanupTestDir(tmpProject);
        }
      }
    },
    {
      name: 'claude install copies only package-selected shared rules',
      run: () => {
        const tmpProject = createTestDir('mdt-install-claude-rules-');

        try {
          const result = runInstaller(['typescript', 'continuous-learning'], {
            cwd: tmpProject,
            projectDir: tmpProject,
            env: {
              HOME: tmpProject,
              USERPROFILE: tmpProject
            }
          });
          assertSuccess(result, 'claude project install with explicit package rules');

          const claudeRoot = path.join(tmpProject, '.claude');
          assert.ok(fs.existsSync(path.join(claudeRoot, 'rules', 'common', 'coding-style.md')));
          assert.ok(fs.existsSync(path.join(claudeRoot, 'rules', 'typescript', 'coding-style.md')));
          assert.ok(fs.existsSync(path.join(claudeRoot, 'commands', 'docs-health.md')));
          assert.ok(fs.existsSync(path.join(claudeRoot, 'skills', 'documentation-steward', 'SKILL.md')));
          assert.ok(fs.existsSync(path.join(claudeRoot, 'skills', 'continuous-learning-manual', 'SKILL.md')));
          assert.ok(fs.existsSync(path.join(claudeRoot, 'skills', 'continuous-learning-automatic', 'SKILL.md')));
          assert.ok(fs.existsSync(path.join(claudeRoot, 'commands', 'smoke.md')));
          assert.ok(
            !fs.existsSync(path.join(claudeRoot, 'rules', 'python', 'coding-style.md')),
            'Claude install should not copy unrelated Python rules'
          );
        } finally {
          cleanupTestDir(tmpProject);
        }
      }
    },
    {
      name: 'claude install merges hooks into existing settings.json and preserves other keys',
      run: () => {
        const tmpHome = createTestDir('mdt-install-settings-');
        const claudeBase = path.join(tmpHome, '.claude');

        try {
          fs.mkdirSync(claudeBase, { recursive: true });
          fs.writeFileSync(
            path.join(claudeBase, 'settings.json'),
            JSON.stringify({ theme: 'dark', customFlag: true, hooks: { legacy: [] } }, null, 2),
            'utf8'
          );

          const result = runInstaller(['--global', 'typescript'], {
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome,
              CLAUDE_BASE_DIR: claudeBase
            }
          });
          assertSuccess(result, 'claude install with existing settings');

          const settingsPath = path.join(claudeBase, 'settings.json');
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          const settingsRaw = fs.readFileSync(settingsPath, 'utf8');

          assert.strictEqual(settings.theme, 'dark', 'existing non-hook keys should be preserved');
          assert.strictEqual(settings.customFlag, true, 'existing boolean key should be preserved');
          assert.ok(settings.hooks && settings.hooks.PreToolUse, 'hooks should be replaced with installer hooks block');
          assert.ok(!settingsRaw.includes('${MDT_ROOT}'), 'hooks should be materialized to absolute paths');
          assert.ok(fs.existsSync(path.join(claudeBase, 'settings.json.bkp')), 'installer should create backup file');
        } finally {
          cleanupTestDir(tmpHome);
        }
      }
    },
    {
      name: 'claude install merges explicit shared rules from multiple packages only',
      run: () => {
        const tmpProject = createTestDir('mdt-install-claude-multi-rules-');

        try {
          const result = runInstaller(['typescript', 'python'], {
            cwd: tmpProject,
            projectDir: tmpProject,
            env: {
              HOME: tmpProject,
              USERPROFILE: tmpProject
            }
          });
          assertSuccess(result, 'claude multi-package install');

          const claudeRoot = path.join(tmpProject, '.claude');
          assert.ok(fs.existsSync(path.join(claudeRoot, 'rules', 'common', 'coding-style.md')));
          assert.ok(fs.existsSync(path.join(claudeRoot, 'rules', 'typescript', 'coding-style.md')));
          assert.ok(fs.existsSync(path.join(claudeRoot, 'rules', 'python', 'coding-style.md')));
          assert.ok(
            !fs.existsSync(path.join(claudeRoot, 'rules', 'rust', 'coding-style.md')),
            'Claude install should not copy unrelated Rust rules'
          );
        } finally {
          cleanupTestDir(tmpProject);
        }
      }
    },
    {
      name: 'claude project-level install copies to cwd .claude',
      run: () => {
        const tmpProject = createTestDir('mdt-install-claude-proj-');

        try {
          const result = runInstaller(['typescript'], {
            cwd: tmpProject,
            projectDir: tmpProject,
            env: {
              HOME: tmpProject,
              USERPROFILE: tmpProject
            }
          });
          assertSuccess(result, 'claude project install');

          const claudeRoot = path.join(tmpProject, '.claude');
          assert.ok(fs.existsSync(path.join(claudeRoot, 'rules', 'common')), 'common rules should exist');
          assert.ok(fs.existsSync(path.join(claudeRoot, 'scripts', 'lib', 'utils.js')), 'runtime scripts should exist');
          assert.ok(fs.existsSync(path.join(claudeRoot, 'settings.json')), 'settings.json should exist');

          const settingsRaw = fs.readFileSync(path.join(claudeRoot, 'settings.json'), 'utf8');
          assert.ok(!settingsRaw.includes('${MDT_ROOT}'), 'plugin root placeholder should be resolved');
          assert.ok(settingsRaw.includes('.claude'), 'hook paths should use project-relative .claude');
        } finally {
          cleanupTestDir(tmpProject);
        }
      }
    },
    {
      name: 'gemini local install copies only package-selected gemini rules',
      run: () => {
        const tmpHome = createTestDir('mdt-install-gemini-home-');
        const tmpProject = createTestDir('mdt-install-gemini-proj-');

        try {
          const result = runInstaller(['--target', 'gemini', 'typescript'], {
            cwd: tmpProject,
            projectDir: tmpProject,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(result, 'gemini install');

          const agentRulesRoot = path.join(tmpProject, '.agent', 'rules');
          assert.ok(fs.existsSync(path.join(agentRulesRoot, 'common-coding-style.md')));
          assert.ok(fs.existsSync(path.join(agentRulesRoot, 'typescript-coding-style.md')));
          assert.ok(!fs.existsSync(path.join(agentRulesRoot, 'python-coding-style.md')));
        } finally {
          cleanupTestDir(tmpHome);
          cleanupTestDir(tmpProject);
        }
      }
    },
    {
      name: 'gemini global install appends only package-selected gemini rules',
      run: () => {
        const tmpHome = createTestDir('mdt-install-gemini-global-home-');

        try {
          const result = runInstaller(['--target', 'gemini', '--global', 'typescript'], {
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(result, 'gemini global install');

          const geminiMdPath = path.join(tmpHome, '.gemini', 'GEMINI.md');
          const geminiMd = fs.readFileSync(geminiMdPath, 'utf8');
          assert.ok(geminiMd.includes('# TypeScript/JavaScript Coding Style'), 'GEMINI.md should include selected TypeScript rule content');
          assert.ok(geminiMd.includes('# Coding Style'), 'GEMINI.md should include selected common rule content');
          assert.ok(!geminiMd.includes('# Python Coding Style'), 'GEMINI.md should not include unrelated Python rule content');
        } finally {
          cleanupTestDir(tmpHome);
        }
      }
    },
    {
      name: 'cursor dry-run warns when package requires experimental hook support',
      run: () => {
        const result = runInstaller(['--dry-run', '--target', 'cursor', 'continuous-learning']);
        assertSuccess(result, 'cursor dry-run with capability package');
        assert.ok(!result.stdout.includes('requires hooks'));
      }
    },
    {
      name: 'codex project install copies selected project skills and runtime scripts only',
      run: () => {
        const tmpHome = createTestDir('mdt-install-codex-home-');
        const tmpProject = createTestDir('mdt-install-codex-proj-');

        try {
          const gitInit = spawnSync('git', ['init'], {
            encoding: 'utf8',
            cwd: tmpProject,
            stdio: ['pipe', 'pipe', 'pipe']
          });
          assert.strictEqual(gitInit.status, 0, `git init should succeed\nstdout:\n${gitInit.stdout}\nstderr:\n${gitInit.stderr}`);

          const result = runInstaller(['--target', 'codex', 'typescript', 'continuous-learning'], {
            cwd: tmpHome,
            projectDir: tmpProject,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(result, 'codex install');

          const codexRoot = path.join(tmpHome, '.codex');
          const projectAgentsRoot = path.join(tmpProject, '.agents');

          assert.ok(!fs.existsSync(codexRoot), 'project-only Codex install must not touch ~/.codex');
          assert.ok(fs.existsSync(path.join(projectAgentsRoot, 'skills', 'coding-standards', 'SKILL.md')));
          assert.ok(fs.existsSync(path.join(projectAgentsRoot, 'skills', 'documentation-steward', 'SKILL.md')));
          assert.ok(fs.existsSync(path.join(projectAgentsRoot, 'skills', 'tool-setup-verifier', 'SKILL.md')));
          assert.ok(fs.existsSync(path.join(projectAgentsRoot, 'skills', 'continuous-learning-manual', 'SKILL.md')));
          assert.ok(fs.existsSync(path.join(projectAgentsRoot, 'scripts', 'lib', 'detect-env.js')));
          assert.ok(fs.existsSync(path.join(projectAgentsRoot, 'scripts', 'ci', 'validate-markdown-links.js')));
          assert.ok(fs.existsSync(path.join(projectAgentsRoot, 'scripts', 'ci', 'validate-markdown-path-refs.js')));
          assert.ok(fs.existsSync(path.join(projectAgentsRoot, 'scripts', 'codex-observer.js')));
          assert.ok(fs.existsSync(path.join(projectAgentsRoot, 'scripts', 'smoke-tool-setups.js')));
          assert.ok(fs.existsSync(path.join(projectAgentsRoot, 'scripts', 'smoke-codex-workflows.js')));
          assert.ok(!fs.existsSync(path.join(projectAgentsRoot, 'skills', 'python-patterns', 'SKILL.md')));

          const learnStatus = spawnSync(
            'node',
            [path.join(projectAgentsRoot, 'skills', 'continuous-learning-manual', 'scripts', 'codex-learn.js'), 'status'],
            {
              encoding: 'utf8',
              cwd: tmpProject,
              env: {
                ...process.env,
                HOME: tmpHome,
                USERPROFILE: tmpHome
              },
              stdio: ['pipe', 'pipe', 'pipe']
            }
          );
          assert.strictEqual(learnStatus.status, 0, `codex learn status should succeed\nstdout:\n${learnStatus.stdout}\nstderr:\n${learnStatus.stderr}`);
          assert.ok(learnStatus.stdout.includes('Tool: codex'));
          assert.ok(learnStatus.stdout.includes(path.join(tmpProject, '.codex', 'homunculus', 'projects')));

          const instinctStatus = spawnSync(
            'node',
            [path.join(projectAgentsRoot, 'skills', 'continuous-learning-manual', 'scripts', 'instinct-cli.js'), 'status'],
            {
              encoding: 'utf8',
              cwd: tmpProject,
              env: {
                ...process.env,
                HOME: tmpHome,
                USERPROFILE: tmpHome
              },
              stdio: ['pipe', 'pipe', 'pipe']
            }
          );
          assert.strictEqual(instinctStatus.status, 0, `instinct status should succeed\nstdout:\n${instinctStatus.stdout}\nstderr:\n${instinctStatus.stderr}`);
          assert.ok(instinctStatus.stdout.includes(path.join(tmpProject, '.codex', 'homunculus')));
          assert.ok(!instinctStatus.stdout.includes(path.join(tmpHome, '.cursor', 'homunculus')));
        } finally {
          cleanupTestDir(tmpHome);
          cleanupTestDir(tmpProject);
        }
      }
    },
    {
      name: 'codex global install preserves existing user config and writes MDT reference config only',
      run: () => {
        const tmpHome = createTestDir('mdt-install-codex-existing-home-');
        const tmpProject = createTestDir('mdt-install-codex-existing-proj-');

        try {
          const codexRoot = path.join(tmpHome, '.codex');
          fs.mkdirSync(codexRoot, { recursive: true });
          const existingConfig = [
            "[projects.'\\\\?\\C:\\\\src\\\\github\\\\example']",
            'trust_level = "trusted"',
            '',
            '[windows]',
            'sandbox = "elevated"'
          ].join('\n');
          fs.writeFileSync(path.join(codexRoot, 'config.toml'), existingConfig, 'utf8');

          const result = runInstaller(['--target', 'codex', '--global', 'typescript'], {
            cwd: tmpHome,
            projectDir: tmpProject,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(result, 'codex install with existing config');

          assert.strictEqual(
            fs.readFileSync(path.join(codexRoot, 'config.toml'), 'utf8'),
            existingConfig,
            'existing user config should be preserved'
          );
          const referenceConfig = fs.readFileSync(path.join(codexRoot, 'config.mdt.toml'), 'utf8');
          assert.ok(referenceConfig.includes('sandbox_mode = "workspace-write"'));
          assert.ok(referenceConfig.includes('[mcp_servers.github]'));
          assert.ok(fs.existsSync(path.join(codexRoot, 'AGENTS.md')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'rules', 'common-coding-style.md')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'rules', 'common-testing.md')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'rules', 'common-security.md')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'rules', 'common-git-workflow.md')));
          assert.ok(!fs.existsSync(path.join(tmpProject, '.agents')), 'global-only Codex install must not touch project .agents');
        } finally {
          cleanupTestDir(tmpHome);
          cleanupTestDir(tmpProject);
        }
      }
    },
    {
      name: 'gemini install rejects package that does not support gemini target',
      run: () => {
        const tmpProject = createTestDir('mdt-install-gemini-incompatible-');

        try {
          const result = runInstaller(['--target', 'gemini', 'continuous-learning'], {
            cwd: tmpProject,
            projectDir: tmpProject,
            env: {
              HOME: tmpProject,
              USERPROFILE: tmpProject
            }
          });
          assert.strictEqual(result.status, 1, `gemini incompatible install should fail\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
          assert.ok(result.stderr.includes("Package 'continuous-learning' does not support target 'gemini'"));
        } finally {
          cleanupTestDir(tmpProject);
        }
      }
    }
  ];

  for (const testCase of testCases) {
    runCase(testCase, counters);
  }

  console.log('\n=== Test Results ===');
  console.log(`Passed: ${counters.passed}`);
  console.log(`Failed: ${counters.failed}`);
  console.log(`Total:  ${counters.passed + counters.failed}\n`);

  process.exit(counters.failed > 0 ? 1 : 0);
}

ensureSubprocessCapability('tests/scripts/install-mdt.test.js');
runTests();

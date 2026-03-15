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

const REPRESENTATIVE_BASELINE_SKILLS = [
  'api-design',
  'backend-patterns',
  'eval-harness',
  'search-first',
  'security-review',
  'strategic-compact',
  'tdd-workflow',
  'verification-loop'
];

function runInstaller(args, options = {}) {
  const repoRoot = path.join(__dirname, '..', '..');
  const installerPath = path.join(repoRoot, 'scripts', 'install-mdt.js');
  const installerArgs = [installerPath];
  if (options.projectDir) {
    installerArgs.push('--project-dir', options.projectDir);
  }
  if (options.overrideDir) {
    installerArgs.push('--override', options.overrideDir);
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
      name: 'claude install copies runtime scripts and docs validators into mdt root',
      run: () => {
        const tmpHome = createTestDir('mdt-install-claude-');
        const claudeBase = path.join(tmpHome, '.claude');

        try {
          const result = runInstaller(['typescript'], {
            overrideDir: claudeBase,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome,
              CLAUDE_BASE_DIR: claudeBase
            }
          });
          assertSuccess(result, 'claude install');

          assert.ok(fs.existsSync(path.join(claudeBase, 'mdt', 'scripts', 'hooks', 'session-start.js')));
          assert.ok(fs.existsSync(path.join(claudeBase, 'mdt', 'scripts', 'lib', 'utils.js')));
          assert.ok(fs.existsSync(path.join(claudeBase, 'mdt', 'scripts', 'ci', 'validate-markdown-links.js')));
          assert.ok(fs.existsSync(path.join(claudeBase, 'mdt', 'scripts', 'ci', 'validate-markdown-path-refs.js')));
          assert.ok(fs.existsSync(path.join(claudeBase, 'mdt', 'scripts', 'ci', 'markdown-utils.js')));
          assert.ok(!fs.existsSync(path.join(claudeBase, 'mdt', 'scripts', 'mdt-dev-smoke-claude-workflows.js')));
          assert.ok(fs.existsSync(path.join(claudeBase, 'mdt', 'hardening', 'verify-workspace-permissions.mjs')));
          assert.ok(fs.existsSync(path.join(claudeBase, 'mdt', 'hardening', 'CODEX-WINDOWS-SANDBOX-ROOT-CHILD-ACL-ISSUE.md')));
          assert.ok(fs.existsSync(path.join(claudeBase, 'mdt', 'hardening', 'WORKSPACE-PERMISSIONS-PROMPT.md')));
          assert.ok(!fs.existsSync(path.join(claudeBase, 'mdt', 'scripts', 'ci', 'validate-install-packages.js')));
          assert.ok(!fs.existsSync(path.join(claudeBase, 'mdt', 'scripts', 'install-mdt.js')));
        } finally {
          cleanupTestDir(tmpHome);
        }
      }
    },
    {
      name: 'claude dev install always materializes smoke command and tool smoke script',
      run: () => {
        const tmpHome = createTestDir('mdt-install-claude-dev-home-');
        const claudeBase = path.join(tmpHome, '.claude');

        try {
          const result = runInstaller(['--dev', 'ai-learning'], {
            overrideDir: claudeBase,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome,
              CLAUDE_BASE_DIR: claudeBase
            }
          });
          assertSuccess(result, 'claude dev install');

          assert.ok(fs.existsSync(path.join(claudeBase, 'commands', 'mdt-dev-smoke.md')));
          assert.ok(fs.existsSync(path.join(claudeBase, 'mdt', 'scripts', 'mdt-dev-smoke-tool-setups.js')));
          assert.ok(fs.existsSync(path.join(claudeBase, 'mdt', 'scripts', 'mdt-dev-smoke-claude-workflows.js')));
          assert.ok(fs.existsSync(path.join(claudeBase, 'mdt', 'workflow-contracts', 'metadata.json')));
        } finally {
          cleanupTestDir(tmpHome);
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

          const result = runInstaller(['typescript'], {
            overrideDir: claudeBase,
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

          assert.strictEqual(settings.theme, 'dark');
          assert.strictEqual(settings.customFlag, true);
          assert.ok(settings.hooks && settings.hooks.PreToolUse);
          assert.ok(settingsRaw.includes('.claude/mdt'));
          assert.ok(fs.existsSync(path.join(claudeBase, 'settings.json.bkp')));
        } finally {
          cleanupTestDir(tmpHome);
        }
      }
    },
    {
      name: 'claude install writes Edit and Write permissions for mdt root into settings.json',
      run: () => {
        const tmpHome = createTestDir('mdt-install-permissions-');
        const claudeBase = path.join(tmpHome, '.claude');

        try {
          const result = runInstaller(['typescript'], {
            overrideDir: claudeBase,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome,
              CLAUDE_BASE_DIR: claudeBase
            }
          });
          assertSuccess(result, 'claude install permissions');

          const settingsPath = path.join(claudeBase, 'settings.json');
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          const allow = settings.permissions && settings.permissions.allow;
          const mdtRoot = path.join(claudeBase, 'mdt').replace(/\\/g, '/');

          assert.ok(Array.isArray(allow), 'permissions.allow should be an array');
          assert.ok(allow.includes(`Edit(${mdtRoot}/**)`), `permissions.allow should contain Edit(${mdtRoot}/**)`);
          assert.ok(allow.includes(`Write(${mdtRoot}/**)`), `permissions.allow should contain Write(${mdtRoot}/**)`);
        } finally {
          cleanupTestDir(tmpHome);
        }
      }
    },
    {
      name: 'claude install merges mdt permissions without duplicating existing allow entries',
      run: () => {
        const tmpHome = createTestDir('mdt-install-permissions-merge-');
        const claudeBase = path.join(tmpHome, '.claude');
        const mdtRoot = path.join(claudeBase, 'mdt').replace(/\\/g, '/');

        try {
          fs.mkdirSync(claudeBase, { recursive: true });
          fs.writeFileSync(
            path.join(claudeBase, 'settings.json'),
            JSON.stringify({
              permissions: { allow: [`Edit(${mdtRoot}/**)`, 'Bash(npm run *)'] }
            }, null, 2),
            'utf8'
          );

          const result = runInstaller(['typescript'], {
            overrideDir: claudeBase,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome,
              CLAUDE_BASE_DIR: claudeBase
            }
          });
          assertSuccess(result, 'claude install permissions merge');

          const settings = JSON.parse(fs.readFileSync(path.join(claudeBase, 'settings.json'), 'utf8'));
          const allow = settings.permissions.allow;

          assert.strictEqual(allow.filter((e) => e === `Edit(${mdtRoot}/**)`).length, 1, 'Edit entry should not be duplicated');
          assert.ok(allow.includes(`Write(${mdtRoot}/**)`), 'Write entry should be added');
          assert.ok(allow.includes('Bash(npm run *)'), 'pre-existing allow entry should be preserved');
        } finally {
          cleanupTestDir(tmpHome);
        }
      }
    },
    {
      name: 'cursor install copies selected rules skills commands and runtime scripts globally',
      run: () => {
        const tmpHome = createTestDir('mdt-install-cursor-home-');
        const cursorRoot = path.join(tmpHome, '.cursor');

        try {
          const result = runInstaller(['--target', 'cursor', 'typescript', 'ai-learning'], {
            overrideDir: cursorRoot,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(result, 'cursor install');

          assert.ok(fs.existsSync(path.join(cursorRoot, 'mdt', 'scripts', 'hooks', 'session-start.js')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'mdt', 'scripts', 'mdt.js')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'mdt', 'hardening', 'verify-workspace-permissions.mjs')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'mdt', 'hardening', 'CODEX-WINDOWS-SANDBOX-ROOT-CHILD-ACL-ISSUE.md')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'mdt', 'hardening', 'WORKSPACE-PERMISSIONS-PROMPT.md')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'skills', 'docs-steward', 'SKILL.md')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'skills', 'frontend-slides', 'SKILL.md')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'skills', 'ai-learning', 'SKILL.md')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'commands', 'plan.md')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'commands', 'ai-learning.md')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'commands', 'install-rules.md')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'commands', 'instinct-status.md')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'mdt', 'scripts', 'materialize-mdt-local.js')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'rules', 'typescript-coding-style.mdc')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'rules', 'common-coding-style.mdc')));
          assert.ok(!fs.existsSync(path.join(cursorRoot, 'skills', 'rust-patterns')));
          assert.ok(!fs.existsSync(path.join(cursorRoot, 'rules', 'python-coding-style.mdc')));
        } finally {
          cleanupTestDir(tmpHome);
        }
      }
    },
    {
      name: 'cursor dev install always materializes smoke command and tool smoke script',
      run: () => {
        const tmpHome = createTestDir('mdt-install-cursor-dev-home-');
        const cursorRoot = path.join(tmpHome, '.cursor');

        try {
          const result = runInstaller(['--target', 'cursor', '--dev', 'ai-learning'], {
            overrideDir: cursorRoot,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(result, 'cursor dev install');

          assert.ok(fs.existsSync(path.join(cursorRoot, 'commands', 'mdt-dev-smoke.md')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'mdt', 'scripts', 'mdt-dev-smoke-tool-setups.js')));
          assert.ok(fs.existsSync(path.join(cursorRoot, 'mdt', 'workflow-contracts', 'metadata.json')));
        } finally {
          cleanupTestDir(tmpHome);
        }
      }
    },
    {
      name: 'codex global install copies selected assets and runtime scripts into mdt root',
      run: () => {
        const tmpHome = createTestDir('mdt-install-codex-home-');
        const codexRoot = path.join(tmpHome, '.codex');

        try {
          const result = runInstaller(['--target', 'codex', 'typescript', 'ai-learning'], {
            overrideDir: codexRoot,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(result, 'codex install');

          assert.ok(fs.existsSync(path.join(codexRoot, 'config.toml')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'AGENTS.md')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'rules', 'common-coding-style.md')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'skills', 'coding-standards', 'SKILL.md')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'skills', 'docs-steward', 'SKILL.md')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'skills', 'ai-learning', 'SKILL.md')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'skills', 'ai-learning', 'scripts', 'retrospect-week.js')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'skills', 'ai-learning', 'agents', 'openai.yaml')));
          assert.ok(!fs.existsSync(path.join(codexRoot, 'skills', 'ai-learning', 'hooks')));
          assert.ok(!fs.existsSync(path.join(codexRoot, 'skills', 'python-patterns', 'SKILL.md')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'mdt', 'scripts', 'lib', 'detect-env.js')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'mdt', 'scripts', 'mdt.js')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'mdt', 'scripts', 'ci', 'validate-markdown-links.js')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'mdt', 'scripts', 'ci', 'validate-markdown-path-refs.js')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'mdt', 'hardening', 'verify-workspace-permissions.mjs')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'mdt', 'hardening', 'CODEX-WINDOWS-SANDBOX-ROOT-CHILD-ACL-ISSUE.md')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'mdt', 'hardening', 'WORKSPACE-PERMISSIONS-PROMPT.md')));
        } finally {
          cleanupTestDir(tmpHome);
        }
      }
    },
    {
      name: 'codex dev install always materializes smoke skill and smoke scripts',
      run: () => {
        const tmpHome = createTestDir('mdt-install-codex-dev-home-');
        const codexRoot = path.join(tmpHome, '.codex');

        try {
          const result = runInstaller(['--target', 'codex', '--dev', 'ai-learning'], {
            overrideDir: codexRoot,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(result, 'codex dev install');

          assert.ok(fs.existsSync(path.join(codexRoot, 'skills', 'mdt-dev-smoke', 'SKILL.md')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'skills', 'mdt-dev-verify', 'SKILL.md')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'mdt', 'scripts', 'mdt-dev-smoke-tool-setups.js')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'mdt', 'scripts', 'mdt-dev-smoke-codex-workflows.js')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'mdt', 'workflow-contracts', 'metadata.json')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'mdt', 'workflow-contracts', 'workflows', 'mdt-dev-smoke.json')));
        } finally {
          cleanupTestDir(tmpHome);
        }
      }
    },
    {
      name: 'codex install always includes baseline tdd-workflow skill',
      run: () => {
        const tmpHome = createTestDir('mdt-install-codex-baseline-home-');
        const codexRoot = path.join(tmpHome, '.codex');

        try {
          const result = runInstaller(['--target', 'codex', 'ai-learning'], {
            overrideDir: codexRoot,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(result, 'codex baseline skill install');

          for (const skillName of REPRESENTATIVE_BASELINE_SKILLS) {
            assert.ok(fs.existsSync(path.join(codexRoot, 'skills', skillName, 'SKILL.md')));
          }
        } finally {
          cleanupTestDir(tmpHome);
        }
      }
    },
    {
      name: 'codex reinstall keeps skill frontmatter intact',
      run: () => {
        const tmpHome = createTestDir('mdt-install-codex-reinstall-home-');
        const codexRoot = path.join(tmpHome, '.codex');

        try {
          const first = runInstaller(['--target', 'codex', '--dev', 'typescript', 'ai-learning'], {
            overrideDir: codexRoot,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(first, 'codex first install');

          const second = runInstaller(['--target', 'codex', '--dev', 'typescript', 'ai-learning'], {
            overrideDir: codexRoot,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(second, 'codex second install');

          const skillPath = path.join(codexRoot, 'skills', 'tdd-workflow', 'SKILL.md');
          const skillContent = fs.readFileSync(skillPath, 'utf8');
          assert.ok(skillContent.startsWith('---\n') || skillContent.startsWith('---\r\n'));
          assert.ok(!fs.existsSync(skillPath + '.tmp'));
        } finally {
          cleanupTestDir(tmpHome);
        }
      }
    },
    {
      name: 'codex observer package installs optional observer script into mdt scripts',
      run: () => {
        const tmpHome = createTestDir('mdt-install-codex-observer-home-');
        const codexRoot = path.join(tmpHome, '.codex');

        try {
          const result = runInstaller(['--target', 'codex', 'typescript', 'continuous-learning-observer'], {
            overrideDir: codexRoot,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(result, 'codex observer install');

          assert.ok(fs.existsSync(path.join(codexRoot, 'mdt', 'scripts', 'codex-observer.js')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'skills', 'ai-learning', 'SKILL.md')));
        } finally {
          cleanupTestDir(tmpHome);
        }
      }
    },
    {
      name: 'codex global install preserves existing user config and writes MDT reference config only',
      run: () => {
        const tmpHome = createTestDir('mdt-install-codex-existing-home-');
        const codexRoot = path.join(tmpHome, '.codex');

        try {
          fs.mkdirSync(codexRoot, { recursive: true });
          const existingConfig = [
            "[projects.'\\\\?\\C:\\\\src\\\\github\\\\example']",
            'trust_level = "trusted"',
            '',
            '[windows]',
            'sandbox = "elevated"'
          ].join('\n');
          fs.writeFileSync(path.join(codexRoot, 'config.toml'), existingConfig, 'utf8');

          const result = runInstaller(['--target', 'codex', 'typescript'], {
            overrideDir: codexRoot,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            }
          });
          assertSuccess(result, 'codex install with existing config');

          assert.strictEqual(fs.readFileSync(path.join(codexRoot, 'config.toml'), 'utf8'), existingConfig);
          const referenceConfig = fs.readFileSync(path.join(codexRoot, 'config.mdt.toml'), 'utf8');
          assert.ok(referenceConfig.includes('sandbox_mode = "workspace-write"'));
          assert.ok(!referenceConfig.includes('[mcp_servers.'));
          assert.ok(fs.existsSync(path.join(codexRoot, 'rules', 'common-coding-style.md')));
          assert.ok(fs.existsSync(path.join(codexRoot, 'mdt', 'scripts', 'lib', 'detect-env.js')));
        } finally {
          cleanupTestDir(tmpHome);
        }
      }
    },
    {
      name: 'retired project-dir flag exits with migration guidance',
      run: () => {
        const tmpHome = createTestDir('mdt-install-project-dir-home-');
        const tmpProject = createTestDir('mdt-install-project-dir-proj-');

        try {
          const result = runInstaller(['typescript'], {
            cwd: tmpProject,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome
            },
            overrideDir: null,
            projectDir: tmpProject
          });
          assert.strictEqual(result.status, 1);
          assert.ok(result.stderr.includes('--project-dir is retired'));
          assert.ok(result.stderr.includes('mdt bridge materialize'));
        } finally {
          cleanupTestDir(tmpHome);
          cleanupTestDir(tmpProject);
        }
      }
    },
    {
      name: 'claude install always includes baseline tdd-workflow skill',
      run: () => {
        const tmpHome = createTestDir('mdt-install-claude-baseline-');
        const claudeBase = path.join(tmpHome, '.claude');

        try {
          const result = runInstaller(['ai-learning'], {
            overrideDir: claudeBase,
            env: {
              HOME: tmpHome,
              USERPROFILE: tmpHome,
              CLAUDE_BASE_DIR: claudeBase
            }
          });
          assertSuccess(result, 'claude baseline skill install');

          for (const skillName of REPRESENTATIVE_BASELINE_SKILLS) {
            assert.ok(fs.existsSync(path.join(claudeBase, 'skills', skillName, 'SKILL.md')));
          }
          assert.ok(fs.existsSync(path.join(claudeBase, 'commands', 'ai-learning.md')));
        } finally {
          cleanupTestDir(tmpHome);
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

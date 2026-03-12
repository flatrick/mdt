const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, cleanupTestDir } = require('../helpers/test-runner');
const { createInstalledContinuousLearningLayout } = require('../helpers/continuous-learning-install-layout');

function withEnv(overrides, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function captureCliExit(fn) {
  const originalExit = process.exit;
  const originalLog = console.log;
  const originalError = console.error;
  const output = [];
  let exitCode = null;

  process.exit = (code) => {
    exitCode = code;
    throw new Error('__TEST_EXIT__');
  };
  console.log = (...args) => {
    output.push(args.join(' '));
  };
  console.error = (...args) => {
    output.push(args.join(' '));
  };

  try {
    fn();
  } catch (error) {
    if (error.message !== '__TEST_EXIT__') {
      throw error;
    }
  } finally {
    process.exit = originalExit;
    console.log = originalLog;
    console.error = originalError;
  }

  return {
    exitCode,
    output: output.join('\n')
  };
}

function runTests() {
  console.log('\n=== Testing instinct-cli.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('getCliPaths uses global ~/.codex/mdt storage for Codex workflows', () => {
    const layout = createInstalledContinuousLearningLayout({
      tool: 'codex',
      files: [
        'skills/continuous-learning-manual/scripts/instinct-cli.js',
        'skills/continuous-learning-manual/scripts/detect-project.js'
      ]
    });
    try {
      const cli = withEnv({
        HOME: layout.tempDir,
        USERPROFILE: layout.tempDir,
        CONFIG_DIR: undefined,
        DATA_DIR: undefined,
        CODEX_AGENT: undefined,
        CURSOR_AGENT: undefined
      }, () => require(path.join(layout.skillDir, 'scripts', 'instinct-cli.js')));

      const paths = withEnv({
        HOME: layout.tempDir,
        USERPROFILE: layout.tempDir,
        CONFIG_DIR: undefined,
        DATA_DIR: undefined,
        CODEX_AGENT: undefined,
        CURSOR_AGENT: undefined
      }, () => cli.getCliPaths());

      assert.ok(paths.GLOBAL_PERSONAL.includes(path.join(layout.tempDir, '.codex', 'mdt', 'homunculus')));
      assert.ok(!paths.GLOBAL_PERSONAL.includes(path.join(layout.tempDir, '.cursor', 'mdt', 'homunculus')));
      assert.strictEqual(paths.PROJECTS_DIR, path.join(layout.tempDir, '.codex', 'mdt', 'homunculus'));
    } finally {
      cleanupTestDir(layout.tempDir);
    }
  })) passed++; else failed++;

  if (test('projects command reads project state from homunculus/<project-id> in installed Codex layouts', () => {
    const layout = createInstalledContinuousLearningLayout({
      tool: 'codex',
      files: [
        'skills/continuous-learning-manual/SKILL.md',
        'skills/continuous-learning-manual/config.json',
        'skills/continuous-learning-manual/scripts/instinct-cli.js',
        'skills/continuous-learning-manual/scripts/detect-project.js'
      ]
    });

    try {
      const homunculusDir = path.join(layout.tempDir, '.codex', 'mdt', 'homunculus');
      const projectId = 'demo-git';
      const projectDir = path.join(homunculusDir, projectId);
      fs.mkdirSync(path.join(projectDir, 'instincts', 'personal'), { recursive: true });
      fs.mkdirSync(path.join(projectDir, 'instincts', 'inherited'), { recursive: true });
      fs.mkdirSync(path.join(homunculusDir, 'instincts', 'personal'), { recursive: true });
      fs.mkdirSync(path.join(homunculusDir, 'instincts', 'inherited'), { recursive: true });
      fs.writeFileSync(
        path.join(homunculusDir, 'projects.json'),
        JSON.stringify({
          [projectId]: {
            name: 'demo',
            root: path.join(layout.tempDir, 'workspace', 'demo'),
            remote: 'https://example.com/demo.git',
            last_seen: '2026-03-12T10:00:00Z'
          }
        }, null, 2),
        'utf8'
      );
      fs.writeFileSync(
        path.join(projectDir, 'instincts', 'personal', 'prefer-tests.md'),
        [
          '---',
          'id: prefer-tests',
          'trigger: when fixing bugs',
          'confidence: 0.8',
          'domain: testing',
          'scope: project',
          '',
          '---',
          '',
          '# Prefer Tests'
        ].join('\n'),
        'utf8'
      );
      fs.writeFileSync(
        path.join(projectDir, 'observations.jsonl'),
        `${JSON.stringify({ timestamp: '2026-03-12T09:00:00Z', event: 'session_summary' })}\n`,
        'utf8'
      );

      const detectProjectModule = require(path.join(layout.skillDir, 'scripts', 'detect-project.js'));
      const { createInstinctCliRuntime } = require(path.join(
        layout.mdtRoot,
        'scripts',
        'lib',
        'continuous-learning',
        'instinct-cli-runtime.js'
      ));
      const runtime = createInstinctCliRuntime({
        entrypointDir: path.join(layout.skillDir, 'scripts'),
        skillDir: layout.skillDir,
        detectProject: detectProjectModule.detectProject,
        getHomunculusDir: detectProjectModule.getHomunculusDir,
        inferInstalledConfigDir: detectProjectModule.inferInstalledConfigDir
      });

      const result = withEnv({
        HOME: layout.tempDir,
        USERPROFILE: layout.tempDir,
        CONFIG_DIR: undefined,
        DATA_DIR: undefined,
        CODEX_AGENT: undefined,
        CURSOR_AGENT: undefined,
        CLAUDE_CODE: undefined
      }, () => captureCliExit(() => runtime.main(['projects'])));

      assert.strictEqual(result.exitCode, 0, result.output);
      assert.ok(result.output.includes('demo [demo-git]'), result.output);
      assert.ok(result.output.includes('Instincts: 1 personal, 0 inherited'), result.output);
      assert.ok(result.output.includes('Observations: 1 events'), result.output);
    } finally {
      cleanupTestDir(layout.tempDir);
    }
  })) passed++; else failed++;

  if (test('codex overlay instinct-cli wrapper exports the same public runtime helpers', () => {
    const overlayCli = require(path.join(
      __dirname,
      '..',
      '..',
      'codex-template',
      'skills',
      'continuous-learning-manual',
      'scripts',
      'instinct-cli.js'
    ));

    assert.strictEqual(typeof overlayCli.buildCodexEnv, 'function');
    assert.strictEqual(typeof overlayCli.getCliPaths, 'function');
  })) passed++; else failed++;

  if (test('codex-learn wrappers export buildCodexEnv from the shared runtime', () => {
    const manualCodexLearn = require(path.join(
      __dirname,
      '..',
      '..',
      'skills',
      'continuous-learning-manual',
      'scripts',
      'codex-learn.js'
    ));
    const overlayCodexLearn = require(path.join(
      __dirname,
      '..',
      '..',
      'codex-template',
      'skills',
      'continuous-learning-manual',
      'scripts',
      'codex-learn.js'
    ));

    assert.strictEqual(typeof manualCodexLearn.buildCodexEnv, 'function');
    assert.strictEqual(typeof overlayCodexLearn.buildCodexEnv, 'function');
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

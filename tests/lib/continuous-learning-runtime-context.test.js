'use strict';

const assert = require('assert');
const path = require('path');
const { test, cleanupTestDir } = require('../helpers/test-runner');
const { createInstalledContinuousLearningLayout } = require('../helpers/continuous-learning-install-layout');
const {
  createContinuousLearningContext,
  inferInstalledConfigDir,
  inferToolFromConfigDir,
  resolveContinuousLearningSkillRoot,
  resolveRepoRootFromEntrypoint
} = require('../../scripts/lib/continuous-learning/runtime-context');

function runTests() {
  console.log('\n=== Testing continuous-learning runtime context ===\n');

  let passed = 0;
  let failed = 0;

  if (test('inferInstalledConfigDir finds installed Codex roots from nested skill paths', () => {
    const layout = createInstalledContinuousLearningLayout({
      tool: 'codex',
      files: ['skills/continuous-learning-manual/scripts/detect-project.js']
    });
    try {
      const scriptDir = path.join(layout.skillDir, 'scripts');
      assert.strictEqual(inferInstalledConfigDir(scriptDir), layout.configDir);
    } finally {
      cleanupTestDir(layout.tempDir);
    }
  })) passed++; else failed++;

  if (test('inferToolFromConfigDir maps known tool config roots', () => {
    assert.strictEqual(inferToolFromConfigDir('/tmp/demo/.cursor'), 'cursor');
    assert.strictEqual(inferToolFromConfigDir('/tmp/demo/.claude'), 'claude');
    assert.strictEqual(inferToolFromConfigDir('/tmp/demo/.codex'), 'codex');
    assert.strictEqual(inferToolFromConfigDir('/tmp/demo/.unknown'), 'unknown');
  })) passed++; else failed++;

  if (test('resolveRepoRootFromEntrypoint finds the workspace root for source-tree entrypoints', () => {
    const repoRoot = path.join(__dirname, '..', '..');
    const entrypointDir = path.join(repoRoot, 'skills', 'continuous-learning-manual', 'scripts');
    assert.strictEqual(resolveRepoRootFromEntrypoint(entrypointDir), repoRoot);
  })) passed++; else failed++;

  if (test('createContinuousLearningContext resolves installed skill paths and config ownership', () => {
    const layout = createInstalledContinuousLearningLayout({
      tool: 'codex',
      files: [
        'skills/continuous-learning-manual/SKILL.md',
        'skills/continuous-learning-manual/config.json',
        'skills/continuous-learning-manual/scripts/detect-project.js'
      ]
    });
    try {
      const context = createContinuousLearningContext({
        entrypointDir: path.join(layout.skillDir, 'scripts')
      });

      assert.strictEqual(context.configDir, layout.configDir);
      assert.strictEqual(context.mdtRoot, path.join(layout.configDir, 'mdt'));
      assert.strictEqual(context.skillDir, layout.skillDir);
      assert.strictEqual(context.configPath, path.join(layout.skillDir, 'config.json'));
      assert.strictEqual(context.tool, 'codex');
      assert.strictEqual(context.env.CODEX_AGENT, '1');
    } finally {
      cleanupTestDir(layout.tempDir);
    }
  })) passed++; else failed++;

  if (test('resolveContinuousLearningSkillRoot finds the shared manual skill from repo entrypoints', () => {
    const repoRoot = path.join(__dirname, '..', '..');
    const entrypointDir = path.join(repoRoot, 'scripts');
    assert.strictEqual(
      resolveContinuousLearningSkillRoot({ entrypointDir }),
      path.join(repoRoot, 'skills', 'continuous-learning-manual')
    );
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

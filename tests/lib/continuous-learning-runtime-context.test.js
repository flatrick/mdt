'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
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
      files: ['skills/ai-learning/scripts/detect-project.js']
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
    const entrypointDir = path.join(repoRoot, 'skills', 'ai-learning', 'scripts');
    assert.strictEqual(resolveRepoRootFromEntrypoint(entrypointDir), repoRoot);
  })) passed++; else failed++;

  if (test('resolveRepoRootFromEntrypoint ignores nested AGENTS.md when a stronger repo root exists above', () => {
    const tempDir = createTestDir('runtime-context-root-');
    try {
      const repoRoot = path.join(tempDir, 'repo');
      const nestedDocsDir = path.join(repoRoot, 'docs', 'tools');
      fs.mkdirSync(path.join(repoRoot, 'scripts', 'lib'), { recursive: true });
      fs.mkdirSync(nestedDocsDir, { recursive: true });
      fs.writeFileSync(path.join(repoRoot, 'package.json'), '{}');
      fs.writeFileSync(path.join(repoRoot, 'scripts', 'lib', 'detect-env.js'), 'module.exports = {};');
      fs.writeFileSync(path.join(repoRoot, 'docs', 'AGENTS.md'), '# Local docs guidance\n');

      assert.strictEqual(resolveRepoRootFromEntrypoint(nestedDocsDir), repoRoot);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('createContinuousLearningContext resolves installed skill paths and config ownership', () => {
    const layout = createInstalledContinuousLearningLayout({
      tool: 'codex',
      files: [
        'skills/ai-learning/SKILL.md',
        'skills/ai-learning/config.json',
        'skills/ai-learning/scripts/detect-project.js'
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
      path.join(repoRoot, 'skills', 'ai-learning')
    );
  })) passed++; else failed++;

  if (test('resolveRepoRootFromEntrypoint still supports AGENTS-only roots when no stronger marker exists', () => {
    const tempDir = createTestDir('runtime-context-agents-only-');
    try {
      const repoRoot = path.join(tempDir, 'standalone');
      const nestedDir = path.join(repoRoot, 'skills', 'demo');
      fs.mkdirSync(path.join(repoRoot, 'scripts', 'lib'), { recursive: true });
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(repoRoot, 'AGENTS.md'), '# Standalone project\n');
      fs.writeFileSync(path.join(repoRoot, 'scripts', 'lib', 'detect-env.js'), 'module.exports = {};');

      assert.strictEqual(resolveRepoRootFromEntrypoint(nestedDir), repoRoot);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { createInstalledContinuousLearningLayout } = require('../helpers/continuous-learning-install-layout');
const {
  detectProject,
  findProjectRootFromFilesystem,
  inferInstalledConfigDir
} = require('../../skills/continuous-learning-manual/scripts/detect-project.js');

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

function runTests() {
  console.log('\n=== Testing detect-project.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('inferInstalledConfigDir detects installed Codex config roots', () => {
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

  if (test('findProjectRootFromFilesystem walks up to repo markers without git subprocesses', () => {
    const tempDir = createTestDir('detect-project-root-');
    try {
      const repoRoot = path.join(tempDir, 'repo');
      const nested = path.join(repoRoot, 'src', 'deep');
      fs.mkdirSync(path.join(repoRoot, '.git'), { recursive: true });
      fs.mkdirSync(nested, { recursive: true });
      assert.strictEqual(findProjectRootFromFilesystem(nested), repoRoot);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('detectProject uses MDT_PROJECT_ROOT fallback when git subprocesses are blocked', () => {
    const tempDir = createTestDir('detect-project-mdt-root-');
    try {
      const repoRoot = path.join(tempDir, 'repo');
      fs.mkdirSync(path.join(repoRoot, '.git'), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, '.codex'), { recursive: true });

      const project = withEnv({
        MDT_PROJECT_ROOT: repoRoot,
        CONFIG_DIR: path.join(repoRoot, '.codex'),
        DATA_DIR: path.join(repoRoot, '.codex'),
        CODEX_AGENT: '1',
        CLAUDE_PROJECT_DIR: undefined
      }, () => detectProject(path.join(repoRoot, 'src')));

      assert.notStrictEqual(project.id, 'global');
      assert.strictEqual(project.name, 'repo');
      assert.strictEqual(project.root, repoRoot);
      assert.ok(project.project_dir.includes(path.join(repoRoot, '.codex', 'homunculus')));
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('detectProject returns cwd-scoped project for non-git dirs without explicit env override', () => {
    const tempDir = createTestDir('detect-project-no-git-');
    try {
      const nonGitDir = path.join(tempDir, 'scripts');
      fs.mkdirSync(nonGitDir, { recursive: true });
      const configDir = path.join(tempDir, '.codex');
      fs.mkdirSync(configDir, { recursive: true });

      const project = withEnv({
        CONFIG_DIR: configDir,
        DATA_DIR: configDir,
        CODEX_AGENT: '1',
        MDT_PROJECT_ROOT: undefined,
        CLAUDE_PROJECT_DIR: undefined
      }, () => detectProject(nonGitDir));

      // Non-git dirs get a path-anchored project ID, not global
      assert.notStrictEqual(project.id, 'global');
      assert.ok(/^scripts-[0-9a-f]{8}$/.test(project.id), `expected scripts-<md5> but got: ${project.id}`);
      assert.strictEqual(project.name, 'scripts');
      assert.strictEqual(project.root, nonGitDir);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

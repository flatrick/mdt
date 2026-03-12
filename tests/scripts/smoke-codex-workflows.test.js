const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { smokeCodexWorkflows } = require('../../scripts/smoke-codex-workflows');

function writeFile(rootDir, relativePath, content) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

function createFixtureRoot() {
  const rootDir = createTestDir('codex-workflow-');

  writeFile(
    rootDir,
    'AGENTS.md',
    [
      '# AGENTS',
      '5. **Plan Before Execute** — Plan complex features before writing code',
      '| planner | Implementation planning |',
      '**TDD workflow (mandatory):**'
    ].join('\n')
  );

  writeFile(
    rootDir,
    path.join('codex-template', 'AGENTS.md'),
    [
      '# Codex',
      'Complex features, architecture',
      'tdd-workflow',
      'verification-loop',
      'security-review',
      'e2e-testing',
      'Codex security enforcement in MDT is instruction-based:'
    ].join('\n')
  );

  writeFile(
    rootDir,
    path.join('codex-template', 'config.toml'),
    [
      'approval_policy = "on-request"',
      'sandbox_mode = "workspace-write"'
    ].join('\n')
  );

  writeFile(rootDir, path.join('codex-template', 'skills', 'tdd-workflow', 'SKILL.md'), '# Test-Driven Development Workflow');
  writeFile(rootDir, path.join('codex-template', 'skills', 'coding-standards', 'SKILL.md'), '# Universal coding standards');
  writeFile(rootDir, path.join('codex-template', 'skills', 'verification-loop', 'SKILL.md'), '# Verification Loop Skill');
  writeFile(rootDir, path.join('codex-template', 'skills', 'security-review', 'SKILL.md'), '# Security Review Skill');
  writeFile(rootDir, path.join('codex-template', 'skills', 'e2e-testing', 'SKILL.md'), '# E2E Testing Patterns');
  writeFile(rootDir, path.join('codex-template', 'skills', 'smoke', 'SKILL.md'), '# Smoke');
  writeFile(rootDir, path.join('codex-template', 'skills', 'tool-setup-verifier', 'SKILL.md'), '# Tool Setup Verifier');
  writeFile(rootDir, path.join('docs', 'testing', 'manual-verification', 'codex.md'), '# Codex Manual Verification');

  return rootDir;
}

function createInstalledFixtureRoot() {
  const rootDir = createTestDir('codex-installed-workflow-');
  writeFile(
    rootDir,
    path.join('.codex', 'AGENTS.md'),
    [
      '# Codex',
      'Complex features, architecture',
      'tdd-workflow',
      'verification-loop',
      'security-review'
    ].join('\n')
  );

  writeFile(
    rootDir,
    path.join('.codex', 'config.toml'),
    [
      'approval_policy = "on-request"',
      'sandbox_mode = "workspace-write"'
    ].join('\n')
  );

  writeFile(rootDir, path.join('.codex', 'skills', 'smoke', 'SKILL.md'), '# Smoke');
  writeFile(rootDir, path.join('.codex', 'skills', 'tool-setup-verifier', 'SKILL.md'), '# Tool Setup Verifier');
  writeFile(rootDir, path.join('.codex', 'skills', 'tdd-workflow', 'SKILL.md'), '# Test-Driven Development Workflow');
  writeFile(rootDir, path.join('.codex', 'skills', 'coding-standards', 'SKILL.md'), '# Universal coding standards');
  writeFile(rootDir, path.join('.codex', 'skills', 'verification-loop', 'SKILL.md'), '# Verification Loop Skill');
  writeFile(rootDir, path.join('.codex', 'skills', 'security-review', 'SKILL.md'), '# Security Review Skill');
  writeFile(rootDir, path.join('.codex', 'skills', 'e2e-testing', 'SKILL.md'), '# E2E Testing Patterns');
  writeFile(rootDir, path.join('.codex', 'mdt', 'scripts', 'smoke-tool-setups.js'), '// smoke');
  writeFile(rootDir, path.join('.codex', 'mdt', 'scripts', 'smoke-codex-workflows.js'), '// smoke');

  return path.join(rootDir, '.codex');
}

function createInstalledPreservedConfigFixtureRoot() {
  const rootDir = createTestDir('codex-installed-preserved-config-');
  writeFile(
    rootDir,
    path.join('.codex', 'AGENTS.md'),
    [
      '# Codex',
      'Complex features, architecture',
      'tdd-workflow',
      'verification-loop',
      'security-review'
    ].join('\n')
  );

  writeFile(
    rootDir,
    path.join('.codex', 'config.toml'),
    [
      'model = "gpt-5.4"',
      '[windows]',
      'sandbox = "elevated"'
    ].join('\n')
  );

  writeFile(
    rootDir,
    path.join('.codex', 'config.mdt.toml'),
    [
      'approval_policy = "on-request"',
      'sandbox_mode = "workspace-write"'
    ].join('\n')
  );

  writeFile(rootDir, path.join('.codex', 'skills', 'smoke', 'SKILL.md'), '# Smoke');
  writeFile(rootDir, path.join('.codex', 'skills', 'tool-setup-verifier', 'SKILL.md'), '# Tool Setup Verifier');
  writeFile(rootDir, path.join('.codex', 'skills', 'tdd-workflow', 'SKILL.md'), '# Test-Driven Development Workflow');
  writeFile(rootDir, path.join('.codex', 'skills', 'coding-standards', 'SKILL.md'), '# Universal coding standards');
  writeFile(rootDir, path.join('.codex', 'skills', 'verification-loop', 'SKILL.md'), '# Verification Loop Skill');
  writeFile(rootDir, path.join('.codex', 'skills', 'security-review', 'SKILL.md'), '# Security Review Skill');
  writeFile(rootDir, path.join('.codex', 'skills', 'e2e-testing', 'SKILL.md'), '# E2E Testing Patterns');
  writeFile(rootDir, path.join('.codex', 'mdt', 'scripts', 'smoke-tool-setups.js'), '// smoke');
  writeFile(rootDir, path.join('.codex', 'mdt', 'scripts', 'smoke-codex-workflows.js'), '// smoke');

  return path.join(rootDir, '.codex');
}

function runTests() {
  console.log('\n=== Testing smoke-codex-workflows.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('passes on the real repository', () => {
    const output = [];
    const result = smokeCodexWorkflows({
      io: {
        log: message => output.push(String(message))
      }
    });

    assert.strictEqual(result.exitCode, 0, output.join('\n'));
    assert.ok(output.join('\n').includes('Codex workflow smoke (repo-source mode):'));
    assert.ok(output.join('\n').includes('plan: PASS'));
    assert.ok(output.join('\n').includes('tdd: PASS'));
    assert.ok(output.join('\n').includes('code-review: PASS'));
    assert.ok(output.join('\n').includes('verify: PASS'));
    assert.ok(output.join('\n').includes('smoke: SKIP') || output.join('\n').includes('smoke: PASS'));
  })) passed++; else failed++;

  if (test('fails when the Codex TDD skill is missing', () => {
    const rootDir = createFixtureRoot();

    try {
      fs.rmSync(path.join(rootDir, 'codex-template', 'skills', 'tdd-workflow', 'SKILL.md'));
      const output = [];
      const result = smokeCodexWorkflows({
        rootDir,
        io: {
          log: message => output.push(String(message))
        }
      });

      assert.strictEqual(result.exitCode, 1, 'Expected missing TDD skill to fail');
      assert.ok(output.join('\n').includes('tdd: FAIL'));
      assert.ok(output.join('\n').includes('codex-template/skills/tdd-workflow/SKILL.md'));
    } finally {
      cleanupTestDir(rootDir);
    }
  })) passed++; else failed++;

  if (test('fails when Codex config loses verification sandbox defaults', () => {
    const rootDir = createFixtureRoot();

    try {
      writeFile(
        rootDir,
        path.join('codex-template', 'config.toml'),
        ['approval_policy = "on-request"'].join('\n')
      );

      const output = [];
      const result = smokeCodexWorkflows({
        rootDir,
        io: {
          log: message => output.push(String(message))
        }
      });

      assert.strictEqual(result.exitCode, 1, 'Expected missing verification sandbox defaults to fail');
      assert.ok(output.join('\n').includes('verify: FAIL'));
      assert.ok(output.join('\n').includes('codex-template/config.toml'));
    } finally {
      cleanupTestDir(rootDir);
    }
  })) passed++; else failed++;

  if (test('reports repo-source smoke as SKIP when CLI probes are blocked but contract files exist', () => {
    const rootDir = createFixtureRoot();

    try {
      const output = [];
      const result = smokeCodexWorkflows({
        rootDir,
        io: {
          log: message => output.push(String(message))
        },
        spawnImpl: () => ({
          error: Object.assign(new Error('spawn EPERM'), { code: 'EPERM' })
        })
      });

      assert.strictEqual(result.exitCode, 0, 'Expected blocked CLI probes to produce a non-failing smoke result');
      assert.ok(output.join('\n').includes('smoke: SKIP'));
      assert.ok(output.join('\n').includes('Codex CLI smoke was skipped'));
    } finally {
      cleanupTestDir(rootDir);
    }
  })) passed++; else failed++;

  if (test('fails when repo-source smoke contract files are missing', () => {
    const rootDir = createFixtureRoot();

    try {
      fs.rmSync(path.join(rootDir, 'codex-template', 'skills', 'smoke', 'SKILL.md'));
      const output = [];
      const result = smokeCodexWorkflows({
        rootDir,
        io: {
          log: message => output.push(String(message))
        },
        spawnImpl: () => ({ status: 0, stdout: 'codex-cli 1.0.0' })
      });

      assert.strictEqual(result.exitCode, 1, 'Expected missing smoke contract files to fail');
      assert.ok(output.join('\n').includes('smoke: FAIL'));
      assert.ok(output.join('\n').includes('codex-template/skills/smoke/SKILL.md'));
    } finally {
      cleanupTestDir(rootDir);
    }
  })) passed++; else failed++;

  if (test('passes in installed target repo mode using project .codex only', () => {
    const rootDir = createInstalledFixtureRoot();

    try {
      const output = [];
      const result = smokeCodexWorkflows({
        rootDir,
        io: {
          log: message => output.push(String(message))
        }
      });

      assert.strictEqual(result.exitCode, 0, output.join('\n'));
      assert.ok(output.join('\n').includes('installed-target'));
      assert.ok(output.join('\n').includes('~/.codex/skills/smoke/SKILL.md') || output.join('\n').includes('smoke: PASS'));
      assert.ok(output.join('\n').includes('smoke: PASS'));
      assert.ok(output.join('\n').includes('code-review: PASS'));
      assert.ok(output.join('\n').includes('verify: PASS'));
    } finally {
      cleanupTestDir(rootDir);
    }
  })) passed++; else failed++;

  if (test('passes in installed target mode when the user config is preserved and MDT writes config.mdt.toml', () => {
    const rootDir = createInstalledPreservedConfigFixtureRoot();

    try {
      const output = [];
      const result = smokeCodexWorkflows({
        rootDir,
        io: {
          log: message => output.push(String(message))
        }
      });

      assert.strictEqual(result.exitCode, 0, output.join('\n'));
      assert.ok(output.join('\n').includes('installed-target'));
      assert.ok(output.join('\n').includes('verify: PASS'));
    } finally {
      cleanupTestDir(rootDir);
    }
  })) passed++; else failed++;

  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

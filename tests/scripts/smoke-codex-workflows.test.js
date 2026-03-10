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
      'verification-loop'
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

  writeFile(rootDir, path.join('.agents', 'skills', 'tdd-workflow', 'SKILL.md'), '# Test-Driven Development Workflow');
  writeFile(rootDir, path.join('.agents', 'skills', 'coding-standards', 'SKILL.md'), '# Universal coding standards');
  writeFile(rootDir, path.join('.agents', 'skills', 'verification-loop', 'SKILL.md'), '# Verification Loop Skill');

  return rootDir;
}

function createInstalledFixtureRoot() {
  const rootDir = createTestDir('codex-installed-workflow-');
  const fakeHome = createTestDir('codex-installed-home-');

  writeFile(
    fakeHome,
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
    fakeHome,
    path.join('.codex', 'config.toml'),
    [
      'approval_policy = "on-request"',
      'sandbox_mode = "workspace-write"'
    ].join('\n')
  );

  writeFile(rootDir, path.join('.agents', 'skills', 'tool-setup-verifier', 'SKILL.md'), '# Tool Setup Verifier');
  writeFile(rootDir, path.join('.agents', 'skills', 'tdd-workflow', 'SKILL.md'), '# Test-Driven Development Workflow');
  writeFile(rootDir, path.join('.agents', 'skills', 'coding-standards', 'SKILL.md'), '# Universal coding standards');
  writeFile(rootDir, path.join('.agents', 'skills', 'verification-loop', 'SKILL.md'), '# Verification Loop Skill');
  writeFile(rootDir, path.join('.agents', 'skills', 'security-review', 'SKILL.md'), '# Security Review Skill');
  writeFile(rootDir, path.join('.agents', 'skills', 'e2e-testing', 'SKILL.md'), '# E2E Testing Patterns');
  writeFile(rootDir, path.join('.agents', 'scripts', 'smoke-tool-setups.js'), '// smoke');
  writeFile(rootDir, path.join('.agents', 'scripts', 'smoke-codex-workflows.js'), '// smoke');

  return { rootDir, fakeHome };
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
  })) passed++; else failed++;

  if (test('fails when the Codex TDD skill is missing', () => {
    const rootDir = createFixtureRoot();

    try {
      fs.rmSync(path.join(rootDir, '.agents', 'skills', 'tdd-workflow', 'SKILL.md'));
      const output = [];
      const result = smokeCodexWorkflows({
        rootDir,
        io: {
          log: message => output.push(String(message))
        }
      });

      assert.strictEqual(result.exitCode, 1, 'Expected missing TDD skill to fail');
      assert.ok(output.join('\n').includes('tdd: FAIL'));
      assert.ok(output.join('\n').includes('.agents/skills/tdd-workflow/SKILL.md'));
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

  if (test('passes in installed target repo mode using project .agents and ~/.codex', () => {
    const { rootDir, fakeHome } = createInstalledFixtureRoot();

    try {
      const output = [];
      const result = smokeCodexWorkflows({
        rootDir,
        homeDir: fakeHome,
        io: {
          log: message => output.push(String(message))
        }
      });

      assert.strictEqual(result.exitCode, 0, output.join('\n'));
      assert.ok(output.join('\n').includes('installed-target'));
      assert.ok(output.join('\n').includes('smoke: PASS'));
      assert.ok(output.join('\n').includes('code-review: PASS'));
      assert.ok(output.join('\n').includes('verify: PASS'));
    } finally {
      cleanupTestDir(rootDir);
      cleanupTestDir(fakeHome);
    }
  })) passed++; else failed++;

  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

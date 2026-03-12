const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { smokeClaudeWorkflows } = require('../../scripts/smoke-claude-workflows');

function writeFile(rootDir, relativePath, content) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

function createFixtureRoot() {
  const rootDir = createTestDir('claude-workflow-');

  writeFile(
    rootDir,
    'AGENTS.md',
    [
      '# AGENTS',
      '5. **Plan Before Execute** — Plan complex features before writing code',
      '**TDD workflow (mandatory):**'
    ].join('\n')
  );

  writeFile(rootDir, path.join('commands', 'plan.md'), '# Plan');
  writeFile(rootDir, path.join('agents', 'planner.md'), '# Planner');
  writeFile(rootDir, path.join('commands', 'tdd.md'), '# TDD');
  writeFile(rootDir, path.join('agents', 'tdd-guide.md'), '# TDD Guide');
  writeFile(rootDir, path.join('skills', 'tdd-workflow', 'SKILL.md'), '# Test-Driven Development Workflow');
  writeFile(rootDir, path.join('commands', 'code-review.md'), '# Code Review');
  writeFile(rootDir, path.join('agents', 'code-reviewer.md'), '# Code Reviewer');
  writeFile(rootDir, path.join('commands', 'verify.md'), '# Verify');
  writeFile(rootDir, path.join('skills', 'verification-loop', 'SKILL.md'), '# Verification Loop');
  writeFile(rootDir, path.join('commands', 'smoke.md'), '# Smoke');
  writeFile(rootDir, path.join('docs', 'testing', 'manual-verification', 'claude-code.md'), '# Claude Manual Verification');
  writeFile(rootDir, path.join('claude-template', 'hooks.json'), '{ "hooks": {} }');
  writeFile(rootDir, path.join('agents', 'security-reviewer.md'), '# Security Reviewer');
  writeFile(rootDir, path.join('skills', 'security-review', 'SKILL.md'), '# Security Review');
  writeFile(rootDir, path.join('commands', 'e2e.md'), '# E2E');
  writeFile(rootDir, path.join('agents', 'e2e-runner.md'), '# E2E Runner');
  writeFile(rootDir, path.join('skills', 'e2e-testing', 'SKILL.md'), '# E2E Testing');

  return rootDir;
}

function createInstalledFixtureRoot() {
  const rootDir = createTestDir('claude-installed-workflow-');

  writeFile(rootDir, path.join('.claude', 'commands', 'plan.md'), '# Plan');
  writeFile(rootDir, path.join('.claude', 'agents', 'planner.md'), '# Planner');
  writeFile(rootDir, path.join('.claude', 'commands', 'tdd.md'), '# TDD');
  writeFile(rootDir, path.join('.claude', 'agents', 'tdd-guide.md'), '# TDD Guide');
  writeFile(rootDir, path.join('.claude', 'skills', 'tdd-workflow', 'SKILL.md'), '# Test-Driven Development Workflow');
  writeFile(rootDir, path.join('.claude', 'commands', 'code-review.md'), '# Code Review');
  writeFile(rootDir, path.join('.claude', 'agents', 'code-reviewer.md'), '# Code Reviewer');
  writeFile(rootDir, path.join('.claude', 'commands', 'verify.md'), '# Verify');
  writeFile(rootDir, path.join('.claude', 'skills', 'verification-loop', 'SKILL.md'), '# Verification Loop');
  writeFile(rootDir, path.join('.claude', 'commands', 'smoke.md'), '# Smoke');
  writeFile(rootDir, path.join('.claude', 'settings.json'), '{"hooks":{}}');
  writeFile(rootDir, path.join('.claude', 'mdt', 'scripts', 'smoke-claude-workflows.js'), '// smoke');
  writeFile(rootDir, path.join('.claude', 'agents', 'security-reviewer.md'), '# Security Reviewer');
  writeFile(rootDir, path.join('.claude', 'skills', 'security-review', 'SKILL.md'), '# Security Review');
  writeFile(rootDir, path.join('.claude', 'commands', 'e2e.md'), '# E2E');
  writeFile(rootDir, path.join('.claude', 'agents', 'e2e-runner.md'), '# E2E Runner');
  writeFile(rootDir, path.join('.claude', 'skills', 'e2e-testing', 'SKILL.md'), '# E2E Testing');

  return rootDir;
}

function runTests() {
  console.log('\n=== Testing smoke-claude-workflows.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('passes on the real repository', () => {
    const output = [];
    const result = smokeClaudeWorkflows({
      io: {
        log: message => output.push(String(message))
      }
    });

    assert.strictEqual(result.exitCode, 0, output.join('\n'));
    assert.ok(output.join('\n').includes('Claude workflow smoke (repo-source mode):'));
    assert.ok(output.join('\n').includes('plan: PASS'));
    assert.ok(output.join('\n').includes('tdd: PASS'));
    assert.ok(output.join('\n').includes('code-review: PASS'));
    assert.ok(output.join('\n').includes('verify: PASS'));
    assert.ok(output.join('\n').includes('smoke: SKIP') || output.join('\n').includes('smoke: PASS'));
  })) passed++; else failed++;

  if (test('reports repo-source smoke as SKIP when CLI probes are blocked but contract files exist', () => {
    const rootDir = createFixtureRoot();

    try {
      const output = [];
      const result = smokeClaudeWorkflows({
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
      assert.ok(output.join('\n').includes('Claude CLI smoke was skipped'));
    } finally {
      cleanupTestDir(rootDir);
    }
  })) passed++; else failed++;

  if (test('fails when repo-source smoke contract files are missing', () => {
    const rootDir = createFixtureRoot();

    try {
      fs.rmSync(path.join(rootDir, 'commands', 'smoke.md'));
      const output = [];
      const result = smokeClaudeWorkflows({
        rootDir,
        io: {
          log: message => output.push(String(message))
        },
        spawnImpl: () => ({ status: 0, stdout: '2.1.71' })
      });

      assert.strictEqual(result.exitCode, 1, 'Expected missing smoke contract files to fail');
      assert.ok(output.join('\n').includes('smoke: FAIL'));
      assert.ok(output.join('\n').includes('commands/smoke.md'));
    } finally {
      cleanupTestDir(rootDir);
    }
  })) passed++; else failed++;

  if (test('fails when the Claude planner agent is missing', () => {
    const rootDir = createFixtureRoot();

    try {
      fs.rmSync(path.join(rootDir, 'agents', 'planner.md'));
      const output = [];
      const result = smokeClaudeWorkflows({
        rootDir,
        io: {
          log: message => output.push(String(message))
        },
        spawnImpl: () => ({ status: 0, stdout: '2.1.71' })
      });

      assert.strictEqual(result.exitCode, 1, 'Expected missing plan artifact to fail');
      assert.ok(output.join('\n').includes('plan: FAIL'));
      assert.ok(output.join('\n').includes('agents/planner.md'));
    } finally {
      cleanupTestDir(rootDir);
    }
  })) passed++; else failed++;

  if (test('passes in installed target repo mode using .claude materialized content', () => {
    const rootDir = createInstalledFixtureRoot();

    try {
      const output = [];
      const result = smokeClaudeWorkflows({
        rootDir,
        io: {
          log: message => output.push(String(message))
        },
        spawnImpl: () => ({ status: 0, stdout: '2.1.71' })
      });

      assert.strictEqual(result.exitCode, 0, output.join('\n'));
      assert.ok(output.join('\n').includes('installed-target'));
      assert.ok(output.join('\n').includes('smoke: PASS'));
      assert.ok(output.join('\n').includes('verify: PASS'));
      assert.ok(output.join('\n').includes('e2e: PASS'));
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

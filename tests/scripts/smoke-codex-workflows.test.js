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
      'instructions = """',
      'Test-Driven Development (TDD)',
      '"""',
      'sandbox_mode = "workspace-write"',
      '[mcp_servers.github]',
      '[mcp_servers.sequential-thinking]'
    ].join('\n')
  );

  writeFile(rootDir, path.join('.agents', 'skills', 'tdd-workflow', 'SKILL.md'), '# Test-Driven Development Workflow');
  writeFile(rootDir, path.join('.agents', 'skills', 'verification-loop', 'SKILL.md'), '# Verification Loop Skill');

  return rootDir;
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
    assert.ok(output.join('\n').includes('Codex workflow smoke:'));
    assert.ok(output.join('\n').includes('plan: PASS'));
    assert.ok(output.join('\n').includes('tdd: PASS'));
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

  if (test('fails when Codex config loses verification scaffolding', () => {
    const rootDir = createFixtureRoot();

    try {
      writeFile(
        rootDir,
        path.join('codex-template', 'config.toml'),
        ['instructions = """', 'Test-Driven Development (TDD)', '"""'].join('\n')
      );

      const output = [];
      const result = smokeCodexWorkflows({
        rootDir,
        io: {
          log: message => output.push(String(message))
        }
      });

      assert.strictEqual(result.exitCode, 1, 'Expected missing verification scaffolding to fail');
      assert.ok(output.join('\n').includes('verify: FAIL'));
      assert.ok(output.join('\n').includes('codex-template/config.toml'));
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

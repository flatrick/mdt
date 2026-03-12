const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { evaluateToolSetups } = require('../../scripts/verify-tool-setups');
const { TOOL_WORKFLOW_CONTRACT, WORKFLOW_CONTRACT_ROOT } = require('../../scripts/lib/tool-workflow-contract');

function copyFileIntoFixture(rootDir, relativePath) {
  const sourcePath = path.join(__dirname, '..', '..', relativePath);
  const destinationPath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

function createFixtureRoot() {
  const rootDir = createTestDir('tool-setups-');
  copyFileIntoFixture(rootDir, path.join('docs', 'tools', 'workflow-matrix.md'));
  copyFileIntoFixture(rootDir, path.join('workflow-contracts', 'metadata.json'));

  for (const workflowFile of fs.readdirSync(path.join(WORKFLOW_CONTRACT_ROOT, 'workflows'))) {
    copyFileIntoFixture(rootDir, path.join('workflow-contracts', 'workflows', workflowFile));
  }

  for (const workflow of TOOL_WORKFLOW_CONTRACT.workflows) {
    for (const toolConfig of Object.values(workflow.tools)) {
      for (const relativeFile of toolConfig.requiredFiles) {
        const destinationPath = path.join(rootDir, relativeFile);
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.writeFileSync(destinationPath, '// fixture');
      }
    }
  }

  return rootDir;
}

function runTests() {
  console.log('\n=== Testing verify-tool-setups.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('passes on the real repository', () => {
    const output = [];
    const result = evaluateToolSetups({
      io: {
        log: message => output.push(String(message)),
        error: message => output.push(String(message))
      }
    });

    assert.strictEqual(result.exitCode, 0, output.join('\n'));
    assert.ok(output.join('\n').includes('Verified'), 'Expected verification summary');
  })) passed++; else failed++;

  if (test('fails when the workflow matrix is missing a workflow row', () => {
    const rootDir = createFixtureRoot();

    try {
      const matrixPath = path.join(rootDir, 'docs', 'tools', 'workflow-matrix.md');
      const content = fs.readFileSync(matrixPath, 'utf8').replace('| `verify` |', '| `omitted` |');
      fs.writeFileSync(matrixPath, content);

      const errors = [];
      const result = evaluateToolSetups({
        rootDir,
        io: {
          log: () => {},
          error: message => errors.push(String(message))
        }
      });

      assert.strictEqual(result.exitCode, 1, 'Expected workflow matrix drift to fail');
      assert.ok(errors.join('\n').includes('`verify` row'), 'Expected missing workflow row error');
    } finally {
      cleanupTestDir(rootDir);
    }
  })) passed++; else failed++;

  if (test('fails when a required workflow file is missing', () => {
    const rootDir = createFixtureRoot();

    try {
      fs.rmSync(path.join(rootDir, 'codex-template', 'skills', 'verification-loop', 'SKILL.md'));

      const errors = [];
      const result = evaluateToolSetups({
        rootDir,
        io: {
          log: () => {},
          error: message => errors.push(String(message))
        }
      });

      assert.strictEqual(result.exitCode, 1, 'Expected missing required file to fail');
      assert.ok(errors.join('\n').includes('codex-template/skills/verification-loop/SKILL.md'), 'Expected missing file path in error output');
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

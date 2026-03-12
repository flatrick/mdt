const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const {
  TOOL_ORDER,
  TOOL_WORKFLOW_CONTRACT,
  WORKFLOW_CONTRACT_ROOT,
  loadWorkflowContract
} = require('../../scripts/lib/tool-workflow-contract');

function copyContractTree(rootDir) {
  const contractTarget = path.join(rootDir, 'workflow-contracts');
  fs.mkdirSync(path.join(contractTarget, 'workflows'), { recursive: true });
  fs.copyFileSync(
    path.join(WORKFLOW_CONTRACT_ROOT, 'metadata.json'),
    path.join(contractTarget, 'metadata.json')
  );

  for (const fileName of fs.readdirSync(path.join(WORKFLOW_CONTRACT_ROOT, 'workflows'))) {
    fs.copyFileSync(
      path.join(WORKFLOW_CONTRACT_ROOT, 'workflows', fileName),
      path.join(contractTarget, 'workflows', fileName)
    );
  }

  return contractTarget;
}

function runTests() {
  console.log('\n=== Testing tool-workflow-contract.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('loads workflow contracts from machine-readable files', () => {
    assert.ok(Array.isArray(TOOL_WORKFLOW_CONTRACT.workflows));
    assert.ok(TOOL_WORKFLOW_CONTRACT.workflows.length >= 7);
    assert.deepStrictEqual(TOOL_ORDER, ['claude', 'cursor', 'codex']);

    const smokeWorkflow = TOOL_WORKFLOW_CONTRACT.workflows.find(workflow => workflow.id === 'smoke');
    assert.ok(smokeWorkflow, 'Expected smoke workflow');
    assert.strictEqual(smokeWorkflow.tools.codex.artifactMappings[0].surfaceType, 'skill');
    assert.strictEqual(smokeWorkflow.tools.codex.artifactMappings[0].name, 'smoke');
    assert.ok(smokeWorkflow.tools.codex.requiredFiles.includes('codex-template/skills/smoke/SKILL.md'));
  })) passed++; else failed++;

  if (test('supports reloading the workflow contract from a copied fixture tree', () => {
    const rootDir = createTestDir('workflow-contract-');

    try {
      const contractRoot = copyContractTree(rootDir);
      const loaded = loadWorkflowContract(contractRoot);
      assert.strictEqual(loaded.workflows.length, TOOL_WORKFLOW_CONTRACT.workflows.length);
      assert.deepStrictEqual(loaded.smokeProbes.codex, TOOL_WORKFLOW_CONTRACT.smokeProbes.codex);
    } finally {
      cleanupTestDir(rootDir);
    }
  })) passed++; else failed++;

  if (test('preserves shared workflow outcomes while allowing tool-specific surface names', () => {
    const verifyWorkflow = TOOL_WORKFLOW_CONTRACT.workflows.find(workflow => workflow.id === 'verify');
    assert.ok(verifyWorkflow.outcome.includes('safe to ship'));
    assert.ok(verifyWorkflow.tools.claude.artifactMappings.some(mapping => mapping.surfaceType === 'command'));
    assert.ok(verifyWorkflow.tools.cursor.artifactMappings.some(mapping => mapping.surfaceType === 'rule'));
    assert.ok(verifyWorkflow.tools.codex.artifactMappings.some(mapping => mapping.surfaceType === 'skill'));
  })) passed++; else failed++;

  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

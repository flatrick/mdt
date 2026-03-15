/**
 * Unit tests for scripts/ci/validate-support-maps.js
 */

const assert = require('assert');
const { test } = require('../helpers/test-runner');
const {
  validateSupportMaps,
  parseCapabilityMatrix
} = require('../../scripts/ci/validate-support-maps');

function runTests() {
  console.log('\n=== Testing validate-support-maps.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('parseCapabilityMatrix extracts statuses from matrix table rows', () => {
    const sample = `
| MDT Feature Family                        | Claude Code | Cursor | Codex |
| ----------------------------------------- | ----------- | ------ | ----- |
| Rules / reusable guidance                 | \`official\`  | \`official\` | \`official\` |
| Event automations / hooks                 | \`official\`  | \`experimental\` | \`unsupported\` |
| MCP / tool integration                    | \`official\`  | \`official\` | \`official\` |
`;
    const result = parseCapabilityMatrix(sample);
    assert.ok(result.rule, 'rule should exist');
    assert.strictEqual(result.rule.claude, 'official');
    assert.strictEqual(result.rule.cursor, 'official');
    assert.strictEqual(result.rule.codex, 'official');
    assert.strictEqual(result.hooks.claude, 'official');
    assert.strictEqual(result.hooks.cursor, 'experimental');
    assert.strictEqual(result.hooks.codex, 'unsupported');
    assert.strictEqual(result.mcp.claude, 'official');
  })) passed++; else failed++;

  if (test('validateSupportMaps returns exitCode 0 when metadata/tools exists and matches matrix', () => {
    const io = { log: () => {}, error: () => {} };
    const result = validateSupportMaps(io);
    assert.strictEqual(result.exitCode, 0, 'should pass when maps match matrix');
    assert.ok(!result.warning, 'should not be a warning when maps exist');
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

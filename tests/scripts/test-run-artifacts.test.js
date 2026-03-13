const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseJsonLines } = require('../../scripts/lib/runtime-utils');
const {
  createJsonlLogger,
  createPipelineLogger,
  formatRunId,
  sanitizeArtifactName,
  toRelativeArtifactPath
} = require('../../scripts/lib/test-run-artifacts');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');

function runTests() {
  console.log('\n=== Testing test-run-artifacts.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('formatRunId uses sortable YYYYMMDD.HHmmss format', () => {
    const runId = formatRunId(new Date(2026, 2, 13, 21, 10, 0));
    assert.strictEqual(runId, '20260313.211000');
  })) passed++; else failed++;

  if (test('sanitizeArtifactName flattens suite paths into dot-separated artifact names', () => {
    assert.strictEqual(
      sanitizeArtifactName('compatibility-testing/live-tool-smoke.test.js'),
      'compatibility-testing.live-tool-smoke.test.js'
    );
  })) passed++; else failed++;

  if (test('createJsonlLogger writes parseable rows and strips ANSI escape codes from output', () => {
    const tempDir = createTestDir('test-run-artifacts-');
    try {
      const logFile = path.join(tempDir, 'artifact.jsonl');
      const logger = createJsonlLogger({ filePath: logFile, runId: '20260313.211000' });

      logger.write({
        kind: 'step',
        event: 'start',
        status: 'running',
        step: 'demo',
        message: 'step started'
      });
      logger.writeOutput('stdout', '\u001b[31mcolored output\u001b[0m\nplain output', {
        step: 'demo',
        path: 'scripts/demo.js'
      });

      const parsed = parseJsonLines(fs.readFileSync(logFile, 'utf8'));
      assert.strictEqual(parsed.ok, true);
      assert.strictEqual(parsed.data.entries.length, 3);
      assert.strictEqual(parsed.data.entries[0].seq, 1);
      assert.strictEqual(parsed.data.entries[1].text, 'colored output');
      assert.strictEqual(parsed.data.entries[2].text, 'plain output');
      assert.ok(!Object.prototype.hasOwnProperty.call(parsed.data.entries[0], 'suite'));
      assert.ok(!Object.prototype.hasOwnProperty.call(parsed.data.entries[1], 'status'));
      assert.strictEqual(parsed.data.entries[1].level, 'info');
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('toRelativeArtifactPath returns file-relative artifact references', () => {
    const fromFile = path.join('C:', 'repo', '.artifacts', 'logs', 'test-runs', '20260313.211000', 'npm-test.jsonl');
    const targetFile = path.join('C:', 'repo', '.artifacts', 'logs', 'test-runs', '20260313.211000', 'verify-tool-setups.jsonl');
    assert.strictEqual(
      toRelativeArtifactPath(fromFile, targetFile),
      'verify-tool-setups.jsonl'
    );
  })) passed++; else failed++;

  if (test('createJsonlLogger normalizes path fields to forward slashes', () => {
    const tempDir = createTestDir('test-run-artifacts-');
    try {
      const logFile = path.join(tempDir, 'artifact.jsonl');
      const logger = createJsonlLogger({ filePath: logFile, runId: '20260313.211000' });
      logger.write({
        kind: 'suite',
        event: 'finish',
        status: 'fail',
        suite: 'hooks\\hooks.test.js',
        path: 'tests\\hooks\\hooks.test.js',
        data: {
          log_file: 'hooks\\hooks.test.js.jsonl'
        }
      });
      const parsed = parseJsonLines(fs.readFileSync(logFile, 'utf8'));
      assert.strictEqual(parsed.data.entries[0].suite, 'hooks/hooks.test.js');
      assert.strictEqual(parsed.data.entries[0].path, 'tests/hooks/hooks.test.js');
      assert.strictEqual(parsed.data.entries[0].data.log_file, 'hooks/hooks.test.js.jsonl');
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('createPipelineLogger writes pino JSONL, flattens data, and strips nulls', () => {
    const tempDir = createTestDir('test-run-artifacts-');
    try {
      const logFile = path.join(tempDir, 'pipeline.jsonl');
      const logger = createPipelineLogger({ filePath: logFile, runId: '20260313.211000' });

      logger.write({
        kind: 'step',
        event: 'finish',
        status: 'pass',
        step: 'validate-agents',
        path: 'scripts/ci/validate-agents.js',
        message: null,
        duration_ms: 48,
        exit_code: 0,
        data: { log_file: 'validate-agents.jsonl' }
      });
      logger.write({
        kind: 'summary',
        event: 'finish',
        status: 'fail',
        step: 'pipeline',
        duration_ms: 1234,
        exit_code: 1,
        data: { steps: { passed: 1, failed: 1 }, tests: { passed: 10, failed: 2 } }
      });

      const parsed = parseJsonLines(fs.readFileSync(logFile, 'utf8'));
      assert.strictEqual(parsed.ok, true);

      const [step, summary] = parsed.data.entries;

      // Pino fields present
      assert.ok(typeof step.level === 'string', 'Expected level field');
      assert.ok(typeof step.ts === 'string', 'Expected ts field');
      assert.strictEqual(step.run_id, '20260313.211000');

      // data is flattened to top level
      assert.strictEqual(step.log_file, 'validate-agents.jsonl');
      assert.ok(!Object.prototype.hasOwnProperty.call(step, 'data'), 'data should be flattened, not nested');

      // nulls are stripped
      assert.ok(!Object.prototype.hasOwnProperty.call(step, 'message'), 'null message should be omitted');

      // level reflects status: pass→info, fail→error
      assert.strictEqual(step.level, 'info');
      assert.strictEqual(summary.level, 'error');

      // nested objects in data come through flat
      assert.deepStrictEqual(summary.steps, { passed: 1, failed: 1 });
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('createPipelineLogger writeOutput uses warn for stderr', () => {
    const tempDir = createTestDir('test-run-artifacts-');
    try {
      const logFile = path.join(tempDir, 'pipeline.jsonl');
      const logger = createPipelineLogger({ filePath: logFile, runId: '20260313.211000' });

      logger.writeOutput('stderr', 'WARN: something advisory\nERROR: something broken', { step: 'validate' });

      const parsed = parseJsonLines(fs.readFileSync(logFile, 'utf8'));
      assert.strictEqual(parsed.ok, true);
      assert.strictEqual(parsed.data.entries.length, 2);
      assert.strictEqual(parsed.data.entries[0].level, 'warn');
      assert.strictEqual(parsed.data.entries[1].level, 'warn');
      assert.strictEqual(parsed.data.entries[0].text, 'WARN: something advisory');
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

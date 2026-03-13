const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseJsonLines } = require('../../scripts/lib/runtime-utils');
const { runTestPipeline } = require('../../scripts/ci/run-test-pipeline');
const { SCRIPT_STEPS } = require('../../scripts/ci/run-test-pipeline');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');

function runTests() {
  console.log('\n=== Testing run-test-pipeline.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('runTestPipeline writes a rollup JSONL log and only prints failing steps in quiet mode', () => {
    const tempDir = createTestDir('test-pipeline-');
    try {
      const output = [];
      const result = runTestPipeline({
        parsedArgs: {
          verbose: false,
          quiet: true,
          testsOnly: false,
          profile: 'neutral',
          logRoot: tempDir
        },
        io: {
          log: (message) => output.push(String(message)),
          error: (message) => output.push(String(message))
        },
        runId: '20260313.211000',
        runDependencyStepImpl: () => ({
          name: 'check-dependencies',
          status: 'pass',
          logFile: path.join(tempDir, '20260313.211000', 'check-dependencies.jsonl'),
          message: 'dependency preflight passed',
          exitCode: 0,
          durationMs: 5
        }),
        runScriptStepImpl: (step) => ({
          name: step.name,
          status: step.name === SCRIPT_STEPS[2].name ? 'fail' : 'pass',
          logFile: path.join(tempDir, '20260313.211000', `${step.name}.jsonl`),
          message: step.name === SCRIPT_STEPS[2].name ? 'step exited with status 1' : 'step passed',
          exitCode: step.name === SCRIPT_STEPS[2].name ? 1 : 0,
          durationMs: 5
        }),
        runAllTestsImpl: () => ({
          profile: 'neutral',
          rollupLog: path.join(tempDir, '20260313.211000', 'run-all-neutral.jsonl'),
          durationMs: 42,
          slowestSuites: [{ suite: 'hooks/hooks.test.js', duration_ms: 42, log_file: 'hooks.hooks.test.js.jsonl' }],
          tests: { passed: 12, skipped: 3, failed: 1, total: 16 },
          suites: { passed: 3, skipped: 1, failed: 1, total: 5 },
          suitesByStatus: [],
          exitCode: 1
        })
      });

      assert.strictEqual(result.exitCode, 1);
      assert.ok(output.some((line) => line.includes(`FAIL ${SCRIPT_STEPS[2].name}`)));
      assert.ok(!output.some((line) => line.includes(`PASS ${SCRIPT_STEPS[0].name}`)));
      assert.ok(fs.existsSync(result.rollupLog), 'Expected rollup JSONL log to exist');

      const parsed = parseJsonLines(fs.readFileSync(result.rollupLog, 'utf8'));
      assert.strictEqual(parsed.ok, true);
      assert.ok(parsed.data.entries.some((entry) => entry.kind === 'step' && entry.step === SCRIPT_STEPS[2].name && entry.status === 'fail'));
      assert.ok(parsed.data.entries.some((entry) => entry.kind === 'summary' && entry.step === 'pipeline' && entry.status === 'fail'));
      assert.ok(
        parsed.data.entries.some((entry) => entry.log_file === 'validate-rules.jsonl'),
        'Expected rollup log_file references to be relative to the rollup artifact'
      );
      assert.ok(
        parsed.data.entries.some((entry) => entry.kind === 'summary' && entry.step === 'tests' && typeof entry.duration_ms === 'number'),
        'Expected test summary duration in the rollup'
      );
      assert.ok(
        parsed.data.entries.some((entry) => entry.kind === 'summary' && entry.step === 'tests' && Array.isArray(entry.slowest_suites)),
        'Expected slowest_suites in the test summary'
      );
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('runTestPipeline supports tests-only mode with profile-specific rollup naming', () => {
    const tempDir = createTestDir('test-pipeline-');
    try {
      const result = runTestPipeline({
        parsedArgs: {
          verbose: false,
          quiet: true,
          testsOnly: true,
          profile: 'codex',
          logRoot: tempDir
        },
        io: { log: () => {}, error: () => {} },
        runId: '20260313.211500',
        runAllTestsImpl: () => ({
          profile: 'codex',
          rollupLog: path.join(tempDir, '20260313.211500', 'run-all-codex.jsonl'),
          durationMs: 12,
          slowestSuites: [],
          tests: { passed: 5, skipped: 1, failed: 0, total: 6 },
          suites: { passed: 2, skipped: 1, failed: 0, total: 3 },
          suitesByStatus: [],
          exitCode: 0
        })
      });

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.rollupLog.endsWith(path.join('20260313.211500', 'tests-codex.jsonl')));
      assert.strictEqual(result.steps.passed, 0);
      assert.strictEqual(result.tests.skipped, 1);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

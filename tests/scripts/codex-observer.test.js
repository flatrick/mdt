/**
 * Tests for the optional Codex external observer workflow.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { test, asyncTest, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const {
  buildCodexObserverEnv,
  getObservationSnapshot,
  hasObservationChange,
  maybeAnalyzeProject
} = require('../../scripts/codex-observer.js');

async function runTests() {
  console.log('\n=== Testing codex-observer.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('buildCodexObserverEnv defaults to global ~/.codex/mdt directories', () => {
    const testCwd = path.resolve(path.sep, 'tmp', 'demo-project');
    const env = buildCodexObserverEnv({ HOME: path.resolve(path.sep, 'tmp', 'home') }, { cwd: testCwd });
    assert.strictEqual(env.CODEX_AGENT, '1');
    assert.strictEqual(env.MDT_OBSERVER_TOOL, 'codex');
    assert.strictEqual(env.CONFIG_DIR, path.join(path.resolve(path.sep, 'tmp', 'home'), '.codex'));
    assert.strictEqual(env.DATA_DIR, path.join(path.resolve(path.sep, 'tmp', 'home'), '.codex', 'mdt'));
    assert.strictEqual(env.MDT_PROJECT_ROOT, testCwd);
  })) passed++; else failed++;

  if (test('getObservationSnapshot reports current file metadata and line count', () => {
    const tempDir = createTestDir('codex-observer-snapshot-');
    try {
      const observationsFile = path.join(tempDir, 'observations.jsonl');
      fs.writeFileSync(observationsFile, '{"event":"tool_complete"}\n{"event":"session_summary"}\n', 'utf8');

      const snapshot = getObservationSnapshot(observationsFile);
      assert.strictEqual(snapshot.exists, true);
      assert.strictEqual(snapshot.lines, 2);
      assert.ok(snapshot.size > 0);
      assert.ok(snapshot.mtimeMs > 0);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('hasObservationChange detects meaningful observation file updates', () => {
    assert.strictEqual(
      hasObservationChange(
        { exists: false, size: 0, mtimeMs: 0, lines: 0 },
        { exists: true, size: 24, mtimeMs: 10, lines: 1 }
      ),
      true
    );
    assert.strictEqual(
      hasObservationChange(
        { exists: true, size: 24, mtimeMs: 10, lines: 1 },
        { exists: true, size: 24, mtimeMs: 10, lines: 1 }
      ),
      false
    );
  })) passed++; else failed++;

  if (await asyncTest('maybeAnalyzeProject skips analysis when observations are below threshold', async () => {
    const tempDir = createTestDir('codex-observer-threshold-');
    try {
      const projectDir = path.join(tempDir, '.codex', 'homunculus', 'projects', 'demo123');
      fs.mkdirSync(projectDir, { recursive: true });
      const observationsFile = path.join(projectDir, 'observations.jsonl');
      fs.writeFileSync(observationsFile, '{"event":"session_summary"}\n', 'utf8');

      let analyzeCalled = false;
      const result = await maybeAnalyzeProject({
        cwd: tempDir,
        config: { min_observations_to_analyze: 2 },
        detectProjectImpl: () => ({
          id: 'demo123',
          name: 'demo-project',
          root: tempDir,
          project_dir: projectDir,
          observations_file: observationsFile
        }),
        analyzeImpl: () => {
          analyzeCalled = true;
          return null;
        }
      });

      assert.strictEqual(result.triggered, false);
      assert.strictEqual(result.reason, 'below-threshold');
      assert.strictEqual(result.observations, 1);
      assert.strictEqual(analyzeCalled, false);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (await asyncTest('maybeAnalyzeProject handles missing observations file gracefully', async () => {
    const tempDir = createTestDir('codex-observer-missing-');
    try {
      const projectDir = path.join(tempDir, '.codex', 'homunculus', 'projects', 'demo-missing');
      fs.mkdirSync(projectDir, { recursive: true });
      const observationsFile = path.join(projectDir, 'observations.jsonl');

      let analyzeCalled = false;
      const result = await maybeAnalyzeProject({
        cwd: tempDir,
        config: { min_observations_to_analyze: 1 },
        detectProjectImpl: () => ({
          id: 'demo-missing',
          name: 'demo-project-missing',
          root: tempDir,
          project_dir: projectDir,
          observations_file: observationsFile
        }),
        analyzeImpl: () => {
          analyzeCalled = true;
          return null;
        }
      });

      assert.strictEqual(result.triggered, false);
      assert.strictEqual(result.reason, 'no-observations');
      assert.strictEqual(result.observations, 0);
      assert.strictEqual(analyzeCalled, false);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (await asyncTest('maybeAnalyzeProject runs analysis with Codex-scoped env when threshold is met', async () => {
    const tempDir = createTestDir('codex-observer-run-');
    try {
      const projectDir = path.join(tempDir, '.codex', 'homunculus', 'projects', 'demo123');
      fs.mkdirSync(path.join(projectDir, 'instincts', 'personal'), { recursive: true });
      const observationsFile = path.join(projectDir, 'observations.jsonl');
      fs.writeFileSync(observationsFile, '{"event":"session_summary"}\n{"event":"tool_complete"}\n', 'utf8');

      let analyzeOptions = null;
      const child = new EventEmitter();
      const pending = maybeAnalyzeProject({
        cwd: tempDir,
        config: { min_observations_to_analyze: 2 },
        detectProjectImpl: () => ({
          id: 'demo123',
          name: 'demo-project',
          root: tempDir,
          project_dir: projectDir,
          observations_file: observationsFile
        }),
        analyzeImpl: (options) => {
          analyzeOptions = options;
          return child;
        }
      });

      setTimeout(() => {
        child.emit('close', 0);
      }, 0);

      const result = await pending;
      assert.strictEqual(result.triggered, true);
      assert.strictEqual(result.reason, 'analyzed');
      assert.strictEqual(result.observations, 2);
      assert.ok(analyzeOptions, 'Expected analyzeObservations to be called');
      assert.strictEqual(analyzeOptions.config.tool, 'codex');
      assert.strictEqual(analyzeOptions.env.MDT_OBSERVER_TOOL, 'codex');
      assert.strictEqual(analyzeOptions.env.CLV2_PROJECT_DIR, projectDir);
      assert.strictEqual(analyzeOptions.env.CLV2_OBSERVATIONS_FILE, observationsFile);
      assert.strictEqual(analyzeOptions.env.CLV2_MIN_OBSERVATIONS, '2');
      assert.strictEqual(
        analyzeOptions.env.CLV2_INSTINCTS_DIR,
        path.join(projectDir, 'instincts', 'personal')
      );
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

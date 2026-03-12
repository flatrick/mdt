'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const {
  cleanupStaleManagedProcessState,
  evaluateManagedProcessLease,
  parseManagedProcessState,
  readManagedProcessState,
  stopManagedProcess,
  writeManagedProcessState
} = require('../../scripts/lib/detached-process-lifecycle');

function runTests() {
  console.log('\n=== Testing detached-process lifecycle helper ===\n');

  let passed = 0;
  let failed = 0;

  if (test('parseManagedProcessState supports legacy plain PID files', () => {
    const state = parseManagedProcessState('12345\n');
    assert.strictEqual(state.pid, 12345);
    assert.strictEqual(state.instanceId, null);
    assert.strictEqual(state.format, 'legacy');
  })) passed++; else failed++;

  if (test('writeManagedProcessState persists JSON state atomically', () => {
    const tempDir = createTestDir('managed-state-write-');
    try {
      const stateFile = path.join(tempDir, '.observer.pid');
      const written = writeManagedProcessState(stateFile, {
        pid: 4321,
        instanceId: 'instance-1',
        cwd: tempDir,
        entrypoint: 'agents/start-observer.js'
      });

      assert.strictEqual(written.pid, 4321);
      assert.strictEqual(written.instanceId, 'instance-1');
      const onDisk = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      assert.strictEqual(onDisk.pid, 4321);
      assert.strictEqual(onDisk.instanceId, 'instance-1');
      assert.strictEqual(onDisk.cwd, tempDir);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('readManagedProcessState reads JSON lease files', () => {
    const tempDir = createTestDir('managed-state-read-');
    try {
      const stateFile = path.join(tempDir, '.observer.pid');
      fs.writeFileSync(stateFile, JSON.stringify({
        pid: 6789,
        instanceId: 'instance-2',
        startedAt: '2026-03-12T00:00:00.000Z',
        cwd: tempDir,
        entrypoint: 'agents/start-observer.js'
      }), 'utf8');

      const state = readManagedProcessState(stateFile);
      assert.strictEqual(state.pid, 6789);
      assert.strictEqual(state.instanceId, 'instance-2');
      assert.strictEqual(state.format, 'json');
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('evaluateManagedProcessLease detects missing lease', () => {
    const result = evaluateManagedProcessLease({
      state: null,
      pid: 100,
      instanceId: 'missing'
    });
    assert.strictEqual(result.shouldExit, true);
    assert.strictEqual(result.reason, 'lease-missing');
  })) passed++; else failed++;

  if (test('evaluateManagedProcessLease detects PID and instance mismatches', () => {
    const pidMismatch = evaluateManagedProcessLease({
      state: { pid: 100, instanceId: 'instance-a' },
      pid: 101,
      instanceId: 'instance-a'
    });
    assert.strictEqual(pidMismatch.reason, 'lease-pid-mismatch');

    const instanceMismatch = evaluateManagedProcessLease({
      state: { pid: 100, instanceId: 'instance-a' },
      pid: 100,
      instanceId: 'instance-b'
    });
    assert.strictEqual(instanceMismatch.reason, 'lease-instance-mismatch');
  })) passed++; else failed++;

  if (test('cleanupStaleManagedProcessState removes dead-process leases', () => {
    const tempDir = createTestDir('managed-state-cleanup-');
    try {
      const stateFile = path.join(tempDir, '.observer.pid');
      fs.writeFileSync(stateFile, '2345', 'utf8');
      const result = cleanupStaleManagedProcessState(stateFile, {
        isPidAliveImpl: () => false
      });
      assert.strictEqual(result.removed, true);
      assert.strictEqual(result.reason, 'stale');
      assert.strictEqual(fs.existsSync(stateFile), false);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('stopManagedProcess removes lease and signals live process', () => {
    const tempDir = createTestDir('managed-state-stop-');
    try {
      const stateFile = path.join(tempDir, '.observer.pid');
      writeManagedProcessState(stateFile, {
        pid: 3456,
        instanceId: 'instance-stop'
      });

      let killArgs = null;
      const result = stopManagedProcess(stateFile, {
        isPidAliveImpl: () => true,
        killImpl: (pid, signal) => {
          killArgs = { pid, signal };
        }
      });

      assert.strictEqual(result.stopped, true);
      assert.deepStrictEqual(killArgs, { pid: 3456, signal: 'SIGTERM' });
      assert.strictEqual(fs.existsSync(stateFile), false);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

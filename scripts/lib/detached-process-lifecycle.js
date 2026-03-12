'use strict';

const fs = require('fs');
const path = require('path');

function isFinitePid(pid) {
  return Number.isInteger(pid) && pid > 0;
}

function normalizeManagedProcessState(rawState) {
  if (!rawState || typeof rawState !== 'object') {
    return null;
  }

  const pid = parseInt(String(rawState.pid || ''), 10);
  if (!isFinitePid(pid)) {
    return null;
  }

  return {
    pid,
    instanceId: rawState.instanceId ? String(rawState.instanceId) : null,
    startedAt: rawState.startedAt ? String(rawState.startedAt) : null,
    cwd: rawState.cwd ? String(rawState.cwd) : null,
    entrypoint: rawState.entrypoint ? String(rawState.entrypoint) : null
  };
}

function parseManagedProcessState(content) {
  const raw = String(content || '').trim();
  if (!raw) {
    return null;
  }

  if (/^\d+$/.test(raw)) {
    return {
      pid: parseInt(raw, 10),
      instanceId: null,
      startedAt: null,
      cwd: null,
      entrypoint: null,
      format: 'legacy'
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeManagedProcessState(parsed);
    return normalized ? { ...normalized, format: 'json' } : null;
  } catch {
    return null;
  }
}

function readManagedProcessState(stateFilePath, options = {}) {
  const fsImpl = options.fsImpl || fs;
  if (!stateFilePath || !fsImpl.existsSync(stateFilePath)) {
    return null;
  }

  const raw = fsImpl.readFileSync(stateFilePath, 'utf8');
  return parseManagedProcessState(raw);
}

function writeManagedProcessState(stateFilePath, state, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const startedAt = state.startedAt || new Date().toISOString();
  const payload = JSON.stringify({
    pid: state.pid,
    instanceId: state.instanceId,
    startedAt,
    cwd: state.cwd || null,
    entrypoint: state.entrypoint || null
  }, null, 2) + '\n';

  fsImpl.mkdirSync(path.dirname(stateFilePath), { recursive: true });
  const tempPath = `${stateFilePath}.${process.pid}.${Date.now()}.tmp`;
  fsImpl.writeFileSync(tempPath, payload, 'utf8');
  fsImpl.renameSync(tempPath, stateFilePath);

  return {
    pid: state.pid,
    instanceId: state.instanceId || null,
    startedAt,
    cwd: state.cwd || null,
    entrypoint: state.entrypoint || null,
    format: 'json'
  };
}

function removeManagedProcessState(stateFilePath, options = {}) {
  const fsImpl = options.fsImpl || fs;
  if (!stateFilePath || !fsImpl.existsSync(stateFilePath)) {
    return false;
  }

  fsImpl.unlinkSync(stateFilePath);
  return true;
}

function evaluateManagedProcessLease(options = {}) {
  const state = options.state !== undefined
    ? options.state
    : readManagedProcessState(options.stateFilePath, options);
  const pid = parseInt(String(options.pid || ''), 10);
  const instanceId = options.instanceId ? String(options.instanceId) : null;

  if (!state) {
    return {
      shouldExit: true,
      reason: 'lease-missing',
      state: null
    };
  }

  if (!isFinitePid(pid)) {
    return {
      shouldExit: true,
      reason: 'invalid-pid',
      state
    };
  }

  if (state.pid !== pid) {
    return {
      shouldExit: true,
      reason: 'lease-pid-mismatch',
      state
    };
  }

  if (state.instanceId && instanceId && state.instanceId !== instanceId) {
    return {
      shouldExit: true,
      reason: 'lease-instance-mismatch',
      state
    };
  }

  return {
    shouldExit: false,
    reason: null,
    state
  };
}

function cleanupStaleManagedProcessState(stateFilePath, options = {}) {
  const state = readManagedProcessState(stateFilePath, options);
  if (!state) {
    return {
      removed: false,
      reason: 'missing',
      state: null
    };
  }

  const isPidAliveImpl = options.isPidAliveImpl;
  if (typeof isPidAliveImpl !== 'function') {
    throw new Error('cleanupStaleManagedProcessState requires isPidAliveImpl');
  }

  if (isPidAliveImpl(state.pid)) {
    return {
      removed: false,
      reason: 'alive',
      state
    };
  }

  removeManagedProcessState(stateFilePath, options);
  return {
    removed: true,
    reason: 'stale',
    state
  };
}

function stopManagedProcess(stateFilePath, options = {}) {
  const state = readManagedProcessState(stateFilePath, options);
  if (!state) {
    return {
      stopped: false,
      reason: 'missing',
      state: null
    };
  }

  const isPidAliveImpl = options.isPidAliveImpl;
  const killImpl = options.killImpl;
  if (typeof isPidAliveImpl !== 'function') {
    throw new Error('stopManagedProcess requires isPidAliveImpl');
  }
  if (typeof killImpl !== 'function') {
    throw new Error('stopManagedProcess requires killImpl');
  }

  const alive = isPidAliveImpl(state.pid);
  if (alive) {
    try {
      killImpl(state.pid, options.signal || 'SIGTERM');
    } catch {
      // Best-effort signal path.
    }
  }

  removeManagedProcessState(stateFilePath, options);

  return {
    stopped: alive,
    reason: alive ? 'signaled' : 'stale',
    state
  };
}

module.exports = {
  cleanupStaleManagedProcessState,
  evaluateManagedProcessLease,
  parseManagedProcessState,
  readManagedProcessState,
  removeManagedProcessState,
  stopManagedProcess,
  writeManagedProcessState
};

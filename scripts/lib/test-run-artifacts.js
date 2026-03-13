'use strict';

const fs = require('fs');
const path = require('path');

function createSuiteLogger({ filePath, runId, suite, path: suitePath } = {}) {
  const pino = require('pino');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '', 'utf8');
  const dest = pino.destination({ dest: filePath, sync: true });
  const base = pino({
    base: { run_id: runId || formatRunId() },
    timestamp: () => `,"ts":"${new Date().toISOString()}"`,
    formatters: {
      level: (label) => ({ level: label })
    }
  }, dest);
  return base.child({
    suite: normalizeLogPath(suite || 'unknown'),
    ...(suitePath ? { path: normalizeLogPath(suitePath) } : {})
  });
}

const DEFAULT_ARTIFACT_ROOT = path.join('.artifacts', 'logs', 'test-runs');
const ANSI_PATTERN = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const OMIT_IF_NULL_FIELDS = [
  'status',
  'step',
  'suite',
  'test',
  'path',
  'stream',
  'level',
  'message',
  'text',
  'passed',
  'skipped',
  'failed',
  'total',
  'duration_ms',
  'exit_code'
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatRunId(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('') + '.' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');
}

function sanitizeArtifactName(name) {
  return String(name || 'unknown')
    .trim()
    .replace(/[\\/]+/g, '.')
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    || 'unknown';
}

function resolveArtifactRoot(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const logRoot = options.logRoot || DEFAULT_ARTIFACT_ROOT;
  return path.resolve(repoRoot, logRoot);
}

function ensureArtifactRoot(options = {}) {
  const artifactRoot = resolveArtifactRoot(options);
  fs.mkdirSync(artifactRoot, { recursive: true });
  return artifactRoot;
}

function buildArtifactPath(options = {}) {
  const artifactRoot = ensureArtifactRoot(options);
  const runId = options.runId || formatRunId();
  const artifactName = sanitizeArtifactName(options.name || 'unknown');
  const runDir = path.join(artifactRoot, runId);
  fs.mkdirSync(runDir, { recursive: true });
  return path.join(runDir, `${artifactName}.jsonl`);
}

function toRelativeArtifactPath(fromFilePath, targetPath) {
  const fromDir = path.dirname(path.resolve(fromFilePath));
  const target = path.resolve(targetPath);
  const relative = path.relative(fromDir, target);
  if (!relative) {
    return '.';
  }
  return relative.split(path.sep).join('/');
}

function normalizeLogPath(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return String(value).split(path.sep).join('/');
}

function stripAnsi(text) {
  return String(text || '').replace(ANSI_PATTERN, '');
}

function splitOutputLines(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');
}

function createPipelineLogger({ filePath, runId } = {}) {
  const pino = require('pino');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '', 'utf8');
  const dest = pino.destination({ dest: filePath, sync: true });
  const base = pino({
    base: { run_id: runId || formatRunId() },
    timestamp: () => `,"ts":"${new Date().toISOString()}"`,
    formatters: {
      level: (label) => ({ level: label })
    }
  }, dest);

  function write(row) {
    const { message, data, ...rest } = row;

    // Flatten data sub-object into top level
    const flat = {
      ...rest,
      ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {})
    };

    // Strip nulls/undefined and normalize path-like fields
    const obj = {};
    for (const [k, v] of Object.entries(flat)) {
      if (v === null || v === undefined) {
        continue;
      }
      obj[k] = typeof v === 'string' && (k === 'path' || k === 'suite' || k.endsWith('_path') || k.endsWith('_file') || k.endsWith('_log'))
        ? normalizeLogPath(v)
        : v;
    }

    const level = obj.status === 'fail' ? 'error' : obj.status === 'skip' ? 'warn' : 'info';
    base[level](obj, message || '');
  }

  function writeOutput(stream, text, context = {}) {
    const { level: ctxLevel, message: _msg, ...ctxRest } = context;
    const level = ctxLevel || (stream === 'stderr' ? 'warn' : 'info');
    for (const line of splitOutputLines(text)) {
      if (!line) {
        continue;
      }
      base[level]({ kind: 'output', event: 'line', stream, ...ctxRest, text: stripAnsi(line) }, '');
    }
  }

  return { filePath, write, writeOutput };
}

function createJsonlLogger(options = {}) {
  const filePath = options.filePath || buildArtifactPath(options);
  const defaults = {
    v: 1,
    run_id: options.runId || formatRunId()
  };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '', 'utf8');

  let seq = 0;

  function write(row) {
    seq += 1;
    const payload = {
      v: defaults.v,
      run_id: defaults.run_id,
      seq,
      ts: new Date().toISOString(),
      kind: null,
      event: null,
      status: null,
      level: null,
      step: null,
      suite: null,
      test: null,
      path: null,
      stream: null,
      message: null,
      text: null,
      passed: null,
      skipped: null,
      failed: null,
      total: null,
      duration_ms: null,
      exit_code: null,
      data: {},
      ...row
    };

    payload.path = normalizeLogPath(payload.path);
    payload.suite = normalizeLogPath(payload.suite);

    if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
      payload.data = {};
    }

    for (const [key, value] of Object.entries(payload.data)) {
      if (typeof value === 'string' && (key.endsWith('_path') || key.endsWith('_file') || key.endsWith('_log'))) {
        payload.data[key] = normalizeLogPath(value);
      }
    }

    for (const field of OMIT_IF_NULL_FIELDS) {
      if (payload[field] === null || payload[field] === undefined) {
        delete payload[field];
      }
    }

    if (payload.data && Object.keys(payload.data).length === 0) {
      delete payload.data;
    }

    fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
    return payload;
  }

  function writeOutput(stream, text, context = {}) {
    const lines = splitOutputLines(text);
    for (const line of lines) {
      if (!line) {
        continue;
      }
      write({
        kind: 'output',
        event: 'line',
        stream,
        level: context.level || (stream === 'stderr' ? 'error' : 'info'),
        text: stripAnsi(line),
        ...context
      });
    }
  }

  return {
    filePath,
    write,
    writeOutput
  };
}

module.exports = {
  DEFAULT_ARTIFACT_ROOT,
  buildArtifactPath,
  createJsonlLogger,
  createPipelineLogger,
  createSuiteLogger,
  ensureArtifactRoot,
  formatRunId,
  resolveArtifactRoot,
  sanitizeArtifactName,
  splitOutputLines,
  stripAnsi,
  toRelativeArtifactPath,
  normalizeLogPath
};

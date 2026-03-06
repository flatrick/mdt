#!/usr/bin/env node
/**
 * Strategic Compact Suggester
 */

const fs = require('fs');
const path = require('path');
const { getTempDir, writeFile, log } = require('../lib/utils');

function getCompactContext(env = process.env) {
  const sessionId = env.CLAUDE_SESSION_ID || 'default';
  const counterFile = path.join(getTempDir(), `claude-tool-count-${sessionId}`);
  const rawThreshold = parseInt(env.COMPACT_THRESHOLD || '50', 10);
  const threshold = Number.isFinite(rawThreshold) && rawThreshold > 0 && rawThreshold <= 10000
    ? rawThreshold
    : 50;
  return { sessionId, counterFile, threshold };
}

function readAndIncrementCounter(counterFile, fileSystem = fs) {
  let count = 1;
  try {
    const fd = fileSystem.openSync(counterFile, 'a+');
    try {
      const buf = Buffer.alloc(64);
      const bytesRead = fileSystem.readSync(fd, buf, 0, 64, 0);
      if (bytesRead > 0) {
        const parsed = parseInt(buf.toString('utf8', 0, bytesRead).trim(), 10);
        count = (Number.isFinite(parsed) && parsed > 0 && parsed <= 1000000) ? parsed + 1 : 1;
      }
      fileSystem.ftruncateSync(fd, 0);
      fileSystem.writeSync(fd, String(count), 0);
    } finally {
      fileSystem.closeSync(fd);
    }
  } catch {
    writeFile(counterFile, String(count));
  }
  return count;
}

function evaluateCompactSuggestion(options = {}) {
  const env = options.env || process.env;
  const logger = options.logger || log;
  const fileSystem = options.fileSystem || fs;
  const { counterFile, threshold } = getCompactContext(env);
  const count = readAndIncrementCounter(counterFile, fileSystem);

  let message = null;
  if (count === threshold) {
    message = `[StrategicCompact] ${threshold} tool calls reached - consider /compact if transitioning phases`;
  } else if (count > threshold && (count - threshold) % 25 === 0) {
    message = `[StrategicCompact] ${count} tool calls - good checkpoint for /compact if context is stale`;
  }

  if (message) {
    logger(message);
  }

  return { count, threshold, counterFile, message };
}

function runCli() {
  try {
    evaluateCompactSuggestion();
    process.exit(0);
  } catch (err) {
    console.error('[StrategicCompact] Error:', err.message);
    process.exit(0);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  getCompactContext,
  readAndIncrementCounter,
  evaluateCompactSuggestion,
  runCli
};

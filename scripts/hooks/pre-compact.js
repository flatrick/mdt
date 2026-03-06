#!/usr/bin/env node
/**
 * PreCompact Hook - Save state before context compaction
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs before Claude compacts context, giving you a chance to
 * preserve important state that might get lost in summarization.
 */

const path = require('path');
const {
  getSessionsDir,
  getDateTimeString,
  getTimeString,
  findFiles,
  ensureDir,
  appendFile,
  readFile,
  writeFile,
  log
} = require('../lib/utils');

const MAX_COMPACTION_LOG_BYTES = 100 * 1024;
const MAX_COMPACTION_LOG_LINES = 1000;

function rotateCompactionLog(logFile) {
  const content = readFile(logFile);
  if (content === null) {
    return;
  }
  if (Buffer.byteLength(content, 'utf8') <= MAX_COMPACTION_LOG_BYTES) {
    return;
  }

  const lines = content.split('\n').filter(Boolean);
  const trimmed = lines.slice(-MAX_COMPACTION_LOG_LINES).join('\n');
  writeFile(logFile, trimmed ? `${trimmed}\n` : '');
}

async function main() {
  const sessionsDir = getSessionsDir();
  const compactionLog = path.join(sessionsDir, 'compaction-log.txt');

  ensureDir(sessionsDir);

  // Log compaction event with timestamp
  const timestamp = getDateTimeString();
  appendFile(compactionLog, `[${timestamp}] Context compaction triggered\n`);
  rotateCompactionLog(compactionLog);

  // If there's an active session file, note the compaction
  const sessions = findFiles(sessionsDir, '*-session.tmp');

  if (sessions.length > 0) {
    const activeSession = sessions[0].path;
    const timeStr = getTimeString();
    appendFile(activeSession, `\n---\n**[Compaction occurred at ${timeStr}]** - Context was summarized\n`);
  }

  log('[PreCompact] State saved before compaction');
  process.exit(0);
}

main().catch(err => {
  console.error('[PreCompact] Error:', err.message);
  process.exit(0);
});

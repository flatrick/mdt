#!/usr/bin/env node
/**
 * Stop Hook (Session End) - Persist learnings when session ends
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs when Claude session ends. Extracts a meaningful summary from
 * the session transcript (via stdin JSON transcript_path) and saves it
 * to a session file for cross-session continuity.
 */

const path = require('path');
const {
  getSessionsDir,
  getDateString,
  getTimeString,
  getSessionIdShort,
  ensureDir,
  readFile,
  readStdinText,
  writeFile,
  replaceInFile,
  log
} = require('../lib/utils');
const {
  safeJsonParse,
  parseJsonLines,
  createPathExistsCache,
  unique
} = require('../lib/runtime-utils');

const isPathExists = createPathExistsCache();

/**
 * Extract a meaningful summary from the session transcript.
 * Reads the JSONL transcript and pulls out key information:
 * - User messages (tasks requested)
 * - Tools used
 * - Files modified
 */
function collectSessionSummary(transcriptPath) {
  const content = readFile(transcriptPath);
  if (!content) return null;

  const parsed = parseJsonLines(content);
  const entries = parsed.data.entries;
  const parseErrors = parsed.data.invalidCount;
  const totalLines = parsed.data.totalLines;

  const collected = collectFactsFromEntries(entries);

  if (parseErrors > 0) {
    log(`[SessionEnd] Skipped ${parseErrors}/${totalLines} unparseable transcript lines`);
  }

  if (collected.userMessages.length === 0) return null;

  return {
    userMessages: collected.userMessages.slice(-10),
    toolsUsed: unique(collected.toolsUsed).slice(0, 20),
    filesModified: unique(collected.filesModified).slice(0, 30),
    totalMessages: collected.userMessages.length
  };
}

const MAX_STDIN = 1024 * 1024;

function collectFactsFromEntries(entries) {
  const userMessages = [];
  const toolsUsed = [];
  const filesModified = [];

  for (const entry of entries) {
    addUserMessage(entry, userMessages);
    addDirectToolUsage(entry, toolsUsed, filesModified);
    addAssistantToolUsage(entry, toolsUsed, filesModified);
  }

  return { userMessages, toolsUsed, filesModified };
}

function addUserMessage(entry, userMessages) {
  if (!isUserEntry(entry)) return;

  const rawContent = entry.message?.content ?? entry.content;
  const text = normalizeTextContent(rawContent);
  if (text.trim()) {
    userMessages.push(text.trim().slice(0, 200));
  }
}

function isUserEntry(entry) {
  return entry.type === 'user' || entry.role === 'user' || entry.message?.role === 'user';
}

function normalizeTextContent(rawContent) {
  if (typeof rawContent === 'string') return rawContent;
  if (!Array.isArray(rawContent)) return '';
  return rawContent.map(c => (c && c.text) || '').join(' ');
}

function addDirectToolUsage(entry, toolsUsed, filesModified) {
  if (!(entry.type === 'tool_use' || entry.tool_name)) return;

  const toolName = entry.tool_name || entry.name || '';
  if (toolName) toolsUsed.push(toolName);

  const filePath = entry.tool_input?.file_path || entry.input?.file_path || '';
  if (filePath && isFileWriteTool(toolName)) {
    filesModified.push(filePath);
  }
}

function addAssistantToolUsage(entry, toolsUsed, filesModified) {
  if (!(entry.type === 'assistant' && Array.isArray(entry.message?.content))) return;

  for (const block of entry.message.content) {
    if (block.type !== 'tool_use') continue;

    const toolName = block.name || '';
    if (toolName) toolsUsed.push(toolName);

    const filePath = block.input?.file_path || '';
    if (filePath && isFileWriteTool(toolName)) {
      filesModified.push(filePath);
    }
  }
}

function isFileWriteTool(toolName) {
  return toolName === 'Edit' || toolName === 'Write';
}

function resolveTranscriptPath(stdinData) {
  const parsed = safeJsonParse(stdinData);
  if (parsed.ok && parsed.data && typeof parsed.data.transcript_path === 'string') {
    return parsed.data.transcript_path;
  }
  return process.env.CLAUDE_TRANSCRIPT_PATH || null;
}

function buildDefaultSection() {
  return '## Current State\n\n[Session context goes here]\n\n### Completed\n- [ ]\n\n### In Progress\n- [ ]\n\n### Notes for Next Session\n-\n\n### Context to Load\n```\\n[relevant files]\\n```';
}

function applySummaryToExistingFile(sessionFile, summary) {
  const existing = readFile(sessionFile);
  if (!existing) return;

  const updatedContent = existing.replace(
    /## (?:Session Summary|Current State)[\s\S]*?$/,
    buildSummarySection(summary).trim() + '\n'
  );
  writeFile(sessionFile, updatedContent);
}

function writeNewSessionFile(sessionFile, today, currentTime, summary) {
  const summarySection = summary ? buildSummarySection(summary) : buildDefaultSection();

  const template = `# Session: ${today}
**Date:** ${today}
**Started:** ${currentTime}
**Last Updated:** ${currentTime}

---

${summarySection}
`;

  writeFile(sessionFile, template);
  log(`[SessionEnd] Created session file: ${sessionFile}`);
}

async function main(stdinData) {
  const transcriptPath = resolveTranscriptPath(stdinData);

  const sessionsDir = getSessionsDir();
  const today = getDateString();
  const shortId = getSessionIdShort();
  const sessionFile = path.join(sessionsDir, `${today}-${shortId}-session.tmp`);

  ensureDir(sessionsDir);

  const currentTime = getTimeString();

  let summary = null;
  if (transcriptPath && isPathExists(transcriptPath)) {
    summary = collectSessionSummary(transcriptPath);
  } else if (transcriptPath) {
    log(`[SessionEnd] Transcript not found: ${transcriptPath}`);
  }

  if (isPathExists(sessionFile)) {
    const updated = replaceInFile(
      sessionFile,
      /\*\*Last Updated:\*\*.*/,
      `**Last Updated:** ${currentTime}`
    );
    if (!updated) {
      log(`[SessionEnd] Failed to update timestamp in ${sessionFile}`);
    }

    if (summary) {
      applySummaryToExistingFile(sessionFile, summary);
    }

    log(`[SessionEnd] Updated session file: ${sessionFile}`);
  } else {
    writeNewSessionFile(sessionFile, today, currentTime, summary);
  }

  process.exit(0);
}

function buildSummarySection(summary) {
  const lines = ['## Session Summary', '', '### Tasks'];

  for (const msg of summary.userMessages) {
    lines.push(`- ${sanitizeListItem(msg)}`);
  }
  lines.push('');

  if (summary.filesModified.length > 0) {
    lines.push('### Files Modified');
    for (const filePath of summary.filesModified) {
      lines.push(`- ${filePath}`);
    }
    lines.push('');
  }

  if (summary.toolsUsed.length > 0) {
    lines.push('### Tools Used');
    lines.push(summary.toolsUsed.join(', '));
    lines.push('');
  }

  lines.push('### Stats');
  lines.push(`- Total user messages: ${summary.totalMessages}`);

  return lines.join('\n') + '\n';
}

function sanitizeListItem(text) {
  return String(text).replace(/\n/g, ' ').replace(/`/g, '\\`');
}

async function runMain() {
  try {
    const stdinData = await readStdinText({ timeoutMs: 5000, maxSize: MAX_STDIN });
    await main(stdinData);
  } catch (runError) {
    console.error('[SessionEnd] Error:', runError.message);
    process.exit(0);
  }
}

runMain();


#!/usr/bin/env node
'use strict';

const path = require('path');
const {
  hookEnabled,
  readHookPayload,
  resolveRuntimeModule,
  runExistingHook,
  transformToClaude
} = require('./adapter');

function loadRuntimeHelpers() {
  const utils = require(resolveRuntimeModule('lib', 'utils.js'));
  const evaluateSession = require(resolveRuntimeModule('hooks', 'evaluate-session.js'));
  return { utils, evaluateSession };
}

function normalizeTextContent(rawContent) {
  if (typeof rawContent === 'string') return rawContent;
  if (!Array.isArray(rawContent)) return '';
  return rawContent.map((block) => {
    if (!block) return '';
    if (typeof block.text === 'string') return block.text;
    if (typeof block.content === 'string') return block.content;
    return '';
  }).join(' ');
}

function isUserMessage(entry) {
  return entry?.role === 'user' || entry?.type === 'user' || entry?.message?.role === 'user';
}

function isFileWriteTool(toolName) {
  return toolName === 'Edit' || toolName === 'Write';
}

function collectCursorFacts(messages = []) {
  const userMessages = [];
  const toolsUsed = [];
  const filesModified = [];

  for (const entry of messages) {
    if (isUserMessage(entry)) {
      const rawContent = entry.content ?? entry.message?.content ?? entry.text ?? '';
      const text = normalizeTextContent(rawContent).trim();
      if (text) {
        userMessages.push(text.slice(0, 200));
      }
    }

    if (entry?.type === 'tool_use' || entry?.tool_name) {
      const toolName = entry.tool_name || entry.name || '';
      if (toolName) toolsUsed.push(toolName);
      const filePath = entry.tool_input?.file_path || entry.input?.file_path || '';
      if (filePath && isFileWriteTool(toolName)) {
        filesModified.push(filePath);
      }
    }

    if (Array.isArray(entry?.content)) {
      for (const block of entry.content) {
        if (block?.type !== 'tool_use') continue;
        const toolName = block.name || '';
        if (toolName) toolsUsed.push(toolName);
        const filePath = block.input?.file_path || '';
        if (filePath && isFileWriteTool(toolName)) {
          filesModified.push(filePath);
        }
      }
    }
  }

  return {
    userMessages,
    toolsUsed: [...new Set(toolsUsed)],
    filesModified: [...new Set(filesModified)]
  };
}

function buildCursorSummary(input) {
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const collected = collectCursorFacts(messages);
  const modifiedFiles = Array.isArray(input.modified_files)
    ? input.modified_files.filter((filePath) => typeof filePath === 'string' && filePath.trim())
    : [];

  const filesModified = [...new Set([...collected.filesModified, ...modifiedFiles])].slice(0, 30);

  if (collected.userMessages.length === 0 && filesModified.length === 0) {
    return null;
  }

  return {
    userMessages: collected.userMessages.slice(-10),
    toolsUsed: collected.toolsUsed.slice(0, 20),
    filesModified,
    totalMessages: collected.userMessages.length
  };
}

function sanitizeListItem(text) {
  return String(text).replace(/\n/g, ' ').replace(/`/g, '\\`');
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

function buildDefaultSection() {
  return '## Current State\n\n[Session context goes here]\n\n### Completed\n- [ ]\n\n### In Progress\n- [ ]\n\n### Notes for Next Session\n-\n\n### Context to Load\n```\\n[relevant files]\\n```';
}

function getCursorSessionIdShort(input, fallbackFn) {
  const conversationId = typeof input.conversation_id === 'string' ? input.conversation_id.trim() : '';
  if (conversationId) {
    return conversationId.slice(-8);
  }
  return fallbackFn('default');
}

function persistCursorSession(input, utilsOverride) {
  const utils = utilsOverride || loadRuntimeHelpers().utils;
  const {
    ensureDir,
    getDateString,
    getSessionIdShort,
    getSessionsDir,
    getTimeString,
    log,
    readFile,
    replaceInFile,
    writeFile
  } = utils;

  const sessionsDir = getSessionsDir();
  const today = getDateString();
  const shortId = getCursorSessionIdShort(input, getSessionIdShort);
  const sessionFile = path.join(sessionsDir, `${today}-${shortId}-session.tmp`);
  const currentTime = getTimeString();
  const summary = buildCursorSummary(input);

  ensureDir(sessionsDir);

  if (readFile(sessionFile)) {
    const updated = replaceInFile(
      sessionFile,
      /\*\*Last Updated:\*\*.*/,
      `**Last Updated:** ${currentTime}`
    );

    if (!updated) {
      log(`[CursorSessionEnd] Failed to update timestamp in ${sessionFile}`);
    }

    if (summary) {
      const existing = readFile(sessionFile);
      const updatedContent = existing.replace(
        /## (?:Session Summary|Current State)[\s\S]*?$/,
        buildSummarySection(summary).trim() + '\n'
      );
      writeFile(sessionFile, updatedContent);
    }

    log(`[CursorSessionEnd] Updated session file: ${sessionFile}`);
  } else {
    const summarySection = summary ? buildSummarySection(summary) : buildDefaultSection();
    const template = `# Session: ${today}
**Date:** ${today}
**Started:** ${currentTime}
**Last Updated:** ${currentTime}

---

${summarySection}
`;
    writeFile(sessionFile, template);
    log(`[CursorSessionEnd] Created session file: ${sessionFile}`);
  }

  return { sessionFile, summary };
}

function countCursorUserMessages(input) {
  const messages = Array.isArray(input.messages) ? input.messages : [];
  return messages.filter(isUserMessage).length;
}

function evaluateCursorSession(input, runtimeHelpers) {
  const { utils, evaluateSession } = runtimeHelpers || loadRuntimeHelpers();
  const { ensureDir, log } = utils;
  const { getDefaultConfigPath, loadEvaluateConfig } = evaluateSession;
  const configPath = getDefaultConfigPath(process.env);
  const { minSessionLength, learnedSkillsPath } = loadEvaluateConfig(configPath, log, process.env);
  const messageCount = countCursorUserMessages(input);

  ensureDir(learnedSkillsPath);

  if (messageCount < minSessionLength) {
    log(`[ContinuousLearning] Session too short (${messageCount} messages), skipping`);
    return { shouldEvaluate: false, reason: 'too-short', messageCount, learnedSkillsPath };
  }

  log(`[ContinuousLearning] Session has ${messageCount} messages - evaluate for extractable patterns`);
  log(`[ContinuousLearning] Save learned candidate skills to: ${learnedSkillsPath}`);
  return { shouldEvaluate: true, reason: 'evaluate', messageCount, learnedSkillsPath };
}

function normalizeUsage(rawUsage) {
  if (!rawUsage || typeof rawUsage !== 'object') {
    return null;
  }

  const inputTokens = Number(rawUsage.input_tokens ?? rawUsage.prompt_tokens ?? rawUsage.inputTokens ?? 0);
  const outputTokens = Number(rawUsage.output_tokens ?? rawUsage.completion_tokens ?? rawUsage.outputTokens ?? 0);
  const totalTokens = Number(rawUsage.total_tokens ?? rawUsage.totalTokens ?? (inputTokens + outputTokens));

  if (![inputTokens, outputTokens, totalTokens].some((value) => Number.isFinite(value) && value > 0)) {
    return null;
  }

  return {
    input_tokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    output_tokens: Number.isFinite(outputTokens) ? outputTokens : 0,
    total_tokens: Number.isFinite(totalTokens) ? totalTokens : 0
  };
}

function trackCursorCost(input, utilsOverride) {
  const utils = utilsOverride || loadRuntimeHelpers().utils;
  const { appendFile, ensureDir, getDataDir, log } = utils;
  const usage = normalizeUsage(input.usage || input.token_usage || input.session?.usage || input.session?.token_usage);

  if (!usage) {
    log('[MDT] Cost tracking: not available in Cursor payload');
    return { tracked: false, reason: 'missing-usage' };
  }

  const metricsDir = path.join(getDataDir(), 'metrics');
  const metricsFile = path.join(metricsDir, 'costs.jsonl');
  ensureDir(metricsDir);

  appendFile(metricsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    conversation_id: input.conversation_id || null,
    model: input.model || null,
    usage
  }) + '\n');

  log(`[MDT] Cost tracking: wrote usage snapshot to ${metricsFile}`);
  return { tracked: true, metricsFile, usage };
}

const UTF8_BOM = '\uFEFF';

function parseSessionPayload(raw) {
  if (raw == null || (typeof raw === 'string' && raw.trim() === '')) {
    return {};
  }
  const str = typeof raw === 'string' ? raw : String(raw);
  const trimmed = str.startsWith(UTF8_BOM) ? str.slice(UTF8_BOM.length) : str;
  let input = JSON.parse(trimmed);
  if (typeof input === 'string') {
    input = JSON.parse(input);
  }
  return input && typeof input === 'object' ? input : {};
}

async function processCursorSessionEnd(raw) {
  let input = {};
  try {
    input = parseSessionPayload(raw);
  } catch (err) {
    console.error('[CursorSessionEnd] Invalid Cursor payload; skipping session persistence');
    if (process.env.MDT_DEBUG_HOOKS) {
      console.error('[CursorSessionEnd] Parse error:', err.message);
      const preview = typeof raw === 'string' ? raw.slice(0, 120) : String(raw).slice(0, 120);
      console.error('[CursorSessionEnd] Raw preview:', JSON.stringify(preview));
    }
    return raw;
  }

  persistCursorSession(input);

  if (hookEnabled('stop:evaluate-session', ['minimal', 'standard', 'strict'])) {
    evaluateCursorSession(input);
  }

  if (hookEnabled('stop:cost-tracker', ['minimal', 'standard', 'strict'])) {
    trackCursorCost(input);
  }

  if (hookEnabled('session:end:marker', ['minimal', 'standard', 'strict'])) {
    runExistingHook('session-end-marker.js', transformToClaude(input));
  }

  return raw;
}

async function main() {
  try {
    const raw = await readHookPayload();
    const output = await processCursorSessionEnd(raw);
    process.stdout.write(output);
  } catch {
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildCursorSummary,
  buildDefaultSection,
  buildSummarySection,
  collectCursorFacts,
  countCursorUserMessages,
  evaluateCursorSession,
  getCursorSessionIdShort,
  normalizeTextContent,
  normalizeUsage,
  parseSessionPayload,
  persistCursorSession,
  processCursorSessionEnd,
  trackCursorCost
};

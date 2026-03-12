#!/usr/bin/env node
/**
 * Validate hooks.json schema
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { safeJsonParse } = require('../lib/runtime-utils');

const DEFAULT_HOOKS_FILE = path.join(__dirname, '../../claude-template/hooks.json');
const VALID_EVENTS = ['PreToolUse', 'PostToolUse', 'PreCompact', 'SessionStart', 'SessionEnd', 'Stop', 'Notification', 'SubagentStop'];
const DEFAULT_IO = { log: console.log, error: console.error };

function createState(totalMatchers = 0, hasErrors = false) {
  return { totalMatchers, hasErrors };
}

function withError(state) {
  return createState(state.totalMatchers, true);
}

function withMatcher(state) {
  return createState(state.totalMatchers + 1, state.hasErrors);
}

function withErrors(state, hasErrors) {
  return hasErrors ? withError(state) : state;
}

function invalidCommandField(command) {
  if (!command) return true;

  const isString = typeof command === 'string';
  const isArray = Array.isArray(command);

  if (!isString && !isArray) return true;
  if (isString) return !command.trim();
  if (command.length === 0) return true;

  return !command.every(item => typeof item === 'string' && item.length > 0);
}

function parseInlineNodeEval(command) {
  const nodeEMatch = command.match(/^node -e "(.*)"$/s);
  if (!nodeEMatch) return null;

  return nodeEMatch[1]
    .replace(/\\\\/g, '\\')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
}

function getHookValidationErrors(hook, label) {
  const errors = [];

  if (!hook.type || typeof hook.type !== 'string') {
    errors.push(`ERROR: ${label} missing or invalid 'type' field`);
  }
  if ('async' in hook && typeof hook.async !== 'boolean') {
    errors.push(`ERROR: ${label} 'async' must be a boolean`);
  }
  if ('timeout' in hook && (typeof hook.timeout !== 'number' || hook.timeout < 0)) {
    errors.push(`ERROR: ${label} 'timeout' must be a non-negative number`);
  }
  if (invalidCommandField(hook.command)) {
    errors.push(`ERROR: ${label} missing or invalid 'command' field`);
    return errors;
  }

  if (typeof hook.command !== 'string') return errors;

  const inlineJs = parseInlineNodeEval(hook.command);
  if (!inlineJs) return errors;

  try {
    new vm.Script(inlineJs);
  } catch (syntaxErr) {
    errors.push(`ERROR: ${label} has invalid inline JS: ${syntaxErr.message}`);
  }

  return errors;
}

/**
 * Validate a single hook entry has required fields and valid inline JS
 * @param {object} hook - Hook object with type and command fields
 * @param {string} label - Label for error messages (e.g., "PreToolUse[0].hooks[1]")
 * @returns {boolean} true if errors were found
 */
function validateHookEntry(hook, label, io = DEFAULT_IO) {
  const errors = getHookValidationErrors(hook, label);
  if (errors.length === 0) return false;

  for (const errorMsg of errors) {
    io.error(errorMsg);
  }
  return true;
}

function validateHookEntries(hookEntries, labelPrefix, io) {
  let hasErrors = false;

  for (let index = 0; index < hookEntries.length; index++) {
    const label = `${labelPrefix}.hooks[${index}]`;
    if (validateHookEntry(hookEntries[index], label, io)) {
      hasErrors = true;
    }
  }

  return hasErrors;
}

function validateMatcherShape(matcher, matcherLabel, io) {
  if (typeof matcher !== 'object' || matcher === null) {
    io.error(`ERROR: ${matcherLabel} is not an object`);
    return { hasErrors: true, hookEntries: [] };
  }

  let hasErrors = false;
  if (!matcher.matcher) {
    io.error(`ERROR: ${matcherLabel} missing 'matcher' field`);
    hasErrors = true;
  }
  if (!matcher.hooks || !Array.isArray(matcher.hooks)) {
    io.error(`ERROR: ${matcherLabel} missing 'hooks' array`);
    return { hasErrors: true, hookEntries: [] };
  }

  return { hasErrors, hookEntries: matcher.hooks };
}

function validateObjectHooks(hooks, io, state) {
  let nextState = state;

  for (const [eventType, matchers] of Object.entries(hooks)) {
    if (!VALID_EVENTS.includes(eventType)) {
      io.error(`ERROR: Invalid event type: ${eventType}`);
      nextState = withError(nextState);
      continue;
    }
    if (!Array.isArray(matchers)) {
      io.error(`ERROR: ${eventType} must be an array`);
      nextState = withError(nextState);
      continue;
    }

    for (let index = 0; index < matchers.length; index++) {
      const matcherLabel = `${eventType}[${index}]`;
      const validated = validateMatcherShape(matchers[index], matcherLabel, io);
      const entryHasErrors = validateHookEntries(validated.hookEntries, matcherLabel, io);
      nextState = withMatcher(withErrors(nextState, validated.hasErrors || entryHasErrors));
    }
  }

  return nextState;
}

function validateLegacyArrayHooks(hooks, io, state) {
  let nextState = state;

  for (let index = 0; index < hooks.length; index++) {
    const matcherLabel = `Hook ${index}`;
    const validated = validateMatcherShape(hooks[index], matcherLabel, io);
    const entryHasErrors = validateHookEntries(validated.hookEntries, matcherLabel, io);
    nextState = withMatcher(withErrors(nextState, validated.hasErrors || entryHasErrors));
  }

  return nextState;
}

function parseHooksJson(hooksFile) {
  const rawContent = fs.readFileSync(hooksFile, 'utf-8');
  return safeJsonParse(rawContent);
}

function validateHooks(options = {}) {
  const hooksFile = options.hooksFile || DEFAULT_HOOKS_FILE;
  const io = options.io || DEFAULT_IO;
  if (!fs.existsSync(hooksFile)) {
    io.log('No hooks.json found, skipping validation');
    return { exitCode: 0, totalMatchers: 0, hasErrors: false };
  }

  const parsed = parseHooksJson(hooksFile);
  if (!parsed.ok) {
    io.error(`ERROR: Invalid JSON in hooks.json: ${parsed.error.message}`);
    return { exitCode: 1, totalMatchers: 0, hasErrors: true };
  }

  const data = parsed.data;
  const hooks = data.hooks || data;
  const initialState = createState();

  let finalState = initialState;
  if (Array.isArray(hooks)) {
    finalState = validateLegacyArrayHooks(hooks, io, initialState);
  } else if (typeof hooks === 'object' && hooks !== null) {
    finalState = validateObjectHooks(hooks, io, initialState);
  } else {
    io.error('ERROR: hooks.json must be an object or array');
    return { exitCode: 1, totalMatchers: 0, hasErrors: true };
  }

  if (finalState.hasErrors) {
    return { exitCode: 1, totalMatchers: finalState.totalMatchers, hasErrors: true };
  }

  io.log(`Validated ${finalState.totalMatchers} hook matchers`);
  return { exitCode: 0, totalMatchers: finalState.totalMatchers, hasErrors: false };
}

if (require.main === module) {
  const result = validateHooks();
  process.exit(result.exitCode);
}

module.exports = {
  validateHookEntry,
  validateHooks
};

#!/usr/bin/env node
/**
 * Validate hooks.json schema
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DEFAULT_HOOKS_FILE = path.join(__dirname, '../../hooks/hooks.json');
const VALID_EVENTS = ['PreToolUse', 'PostToolUse', 'PreCompact', 'SessionStart', 'SessionEnd', 'Stop', 'Notification', 'SubagentStop'];

/**
 * Validate a single hook entry has required fields and valid inline JS
 * @param {object} hook - Hook object with type and command fields
 * @param {string} label - Label for error messages (e.g., "PreToolUse[0].hooks[1]")
 * @returns {boolean} true if errors were found
 */
function validateHookEntry(hook, label, io = { error: console.error }) {
  let hasErrors = false;

  if (!hook.type || typeof hook.type !== 'string') {
    io.error(`ERROR: ${label} missing or invalid 'type' field`);
    hasErrors = true;
  }

  // Validate optional async and timeout fields
  if ('async' in hook && typeof hook.async !== 'boolean') {
    io.error(`ERROR: ${label} 'async' must be a boolean`);
    hasErrors = true;
  }
  if ('timeout' in hook && (typeof hook.timeout !== 'number' || hook.timeout < 0)) {
    io.error(`ERROR: ${label} 'timeout' must be a non-negative number`);
    hasErrors = true;
  }

  if (!hook.command || (typeof hook.command !== 'string' && !Array.isArray(hook.command)) || (typeof hook.command === 'string' && !hook.command.trim()) || (Array.isArray(hook.command) && (hook.command.length === 0 || !hook.command.every(s => typeof s === 'string' && s.length > 0)))) {
    io.error(`ERROR: ${label} missing or invalid 'command' field`);
    hasErrors = true;
  } else if (typeof hook.command === 'string') {
    // Validate inline JS syntax in node -e commands
    const nodeEMatch = hook.command.match(/^node -e "(.*)"$/s);
    if (nodeEMatch) {
      try {
        new vm.Script(nodeEMatch[1].replace(/\\\\/g, '\\').replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t'));
      } catch (syntaxErr) {
          io.error(`ERROR: ${label} has invalid inline JS: ${syntaxErr.message}`);
        hasErrors = true;
      }
    }
  }

  return hasErrors;
}

function validateHooks(options = {}) {
  const hooksFile = options.hooksFile || DEFAULT_HOOKS_FILE;
  const io = options.io || { log: console.log, error: console.error };
  if (!fs.existsSync(hooksFile)) {
    io.log('No hooks.json found, skipping validation');
    return { exitCode: 0, totalMatchers: 0, hasErrors: false };
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(hooksFile, 'utf-8'));
  } catch (e) {
    io.error(`ERROR: Invalid JSON in hooks.json: ${e.message}`);
    return { exitCode: 1, totalMatchers: 0, hasErrors: true };
  }

  // Support both object format { hooks: {...} } and array format
  const hooks = data.hooks || data;
  let hasErrors = false;
  let totalMatchers = 0;

  if (typeof hooks === 'object' && !Array.isArray(hooks)) {
    // Object format: { EventType: [matchers] }
    for (const [eventType, matchers] of Object.entries(hooks)) {
      if (!VALID_EVENTS.includes(eventType)) {
        io.error(`ERROR: Invalid event type: ${eventType}`);
        hasErrors = true;
        continue;
      }

      if (!Array.isArray(matchers)) {
        io.error(`ERROR: ${eventType} must be an array`);
        hasErrors = true;
        continue;
      }

      for (let i = 0; i < matchers.length; i++) {
        const matcher = matchers[i];
        if (typeof matcher !== 'object' || matcher === null) {
          io.error(`ERROR: ${eventType}[${i}] is not an object`);
          hasErrors = true;
          continue;
        }
        if (!matcher.matcher) {
          io.error(`ERROR: ${eventType}[${i}] missing 'matcher' field`);
          hasErrors = true;
        }
        if (!matcher.hooks || !Array.isArray(matcher.hooks)) {
          io.error(`ERROR: ${eventType}[${i}] missing 'hooks' array`);
          hasErrors = true;
        } else {
          // Validate each hook entry
          for (let j = 0; j < matcher.hooks.length; j++) {
            if (validateHookEntry(matcher.hooks[j], `${eventType}[${i}].hooks[${j}]`, io)) {
              hasErrors = true;
            }
          }
        }
        totalMatchers++;
      }
    }
  } else if (Array.isArray(hooks)) {
    // Array format (legacy)
    for (let i = 0; i < hooks.length; i++) {
      const hook = hooks[i];
      if (!hook.matcher) {
        io.error(`ERROR: Hook ${i} missing 'matcher' field`);
        hasErrors = true;
      }
      if (!hook.hooks || !Array.isArray(hook.hooks)) {
        io.error(`ERROR: Hook ${i} missing 'hooks' array`);
        hasErrors = true;
      } else {
        // Validate each hook entry
        for (let j = 0; j < hook.hooks.length; j++) {
          if (validateHookEntry(hook.hooks[j], `Hook ${i}.hooks[${j}]`, io)) {
            hasErrors = true;
          }
        }
      }
      totalMatchers++;
    }
  } else {
    io.error('ERROR: hooks.json must be an object or array');
    return { exitCode: 1, totalMatchers: 0, hasErrors: true };
  }

  if (hasErrors) {
    return { exitCode: 1, totalMatchers, hasErrors: true };
  }

  io.log(`Validated ${totalMatchers} hook matchers`);
  return { exitCode: 0, totalMatchers, hasErrors: false };
}

if (require.main === module) {
  const result = validateHooks();
  process.exit(result.exitCode);
}

module.exports = {
  validateHookEntry,
  validateHooks
};

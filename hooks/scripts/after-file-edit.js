#!/usr/bin/env node
/**
 * afterFileEdit: run post-edit format, typecheck, console-warn, and observe.
 *
 * Payload source: stdin, or MDT_HOOK_PAYLOAD_FILE (read then delete) so a
 * caller can pass large payloads via a temp file and avoid ENAMETOOLONG.
 *
 * Known Cursor limitation (Windows): when the payload is large, Cursor may
 * pass it via spawn args/env instead of stdin, causing spawn ENAMETOOLONG
 * before this script runs. Workaround: remove the afterFileEdit entry from
 * .cursor/hooks.json, or (when supported) have the caller set
 * MDT_HOOK_PAYLOAD_FILE to a temp file path. See docs/tools/cursor.md.
 */
const path = require('path');
const { buildHookEnv, getPluginRoot, readHookPayload, runExistingHook, transformToClaude } = require('./adapter');

function getObserveScriptPath(env = process.env) {
  const hookEnv = buildHookEnv(env);
  return path.join(hookEnv.MDT_ROOT || getPluginRoot(), 'skills', 'ai-learning', 'hooks', 'observe.js');
}

async function processCursorAfterFileEdit(raw, options = {}) {
  const runner = options.runner;
  const env = options.env || process.env;
  try {
    const input = JSON.parse(raw);
    const filePath = input.path || input.file || input.args?.filePath || '';
    const claudeInput = transformToClaude(input, {
      tool_input: { file_path: filePath }
    });
    const claudeStr = JSON.stringify(claudeInput);

    runExistingHook('post-edit-format.js', claudeStr, { runner, env });
    runExistingHook('post-edit-typecheck.js', claudeStr, { runner, env });
    runExistingHook('post-edit-console-warn.js', claudeStr, { runner, env });

    const observePayload = {
      conversation_id: input.conversation_id || input.session_id || '',
      tool: input.tool || input.tool_name || 'Edit',
      input: { file_path: filePath },
      output: input.output || input.result || '',
      cwd: input.cwd || input.workspace_roots?.[0] || process.cwd(),
      workspace_roots: input.workspace_roots
    };
    runExistingHook('observe.js', JSON.stringify(observePayload), {
      runner,
      env,
      scriptPath: getObserveScriptPath(env)
    });
  } catch (_error) {
    return raw;
  }

  return raw;
}

readHookPayload().then(async (raw) => {
  const output = await processCursorAfterFileEdit(raw);
  process.stdout.write(output);
}).catch(() => process.exit(0));

module.exports = {
  getObserveScriptPath,
  processCursorAfterFileEdit
};

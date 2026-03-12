#!/usr/bin/env node
const path = require('path');
const { buildHookEnv, getPluginRoot, readStdin, runExistingHook, transformToClaude } = require('./adapter');

function getObserveScriptPath(env = process.env) {
  const hookEnv = buildHookEnv(env);
  return path.join(hookEnv.MDT_ROOT || getPluginRoot(), 'skills', 'continuous-learning-automatic', 'hooks', 'observe.js');
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
  } catch {}

  return raw;
}

readStdin().then(async (raw) => {
  const output = await processCursorAfterFileEdit(raw);
  process.stdout.write(output);
}).catch(() => process.exit(0));

module.exports = {
  getObserveScriptPath,
  processCursorAfterFileEdit
};

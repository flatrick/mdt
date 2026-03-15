#!/usr/bin/env node
const path = require('path');
const { buildHookEnv, getPluginRoot, hookEnabled, readStdin, runExistingHook } = require('./adapter');

function getObserveScriptPath(env = process.env) {
  const hookEnv = buildHookEnv(env);
  return path.join(hookEnv.MDT_ROOT || getPluginRoot(), 'skills', 'ai-learning', 'hooks', 'observe.js');
}

async function processCursorAfterShellExecution(raw, options = {}) {
  const runner = options.runner;
  const env = options.env || process.env;
  try {
    const input = JSON.parse(raw || '{}');
    const cmd = String(input.command || input.args?.command || '');
    const output = String(input.output || input.result || '');

    if (hookEnabled('post:bash:pr-created', ['standard', 'strict']) && /\bgh\s+pr\s+create\b/.test(cmd)) {
      const m = output.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/);
      if (m) {
        console.error('[MDT] PR created: ' + m[0]);
        const repo = m[0].replace(/https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/\d+/, '$1');
        const pr = m[0].replace(/.+\/pull\/(\d+)/, '$1');
        console.error('[MDT] To review: gh pr review ' + pr + ' --repo ' + repo);
      }
    }

    if (hookEnabled('post:bash:build-complete', ['standard', 'strict']) && /(npm run build|pnpm build|yarn build)/.test(cmd)) {
      console.error('[MDT] Build completed');
    }

    const observePayload = {
      conversation_id: input.conversation_id || input.session_id || '',
      tool: input.tool || input.tool_name || 'Bash',
      input: { command: cmd },
      output,
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

readStdin().then(async (raw) => {
  const output = await processCursorAfterShellExecution(raw);
  process.stdout.write(output);
}).catch(() => process.exit(0));

module.exports = {
  getObserveScriptPath,
  processCursorAfterShellExecution
};

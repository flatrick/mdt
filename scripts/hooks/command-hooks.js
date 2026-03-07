#!/usr/bin/env node
/**
 * Shared hook script for command reminders/guards.
 * Replaces inline `node -e` hooks with file-backed Node.js logic.
 */

const { readStdinText, parseJsonObject } = require('../lib/utils');

const MAX_STDIN = 1024 * 1024; // 1MB

function extractCommand(input) {
  return input && input.tool_input && typeof input.tool_input.command === 'string'
    ? input.tool_input.command
    : '';
}

function getToolOutput(input) {
  return input && input.tool_output && typeof input.tool_output.output === 'string'
    ? input.tool_output.output
    : '';
}

function handlePreDevTmuxBlock(cmd) {
  if (
    process.platform !== 'win32' &&
    /(npm run dev\b|pnpm( run)? dev\b|yarn dev\b|bun run dev\b)/.test(cmd)
  ) {
    console.error('[Hook] BLOCKED: Dev server must run in tmux for log access');
    console.error('[Hook] Use: tmux new-session -d -s dev "npm run dev"');
    console.error('[Hook] Then: tmux attach -t dev');
    return 2;
  }
  return 0;
}

function handlePreTmuxReminder(cmd) {
  if (
    process.platform !== 'win32' &&
    !process.env.TMUX &&
    /(npm (install|test)|pnpm (install|test)|yarn (install|test)|bun (install|test)|cargo build|make\b|docker\b|pytest|vitest|playwright)/.test(cmd)
  ) {
    console.error('[Hook] Consider running in tmux for session persistence');
    console.error('[Hook] tmux new -s dev  |  tmux attach -t dev');
  }
  return 0;
}

function handleGitPushReminder(cmd) {
  if (/git push/.test(cmd)) {
    console.error('[Hook] Review changes before push...');
    console.error('[Hook] Continuing with push (remove this hook to add interactive review)');
  }
  return 0;
}

function handlePrReviewReminder(cmd, input) {
  if (!/gh pr create/.test(cmd)) return 0;

  const output = getToolOutput(input);
  const match = output.match(/https:\/\/github.com\/[^/]+\/[^/]+\/pull\/\d+/);
  if (!match) return 0;

  const prUrl = match[0];
  const repo = prUrl.replace(/https:\/\/github.com\/([^/]+\/[^/]+)\/pull\/\d+/, '$1');
  const pr = prUrl.replace(/.+\/pull\/(\d+)/, '$1');
  console.error(`[Hook] PR created: ${prUrl}`);
  console.error(`[Hook] To review: gh pr review ${pr} --repo ${repo}`);
  return 0;
}

function handleBuildReminder(cmd) {
  if (/(npm run build|pnpm build|yarn build)/.test(cmd)) {
    console.error('[Hook] Build completed - async analysis running in background');
  }
  return 0;
}

const MODE_HANDLERS = {
  'pre-dev-tmux-block': (cmd) => handlePreDevTmuxBlock(cmd),
  'pre-tmux-reminder': (cmd) => handlePreTmuxReminder(cmd),
  'pre-git-push-reminder': (cmd) => handleGitPushReminder(cmd),
  'post-pr-review-reminder': (cmd, input) => handlePrReviewReminder(cmd, input),
  'post-build-async-reminder': (cmd) => handleBuildReminder(cmd)
};

function handleMode(mode, input) {
  const cmd = extractCommand(input);
  const handler = MODE_HANDLERS[mode];
  if (handler) {
    return handler(cmd, input);
  }
  console.error(`[Hook] Unknown mode: ${mode}`);
  return 0;
}

async function runCli() {
  const data = await readStdinText({ timeoutMs: 5000, maxSize: MAX_STDIN });
  const input = parseJsonObject(data);
  const mode = process.argv[2] || '';
  const code = handleMode(mode, input);
  process.stdout.write(data);
  process.exit(code);
}

runCli().catch(() => {
  process.exit(0);
});

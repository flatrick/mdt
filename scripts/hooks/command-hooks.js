#!/usr/bin/env node
/**
 * Shared hook script for command reminders/guards.
 * Replaces inline `node -e` hooks with file-backed Node.js logic.
 */

const MAX_STDIN = 1024 * 1024; // 1MB
let data = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  if (data.length < MAX_STDIN) {
    const remaining = MAX_STDIN - data.length;
    data += chunk.substring(0, remaining);
  }
});

function extractCommand(input) {
  return input && input.tool_input && typeof input.tool_input.command === 'string'
    ? input.tool_input.command
    : '';
}

function handleMode(mode, input) {
  const cmd = extractCommand(input);

  if (mode === 'pre-dev-tmux-block') {
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

  if (mode === 'pre-tmux-reminder') {
    if (
      process.platform !== 'win32' &&
      !process.env.TMUX &&
      /(npm (install|test)|pnpm (install|test)|yarn (install|test)?|bun (install|test)|cargo build|make\b|docker\b|pytest|vitest|playwright)/.test(cmd)
    ) {
      console.error('[Hook] Consider running in tmux for session persistence');
      console.error('[Hook] tmux new -s dev  |  tmux attach -t dev');
    }
    return 0;
  }

  if (mode === 'pre-git-push-reminder') {
    if (/git push/.test(cmd)) {
      console.error('[Hook] Review changes before push...');
      console.error('[Hook] Continuing with push (remove this hook to add interactive review)');
    }
    return 0;
  }

  if (mode === 'post-pr-review-reminder') {
    if (/gh pr create/.test(cmd)) {
      const output = input && input.tool_output && typeof input.tool_output.output === 'string'
        ? input.tool_output.output
        : '';
      const match = output.match(/https:\/\/github.com\/[^/]+\/[^/]+\/pull\/\d+/);
      if (match) {
        const prUrl = match[0];
        const repo = prUrl.replace(/https:\/\/github.com\/([^/]+\/[^/]+)\/pull\/\d+/, '$1');
        const pr = prUrl.replace(/.+\/pull\/(\d+)/, '$1');
        console.error(`[Hook] PR created: ${prUrl}`);
        console.error(`[Hook] To review: gh pr review ${pr} --repo ${repo}`);
      }
    }
    return 0;
  }

  if (mode === 'post-build-async-reminder') {
    if (/(npm run build|pnpm build|yarn build)/.test(cmd)) {
      console.error('[Hook] Build completed - async analysis running in background');
    }
    return 0;
  }

  console.error(`[Hook] Unknown mode: ${mode}`);
  return 0;
}

process.stdin.on('end', () => {
  let input = {};
  try {
    input = data ? JSON.parse(data) : {};
  } catch {
    input = {};
  }

  const mode = process.argv[2] || '';
  const code = handleMode(mode, input);
  process.stdout.write(data);
  process.exit(code);
});

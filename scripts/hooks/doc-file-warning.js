/**
 * Doc file warning hook (PreToolUse - Write)
 * Warns about non-standard documentation files.
 * Exit code 0 always (warns only, never blocks).
 */

const { readStdinText, parseJsonObject } = require('../lib/utils');

async function runCli() {
  const data = await readStdinText({ timeoutMs: 5000, maxSize: 1024 * 1024 });
  const input = parseJsonObject(data);
  const filePath = input.tool_input?.file_path || '';

  if (
    /\.(md|txt)$/.test(filePath) &&
    !/(README|CLAUDE|AGENTS|CONTRIBUTING|CHANGELOG|LICENSE|SKILL)\.md$/i.test(filePath) &&
    !/\.claude[/\\]plans[/\\]/.test(filePath) &&
    !/(^|[/\\])(docs|skills|\.history)[/\\]/.test(filePath)
  ) {
    console.error('[Hook] WARNING: Non-standard documentation file detected');
    console.error('[Hook] File: ' + filePath);
    console.error('[Hook] Consider consolidating into README.md or docs/ directory');
  }
  // Keep historical behavior (console.log adds trailing newline).
  console.log(data);
}

runCli().catch(() => {
  process.exit(0);
});

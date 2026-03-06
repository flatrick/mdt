#!/usr/bin/env node
/**
 * PreToolUse Hook: Warn about non-standard documentation files
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs before Write tool use. If the file is a .md or .txt file that isn't
 * a standard documentation file (README, CLAUDE, AGENTS, etc.) or in an
 * expected directory (docs/, skills/, .claude/plans/), warns the user.
 *
 * Exit code 0 — warn only, does not block.
 */

const path = require('path');
const { readStdinText, parseJsonObject } = require('../lib/utils');

const MAX_STDIN = 1024 * 1024; // 1MB limit
async function runCli() {
  const data = await readStdinText({ timeoutMs: 5000, maxSize: MAX_STDIN });
  const input = parseJsonObject(data);
  const filePath = input.tool_input?.file_path || '';

  // Only check .md and .txt files
  if (!/\.(md|txt)$/.test(filePath)) {
    process.stdout.write(data);
    return;
  }

  // Allow standard documentation files
  const basename = path.basename(filePath);
  if (/^(README|CLAUDE|AGENTS|CONTRIBUTING|CHANGELOG|LICENSE|SKILL)\.md$/i.test(basename)) {
    process.stdout.write(data);
    return;
  }

  // Allow files in .claude/plans/, docs/, and skills/ directories
  const normalized = filePath.replace(/\\/g, '/');
  if (/\.claude\/plans\//.test(normalized) || /(^|\/)(docs|skills)\//.test(normalized)) {
    process.stdout.write(data);
    return;
  }

  // Warn about non-standard documentation files
  console.error('[Hook] WARNING: Non-standard documentation file detected');
  console.error('[Hook] File: ' + filePath);
  console.error('[Hook] Consider consolidating into README.md or docs/ directory');

  process.stdout.write(data);
}

runCli().catch(() => {
  process.exit(0);
});

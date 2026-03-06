#!/usr/bin/env node
/**
 * PostToolUse Hook: Auto-format JS/TS files after edits
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs after Edit tool use. If the edited file is a JS/TS file,
 * auto-detects the project formatter (Biome or Prettier) by looking
 * for config files, then formats accordingly.
 * Fails silently if no formatter is found or installed.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { readStdinText, parseJsonObject } = require('../lib/utils');

const MAX_STDIN = 1024 * 1024; // 1MB limit

function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return startDir;
}

function detectFormatter(projectRoot) {
  const biomeConfigs = ['biome.json', 'biome.jsonc'];
  for (const cfg of biomeConfigs) {
    if (fs.existsSync(path.join(projectRoot, cfg))) return 'biome';
  }

  const prettierConfigs = [
    '.prettierrc',
    '.prettierrc.json',
    '.prettierrc.js',
    '.prettierrc.cjs',
    '.prettierrc.mjs',
    '.prettierrc.yml',
    '.prettierrc.yaml',
    '.prettierrc.toml',
    'prettier.config.js',
    'prettier.config.cjs',
    'prettier.config.mjs',
  ];
  for (const cfg of prettierConfigs) {
    if (fs.existsSync(path.join(projectRoot, cfg))) return 'prettier';
  }

  return null;
}

function getFormatterCommand(formatter, filePath) {
  const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  if (formatter === 'biome') {
    return { bin: npxBin, args: ['@biomejs/biome', 'format', '--write', filePath] };
  }
  if (formatter === 'prettier') {
    return { bin: npxBin, args: ['prettier', '--write', filePath] };
  }
  return null;
}

async function runCli() {
  const data = await readStdinText({ timeoutMs: 5000, maxSize: MAX_STDIN });
  const input = parseJsonObject(data);
  const filePath = input.tool_input?.file_path;

  if (filePath && /\.(ts|tsx|js|jsx)$/.test(filePath)) {
    try {
      const projectRoot = findProjectRoot(path.dirname(path.resolve(filePath)));
      const formatter = detectFormatter(projectRoot);
      const cmd = getFormatterCommand(formatter, filePath);

      if (cmd) {
        execFileSync(cmd.bin, cmd.args, {
          cwd: projectRoot,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 15000
        });
      }
    } catch {
      // Formatter not installed, file missing, or failed — non-blocking
    }
  }

  process.stdout.write(data);
  process.exit(0);
}

runCli().catch(() => {
  process.exit(0);
});

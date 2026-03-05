#!/usr/bin/env node
/**
 * Cursor-to-Claude Code Hook Adapter
 * Transforms Cursor stdin JSON to Claude Code hook format,
 * then delegates to existing scripts/hooks/*.js
 */

const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');

const MAX_STDIN = 1024 * 1024;

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      if (data.length < MAX_STDIN) data += chunk.substring(0, MAX_STDIN - data.length);
    });
    process.stdin.on('end', () => resolve(data));
  });
}

function getCursorRoot() {
  return path.resolve(__dirname, '..');
}

function getPluginRoot() {
  // Legacy fallback used when running from repo checkout.
  return path.resolve(__dirname, '..', '..');
}

function resolveDelegatedHook(scriptName) {
  const candidates = [
    // Installed layout: ~/.cursor/scripts/hooks/*.js
    path.join(getCursorRoot(), 'scripts', 'hooks', scriptName),
    // Repo layout: <repo>/scripts/hooks/*.js
    path.join(getPluginRoot(), 'scripts', 'hooks', scriptName),
    // Last-resort runtime cwd
    path.join(process.cwd(), 'scripts', 'hooks', scriptName),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function transformToClaude(cursorInput, overrides = {}) {
  return {
    tool_input: {
      command: cursorInput.command || cursorInput.args?.command || '',
      file_path: cursorInput.path || cursorInput.file || '',
      ...overrides.tool_input,
    },
    tool_output: {
      output: cursorInput.output || cursorInput.result || '',
      ...overrides.tool_output,
    },
    _cursor: {
      conversation_id: cursorInput.conversation_id,
      hook_event_name: cursorInput.hook_event_name,
      workspace_roots: cursorInput.workspace_roots,
      model: cursorInput.model,
    },
  };
}

function runExistingHook(scriptName, stdinData) {
  const scriptPath = resolveDelegatedHook(scriptName);
  if (!fs.existsSync(scriptPath)) {
    console.error(`[ECC] Delegated hook missing: ${scriptName}`);
    console.error(`[ECC] Expected script path: ${scriptPath}`);
    return;
  }

  try {
    execFileSync('node', [scriptPath], {
      input: typeof stdinData === 'string' ? stdinData : JSON.stringify(stdinData),
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
      cwd: process.cwd(),
    });
  } catch (e) {
    const detail = String((e.stderr || e.message || '')).trim();
    console.error(`[ECC] Delegated hook failed: ${scriptName}`);
    console.error(`[ECC] Script path: ${scriptPath}`);
    if (detail) {
      const lastLine = detail.split(/\r?\n/).slice(-1)[0];
      console.error(`[ECC] ${lastLine}`);
    }
    if (e.status === 2) process.exit(2); // Forward blocking exit code
  }
}

module.exports = { readStdin, getCursorRoot, getPluginRoot, resolveDelegatedHook, transformToClaude, runExistingHook };

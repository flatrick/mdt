#!/usr/bin/env node
/**
 * Cursor-to-Claude Code Hook Adapter
 * Transforms Cursor stdin JSON to Claude Code hook format,
 * then delegates to existing scripts/hooks/*.js
 */

const fs = require('fs');
const { spawnSync } = require('child_process');
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
  const candidates = [
    // Repo source layout: <repo>/hooks/cursor/scripts
    path.resolve(__dirname, '..', '..', '..'),
    // Installed Cursor layout: <project>/.cursor/hooks
    path.resolve(__dirname, '..', '..'),
    process.cwd(),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'scripts', 'hooks'))) {
      return candidate;
    }
  }

  return candidates[0];
}

function resolveRuntimeModule(...segments) {
  const candidates = [
    path.join(getCursorRoot(), 'scripts', ...segments),
    path.join(getPluginRoot(), 'scripts', ...segments),
    path.join(process.cwd(), 'scripts', ...segments),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function resolveDelegatedHook(scriptName) {
  return resolveRuntimeModule('hooks', scriptName);
}

function transformToClaude(cursorInput, overrides = {}) {
  return {
    tool_input: {
      command: cursorInput.command || cursorInput.args?.command || '',
      file_path: cursorInput.path || cursorInput.file || cursorInput.args?.filePath || '',
      ...overrides.tool_input,
    },
    tool_output: {
      output: cursorInput.output || cursorInput.result || '',
      ...overrides.tool_output,
    },
    transcript_path: cursorInput.transcript_path || cursorInput.transcriptPath || cursorInput.session?.transcript_path || '',
    _cursor: {
      conversation_id: cursorInput.conversation_id,
      hook_event_name: cursorInput.hook_event_name,
      workspace_roots: cursorInput.workspace_roots,
      model: cursorInput.model,
    },
  };
}

function hookEnabled(hookId, allowedProfiles = ['standard', 'strict']) {
  const rawProfile = String(process.env.MDT_HOOK_PROFILE || 'standard').toLowerCase();
  const profile = ['minimal', 'standard', 'strict'].includes(rawProfile) ? rawProfile : 'standard';

  const disabled = new Set(
    String(process.env.MDT_DISABLED_HOOKS || '')
      .split(',')
      .map(v => v.trim().toLowerCase())
      .filter(Boolean)
  );

  if (disabled.has(String(hookId || '').toLowerCase())) {
    return false;
  }

  return allowedProfiles.includes(profile);
}

function buildHookEnv(env = process.env) {
  const nextEnv = { ...env };
  if (!nextEnv.MDT_ROOT || !String(nextEnv.MDT_ROOT).trim()) {
    nextEnv.MDT_ROOT = getPluginRoot();
  }
  if (!nextEnv.CURSOR_AGENT || !String(nextEnv.CURSOR_AGENT).trim()) {
    nextEnv.CURSOR_AGENT = '1';
  }
  if (!nextEnv.CONFIG_DIR || !String(nextEnv.CONFIG_DIR).trim()) {
    const cursorRoot = getCursorRoot();
    if (path.basename(cursorRoot).toLowerCase() === '.cursor' && fs.existsSync(cursorRoot)) {
      nextEnv.CONFIG_DIR = cursorRoot;
    }
  }
  return nextEnv;
}

function runExistingHook(scriptName, stdinData, options = {}) {
  const io = options.io || { stderr: process.stderr };
  const runner = options.runner || spawnSync;
  const scriptPath = options.scriptPath || resolveDelegatedHook(scriptName);
  if (!fs.existsSync(scriptPath)) {
    console.error(`[MDT] Delegated hook missing: ${scriptName}`);
    console.error(`[MDT] Expected script path: ${scriptPath}`);
    return;
  }

  const result = runner('node', [scriptPath], {
    input: typeof stdinData === 'string' ? stdinData : JSON.stringify(stdinData),
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 15000,
    cwd: process.cwd(),
    env: buildHookEnv(options.env || process.env),
    encoding: 'utf8'
  });

  if (result.stderr) {
    io.stderr.write(result.stderr);
  }

  if (result.error) {
    const detail = String(result.error.message || '').trim();
    console.error(`[MDT] Delegated hook failed: ${scriptName}`);
    console.error(`[MDT] Script path: ${scriptPath}`);
    if (detail) {
      console.error(`[MDT] ${detail}`);
    }
    return;
  }

  if (result.status === 2) {
    process.exit(2);
  }

  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    console.error(`[MDT] Delegated hook failed: ${scriptName}`);
    console.error(`[MDT] Script path: ${scriptPath}`);
    if (detail) {
      console.error(`[MDT] ${detail.split(/\r?\n/).slice(-1)[0]}`);
    }
  }
}

module.exports = {
  buildHookEnv,
  getCursorRoot,
  getPluginRoot,
  hookEnabled,
  readStdin,
  resolveDelegatedHook,
  resolveRuntimeModule,
  runExistingHook,
  transformToClaude
};

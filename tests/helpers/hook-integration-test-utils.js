const path = require('path');
const { spawn } = require('child_process');
const { buildTestEnv } = require('./test-env-profiles');

/**
 * Run a hook script with simulated Claude Code input.
 */
function runHookWithInput(scriptPath, input = {}, env = {}, timeoutMs = 10000, profile = 'neutral') {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [scriptPath], {
      env: buildTestEnv(profile, env),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => stdout += data);
    proc.stderr.on('data', data => stderr += data);

    // Ignore EPIPE/EOF errors (process may exit before we finish writing).
    proc.stdin.on('error', err => {
      if (err.code !== 'EPIPE' && err.code !== 'EOF') {
        reject(err);
      }
    });

    if (input && Object.keys(input).length > 0) {
      proc.stdin.write(JSON.stringify(input));
    }
    proc.stdin.end();

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`Hook timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('close', code => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    proc.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function parseHookCommand(command, pluginRoot) {
  const inlineMatch = command.match(/^node -e "(.+)"$/s);
  if (inlineMatch) {
    return { cmd: 'node', args: ['-e', inlineMatch[1]] };
  }

  const scriptMatch = command.match(/^node "([^"]+)"(?: (.+))?$/s);
  if (scriptMatch) {
    const scriptPath = scriptMatch[1].replace('${CLAUDE_PLUGIN_ROOT}', pluginRoot);
    const extraArgs = scriptMatch[2] ? scriptMatch[2].trim().split(/\s+/).filter(Boolean) : [];
    return { cmd: 'node', args: [scriptPath, ...extraArgs] };
  }

  throw new Error(`Unsupported hook command format: ${command}`);
}

/**
 * Run a hook command string from hooks.json (`node -e ...` or `node "...js"`).
 */
function runHookCommand(command, input = {}, env = {}, timeoutMs = 10000, pluginRoot = path.join(__dirname, '..', '..'), profile = 'neutral') {
  return new Promise((resolve, reject) => {
    const parsed = parseHookCommand(command, pluginRoot);

    const proc = spawn(parsed.cmd, parsed.args, {
      env: buildTestEnv(profile, env),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timer;

    proc.stdout.on('data', data => stdout += data);
    proc.stderr.on('data', data => stderr += data);

    // Ignore EPIPE errors (process may exit before we finish writing).
    proc.stdin.on('error', err => {
      if (err.code !== 'EPIPE') {
        if (timer) clearTimeout(timer);
        reject(err);
      }
    });

    if (input && Object.keys(input).length > 0) {
      proc.stdin.write(JSON.stringify(input));
    }
    proc.stdin.end();

    timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`Hook command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('close', code => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    proc.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

module.exports = {
  runHookWithInput,
  runHookCommand,
  parseHookCommand
};

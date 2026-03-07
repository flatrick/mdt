const path = require('path');
const { spawn } = require('child_process');
const { withEnv } = require('./env-test-utils');
const { buildTestEnv } = require('./test-env-profiles');

function runScript(scriptPath, input = '', env = {}, profile = 'neutral') {
  return new Promise((resolve, reject) => {
    const merged = buildTestEnv(profile, env);
    const proc = spawn('node', [scriptPath], {
      env: merged,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => stdout += data);
    proc.stderr.on('data', data => stderr += data);

    if (input) {
      proc.stdin.write(input);
    }
    proc.stdin.end();

    proc.on('close', code => {
      resolve({ code, stdout, stderr });
    });

    proc.on('error', reject);
  });
}

// Return the sessions dir that hook scripts use when run with HOME=homeDir
// (tool-agnostic: .cursor, .claude, or .codex).
function getSessionsDirForHome(homeDir, envOverrides = {}) {
  let dir;
  const detectEnvPath = path.resolve(__dirname, '..', '..', 'scripts', 'lib', 'detect-env.js');
  const utilsPath = path.resolve(__dirname, '..', '..', 'scripts', 'lib', 'utils.js');

  withEnv({ HOME: homeDir, USERPROFILE: homeDir, ...envOverrides }, () => {
    delete require.cache[detectEnvPath];
    delete require.cache[utilsPath];
    const utils = require(utilsPath);
    dir = utils.getSessionsDir();
  });

  delete require.cache[detectEnvPath];
  delete require.cache[utilsPath];
  return dir;
}

module.exports = {
  runScript,
  getSessionsDirForHome
};

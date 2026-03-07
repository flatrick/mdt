'use strict';

const { spawnSync } = require('child_process');

const STRICT_ENV_VAR = 'MDT_REQUIRE_SUBPROCESS_TESTS';

function isStrictMode() {
  return process.env[STRICT_ENV_VAR] === '1';
}

function probeNodeSubprocess() {
  try {
    const result = spawnSync('node', ['-e', 'process.stdout.write("ok")'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000
    });

    if (result.error) {
      return { available: false, reason: `spawnSync error: ${result.error.code || result.error.message}` };
    }

    if (typeof result.status === 'number' && result.status !== 0) {
      return { available: false, reason: `probe exited with status ${result.status}` };
    }

    if (result.signal) {
      return { available: false, reason: `probe terminated by signal ${result.signal}` };
    }

    if ((result.stdout || '').trim() !== 'ok') {
      return { available: false, reason: 'probe stdout did not match expected value' };
    }

    return { available: true, reason: '' };
  } catch (error) {
    return { available: false, reason: `probe threw: ${error.code || error.message}` };
  }
}

function ensureSubprocessCapability(suiteLabel) {
  const probe = probeNodeSubprocess();
  if (probe.available) {
    return true;
  }

  const reason = probe.reason || 'unknown reason';
  const message = `[subprocess-check] ${suiteLabel}: nested Node subprocesses unavailable (${reason})`;

  if (isStrictMode()) {
    console.error(`${message}; failing because ${STRICT_ENV_VAR}=1`);
    process.exit(1);
  }

  console.log(`${message}; skipping suite (set ${STRICT_ENV_VAR}=1 to fail instead)`);
  process.exit(0);
}

module.exports = {
  STRICT_ENV_VAR,
  isStrictMode,
  probeNodeSubprocess,
  ensureSubprocessCapability
};

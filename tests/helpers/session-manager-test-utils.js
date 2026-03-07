const path = require('path');
const fs = require('fs');
const os = require('os');

function clearSessionManagerCache() {
  delete require.cache[require.resolve('../../scripts/lib/detect-env')];
  delete require.cache[require.resolve('../../scripts/lib/utils')];
  delete require.cache[require.resolve('../../scripts/lib/session-manager')];
}

function createTempSessionDir() {
  const dir = path.join(os.tmpdir(), `MDT-test-sessions-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

module.exports = {
  clearSessionManagerCache,
  createTempSessionDir,
  cleanup
};

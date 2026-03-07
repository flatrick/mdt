const path = require('path');
const fs = require('fs');
const os = require('os');
const { withEnv } = require('./env-test-utils');

function createAliasesEnvProxy(aliases, envOverrides) {
  return new Proxy(aliases, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value !== 'function') {
        return value;
      }
      return (...args) => withEnv(envOverrides, () => value.apply(target, args));
    }
  });
}

function setupSessionAliasesTestEnv() {
  // Mock config home before requiring module so it binds to isolated temp storage.
  const tmpHome = path.join(os.tmpdir(), `MDT-alias-test-${Date.now()}`);
  fs.mkdirSync(path.join(tmpHome, '.claude'), { recursive: true });
  const envOverrides = { HOME: tmpHome, USERPROFILE: tmpHome }; // Windows: os.homedir() uses USERPROFILE
  const aliases = withEnv(envOverrides, () => require('../../scripts/lib/session-aliases'));
  const isolatedAliases = createAliasesEnvProxy(aliases, envOverrides);

  function resetAliases() {
    const aliasesPath = isolatedAliases.getAliasesPath();
    try {
      if (fs.existsSync(aliasesPath)) {
        fs.unlinkSync(aliasesPath);
      }
    } catch {
      // ignore
    }
  }

  return { aliases: isolatedAliases, resetAliases };
}

module.exports = {
  setupSessionAliasesTestEnv
};

#!/usr/bin/env node
/**
 * Verify required dependencies are installed before running lint/test scripts.
 */

function checkDependencies(required, searchPath = process.cwd()) {
  if (!Array.isArray(required) || required.length === 0) {
    return {
      ok: false,
      message: '[check-dependencies] No dependencies specified.'
    };
  }

  const missing = required.filter(pkg => {
    try {
      require.resolve(`${pkg}/package.json`, { paths: [searchPath] });
      return false;
    } catch {
      return true;
    }
  });

  if (missing.length > 0) {
    return {
      ok: false,
      message: `[check-dependencies] Missing dependencies: ${missing.join(', ')}`,
      hint: '[check-dependencies] Run `npm ci` before running this command.'
    };
  }

  return { ok: true };
}

if (require.main === module) {
  const result = checkDependencies(process.argv.slice(2));
  if (!result.ok) {
    console.error(result.message);
    if (result.hint) {
      console.error(result.hint);
    }
    process.exit(1);
  }
  process.exit(0);
}

module.exports = {
  checkDependencies
};

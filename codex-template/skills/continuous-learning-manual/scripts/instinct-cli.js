#!/usr/bin/env node
/**
 * Instinct CLI - Codex compatibility wrapper for the private runtime.
 */

const path = require('path');

const skillRoot = path.join(__dirname, '..');
const {
  detectProject,
  getHomunculusDir,
  inferInstalledConfigDir
} = require(path.join(skillRoot, 'scripts', 'detect-project.js'));

function loadInstinctCliRuntime() {
  const roots = [
    path.join(skillRoot, '..', '..', '..'),
    path.join(skillRoot, '..', '..')
  ];
  const candidates = [
    ...roots.map(root => path.join(root, 'scripts', 'lib', 'continuous-learning', 'instinct-cli-runtime.js')),
    ...roots.map(root => path.join(root, 'mdt', 'scripts', 'lib', 'continuous-learning', 'instinct-cli-runtime.js'))
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    `Cannot find instinct-cli-runtime.js. Searched:\n${candidates.map(c => '  - ' + c).join('\n')}`
  );
}

const { createInstinctCliRuntime } = loadInstinctCliRuntime();
const runtime = createInstinctCliRuntime({
  entrypointDir: __dirname,
  skillDir: skillRoot,
  detectProject,
  getHomunculusDir,
  inferInstalledConfigDir
});

module.exports = {
  buildCodexEnv: runtime.buildCodexEnv,
  getCliPaths: runtime.getCliPaths
};

if (require.main === module) {
  runtime.main(process.argv.slice(2));
}

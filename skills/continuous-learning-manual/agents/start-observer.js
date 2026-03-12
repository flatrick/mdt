#!/usr/bin/env node
/**
 * Continuous Learning v2 - Observer Agent Launcher
 *
 * Public compatibility wrapper for the private continuous-learning runtime.
 */

const path = require('path');

const skillRoot = path.join(__dirname, '..');
const { detectProject } = require(path.join(skillRoot, 'scripts', 'detect-project.js'));

function loadObserverRuntimeModule() {
  const candidates = [
    path.join(skillRoot, '..', '..', 'scripts', 'lib', 'continuous-learning', 'observer-runtime.js'),
    path.join(skillRoot, '..', '..', 'mdt', 'scripts', 'lib', 'continuous-learning', 'observer-runtime.js')
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    `Cannot find observer-runtime.js. Searched:\n${candidates.map(c => '  - ' + c).join('\n')}`
  );
}

const { createObserverRuntime } = loadObserverRuntimeModule();
const runtime = createObserverRuntime({
  entrypointDir: __dirname,
  skillDir: skillRoot,
  configPath: path.join(skillRoot, 'config.json'),
  detectProject
});

module.exports = runtime;

if (require.main === module) {
  runtime.main(process.argv.slice(2));
}

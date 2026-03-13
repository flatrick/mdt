#!/usr/bin/env node
/**
 * Codex-native explicit continuous-learning workflow.
 *
 * Usage:
 *   node codex-learn.js status
 *   node codex-learn.js capture < summary.txt
 *   node codex-learn.js analyze
 *   node codex-learn.js weekly [--week YYYY-Www]
 */

'use strict';

const path = require('path');

const skillRoot = path.join(__dirname, '..');
const { detectProject, inferInstalledConfigDir } = require(path.join(__dirname, 'detect-project.js'));
const { analyzeObservations, loadObserverConfig } = require(path.join(skillRoot, 'agents', 'start-observer.js'));
const { generateWeeklyRetrospective } = require(path.join(__dirname, 'retrospect-week.js'));

function loadCodexLearnRuntime() {
  const roots = [
    path.join(skillRoot, '..', '..'),
    path.join(skillRoot, '..')
  ];
  const candidates = [
    ...roots.map((root) => path.join(root, 'scripts', 'lib', 'continuous-learning', 'codex-learn-runtime.js')),
    ...roots.map((root) => path.join(root, 'mdt', 'scripts', 'lib', 'continuous-learning', 'codex-learn-runtime.js'))
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try next candidate
    }
  }

  throw new Error(
    `Cannot find codex-learn-runtime.js. Searched:\n${candidates.map((candidate) => `  - ${candidate}`).join('\n')}`
  );
}

const { createCodexLearnRuntime } = loadCodexLearnRuntime();

const runtime = createCodexLearnRuntime({
  detectProject,
  inferInstalledConfigDir,
  analyzeObservations,
  loadObserverConfig,
  generateWeeklyRetrospective,
  entrypointDir: __dirname
});

module.exports = {
  buildCodexEnv: runtime.buildCodexEnv
};

if (require.main === module) {
  runtime.run(process.argv.slice(2)).catch((error) => {
    console.error(error.message || String(error));
    process.exit(1);
  });
}

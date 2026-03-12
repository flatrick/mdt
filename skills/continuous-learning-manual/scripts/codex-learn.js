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
const { createCodexLearnRuntime } = require(path.join(
  skillRoot,
  '..',
  '..',
  'scripts',
  'lib',
  'continuous-learning',
  'codex-learn-runtime.js'
));

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

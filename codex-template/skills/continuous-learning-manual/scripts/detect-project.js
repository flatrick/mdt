#!/usr/bin/env node
/**
 * Continuous Learning v2 - Project Detection
 *
 * Codex compatibility wrapper for the private continuous-learning runtime.
 */

const path = require('path');

function loadProjectDetectionModule() {
  const roots = [
    path.join(__dirname, '..', '..', '..', '..'),
    path.join(__dirname, '..', '..', '..')
  ];
  const candidates = [
    ...roots.map(root => path.join(root, 'scripts', 'lib', 'continuous-learning', 'project-detection.js')),
    ...roots.map(root => path.join(root, 'mdt', 'scripts', 'lib', 'continuous-learning', 'project-detection.js'))
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    `Cannot find project-detection.js. Searched:\n${candidates.map(c => '  - ' + c).join('\n')}`
  );
}

const { createProjectDetection } = loadProjectDetectionModule();
const runtime = createProjectDetection({ entrypointDir: __dirname });

module.exports = runtime;

if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();
  const project = runtime.detectProject(cwd);
  console.log(JSON.stringify(project, null, 2));
}

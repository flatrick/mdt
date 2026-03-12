#!/usr/bin/env node
'use strict';

const path = require('path');

const skillRoot = path.join(__dirname, '..');
const { detectProject } = require(path.join(__dirname, 'detect-project.js'));

function loadRetrospectiveModule() {
  const root = path.join(skillRoot, '..', '..');
  const candidates = [
    path.join(root, 'scripts', 'lib', 'continuous-learning', 'retrospective.js'),
    path.join(root, 'mdt', 'scripts', 'lib', 'continuous-learning', 'retrospective.js')
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    `Cannot find retrospective.js. Searched:\n${candidates.map(c => '  - ' + c).join('\n')}`
  );
}

const { createRetrospectiveRuntime } = loadRetrospectiveModule();
const runtime = createRetrospectiveRuntime({ detectProject });

module.exports = runtime;

if (require.main === module) {
  try {
    runtime.main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message || String(error));
    process.exit(1);
  }
}

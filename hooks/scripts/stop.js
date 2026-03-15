#!/usr/bin/env node
'use strict';

const { hookEnabled, readStdin, runExistingHook, transformToClaude } = require('./adapter');

async function processCursorStop(raw) {
  let input = {};
  try {
    input = JSON.parse(raw || '{}');
  } catch {
    input = {};
  }

  if (hookEnabled('stop:check-console-log', ['standard', 'strict'])) {
    runExistingHook('check-console-log.js', transformToClaude(input));
  }

  return raw;
}

async function main() {
  try {
    const raw = await readStdin();
    const output = await processCursorStop(raw);
    process.stdout.write(output);
  } catch {
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  processCursorStop
};

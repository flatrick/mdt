#!/usr/bin/env node
const { readStdin } = require('./adapter');
readStdin().then(raw => {
  try {
    const input = JSON.parse(raw);
    const agent = input.agent_name || input.agent || 'unknown';
    console.error(`[MDT] Agent completed: ${agent}`);
  } catch (_error) {
    process.stdout.write(raw);
    return;
  }
  process.stdout.write(raw);
}).catch(() => process.exit(0));

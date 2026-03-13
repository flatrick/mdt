#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const CURRENT_DOC_PATHS = [
  'README.md',
  'README.POST-CLONE.md',
  'AGENTS.md',
  'CLAUDE.md',
  'CURSOR.md',
  'CODEX.md',
  'docs/INSTALLATION.md',
  'docs/MIGRATION.md',
  'docs/package-manifest-schema.md',
  'docs/supported-tools.md',
  'docs/token-optimization.md',
  'docs/tools/README.md',
  'docs/tools/claude-code.md',
  'docs/tools/codex.md',
  'docs/tools/cursor.md',
  'docs/tools/local-verification.md',
  'docs/tools/capability-matrix.md',
  'docs/tools/workflow-matrix.md',
  'docs/testing/manual-verification/README.md',
  'docs/testing/manual-verification/claude-code.md',
  'docs/testing/manual-verification/codex.md',
  'docs/testing/manual-verification/cursor.md'
];

function validateDocsConsistency(options = {}) {
  const root = options.rootDir || path.join(__dirname, '../..');
  const io = options.io || { log: console.log, error: console.error };
  const failures = [];

  function read(relPath) {
    return fs.readFileSync(path.join(root, relPath), 'utf8');
  }

  function checkNoPattern(relPath, pattern, message) {
    const content = read(relPath);
    if (pattern.test(content)) {
      failures.push(`${relPath}: ${message}`);
    }
  }

  function checkIncludes(relPath, snippet, message) {
    const content = read(relPath);
    if (!content.includes(snippet)) {
      failures.push(`${relPath}: ${message}`);
    }
  }

  const currentDocs = CURRENT_DOC_PATHS.filter(relPath => fs.existsSync(path.join(root, relPath)));

  for (const relPath of currentDocs) {
    checkNoPattern(relPath, /(^|[^~])\bnode scripts\/mdt\.js\b/m, 'bare `node scripts/mdt.js` is not allowed in current-state docs');
    checkNoPattern(relPath, /\/security-scan\b/, 'current-state docs must not claim `/security-scan` as a universal command');
  }

  for (const relPath of [
    'docs/tools/claude-code.md',
    'docs/tools/codex.md',
    'docs/tools/cursor.md'
  ]) {
    if (fs.existsSync(path.join(root, relPath))) {
      checkIncludes(relPath, 'Tested with version:', 'tool pages must include `Tested with version:`');
      checkNoPattern(relPath, /\|\s*native\s*\|/i, 'nonstandard `native` status label is not allowed');
    }
  }

  for (const relPath of [
    'docs/testing/manual-verification/claude-code.md',
    'docs/testing/manual-verification/codex.md',
    'docs/testing/manual-verification/cursor.md'
  ]) {
    if (fs.existsSync(path.join(root, relPath))) {
      checkIncludes(relPath, 'Last verified:', 'manual verification pages must include `Last verified:`');
      checkIncludes(relPath, 'Tested with version:', 'manual verification pages must include `Tested with version:`');
    }
  }

  if (failures.length > 0) {
    io.error('Docs consistency validation failed:');
    for (const failure of failures) {
      io.error(`- ${failure}`);
    }
    return { exitCode: 1, hasErrors: true, failureCount: failures.length };
  }

  io.log('Docs consistency validation passed');
  return { exitCode: 0, hasErrors: false, failureCount: 0 };
}

if (require.main === module) {
  const result = validateDocsConsistency();
  process.exit(result.exitCode);
}

module.exports = {
  validateDocsConsistency
};

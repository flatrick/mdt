/**
 * Tests for repo hook source layout and native mirror sync.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('../helpers/test-runner');

function listRelativeFiles(dirPath) {
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(path.relative(dirPath, fullPath));
      }
    }
  }

  walk(dirPath);
  return files.sort();
}

function runTests() {
  console.log('\n=== Testing Hook Source Layout ===\n');

  let passed = 0;
  let failed = 0;

  const repoRoot = path.join(__dirname, '..', '..');
  const claudeSource = path.join(repoRoot, 'claude-template', 'hooks.json');
  const claudeMirror = path.join(repoRoot, 'hooks', 'hooks.json');
  const cursorSourceScripts = path.join(repoRoot, 'hooks', 'cursor', 'scripts');
  const cursorMirrorScripts = path.join(repoRoot, 'cursor-template', 'hooks');

  if (test('Claude hook source matches native Claude mirror', () => {
    assert.strictEqual(
      fs.readFileSync(claudeSource, 'utf8'),
      fs.readFileSync(claudeMirror, 'utf8')
    );
  })) passed++; else failed++;

  if (test('Cursor hook source scripts directory exists', () => {
    assert.ok(fs.existsSync(cursorSourceScripts), `Missing cursor hook source scripts: ${cursorSourceScripts}`);
  })) passed++; else failed++;

  if (test('Cursor hook mirror scripts directory does not exist (installer reads from source directly)', () => {
    assert.ok(!fs.existsSync(cursorMirrorScripts), `Unexpected cursor hook mirror found at: ${cursorMirrorScripts}`);
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

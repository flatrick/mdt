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
  const cursorSource = path.join(repoRoot, 'hooks', 'cursor', 'hooks.json');
  const cursorMirror = path.join(repoRoot, 'cursor-template', 'hooks.json');
  const cursorSourceScripts = path.join(repoRoot, 'hooks', 'cursor', 'scripts');
  const cursorMirrorScripts = path.join(repoRoot, 'cursor-template', 'hooks');

  if (test('Claude hook source matches native Claude mirror', () => {
    assert.strictEqual(
      fs.readFileSync(claudeSource, 'utf8'),
      fs.readFileSync(claudeMirror, 'utf8')
    );
  })) passed++; else failed++;

  if (test('Cursor hook source matches native Cursor mirror config', () => {
    assert.strictEqual(
      fs.readFileSync(cursorSource, 'utf8'),
      fs.readFileSync(cursorMirror, 'utf8')
    );
  })) passed++; else failed++;

  if (test('Cursor hook source scripts match native Cursor mirror scripts', () => {
    const sourceFiles = listRelativeFiles(cursorSourceScripts);
    const mirrorFiles = listRelativeFiles(cursorMirrorScripts);

    assert.deepStrictEqual(mirrorFiles, sourceFiles);

    for (const relPath of sourceFiles) {
      assert.strictEqual(
        fs.readFileSync(path.join(cursorSourceScripts, relPath), 'utf8'),
        fs.readFileSync(path.join(cursorMirrorScripts, relPath), 'utf8'),
        `Content mismatch for ${relPath}`
      );
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

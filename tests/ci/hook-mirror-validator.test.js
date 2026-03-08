/**
 * Unit tests for scripts/ci/validate-hook-mirrors.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const {
  validatePlatformMirror,
  validateHookMirrors
} = require('../../scripts/ci/validate-hook-mirrors');

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function runTests() {
  console.log('\n=== Testing hook mirror validator ===\n');

  let passed = 0;
  let failed = 0;

  if (test('validatePlatformMirror passes when source and mirror files match', () => {
    const tempDir = createTestDir('mdt-hook-mirror-');

    try {
      const sourcePath = path.join(tempDir, 'src', 'hooks.json');
      const mirrorPath = path.join(tempDir, 'mirror', 'hooks.json');
      writeFile(sourcePath, '{"hooks":{}}\n');
      writeFile(mirrorPath, '{"hooks":{}}\n');

      const result = validatePlatformMirror({
        name: 'claude',
        sourceConfig: sourcePath,
        mirrorConfig: mirrorPath
      });

      assert.deepStrictEqual(result, { name: 'claude', valid: true, issues: [] });
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('validatePlatformMirror fails when mirror is missing', () => {
    const tempDir = createTestDir('mdt-hook-mirror-');

    try {
      const sourcePath = path.join(tempDir, 'src', 'hooks.json');
      writeFile(sourcePath, '{"hooks":{}}\n');

      const result = validatePlatformMirror({
        name: 'claude',
        sourceConfig: sourcePath,
        mirrorConfig: path.join(tempDir, 'mirror', 'hooks.json')
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.issues.some((issue) => issue.includes('Missing mirror hook config')));
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('validateHookMirrors reports invalid platform mirrors', () => {
    const tempDir = createTestDir('mdt-hook-mirror-');

    try {
      const platforms = {
        claude: {
          name: 'claude',
          sourceConfig: path.join(tempDir, 'src', 'claude-hooks.json'),
          mirrorConfig: path.join(tempDir, 'mirror', 'claude-hooks.json')
        },
        cursor: {
          name: 'cursor',
          sourceConfig: path.join(tempDir, 'src', 'cursor-hooks.json'),
          mirrorConfig: path.join(tempDir, 'mirror', 'cursor-hooks.json')
        }
      };

      writeFile(platforms.claude.sourceConfig, '{"hooks":{}}\n');
      writeFile(platforms.claude.mirrorConfig, '{"hooks":{}}\n');
      writeFile(platforms.cursor.sourceConfig, '{"hooks":{"Stop":[]}}\n');
      writeFile(platforms.cursor.mirrorConfig, '{"hooks":{"Stop":[1]}}\n');

      const result = validateHookMirrors(platforms);

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.results.length, 2);
      const cursor = result.results.find((item) => item.name === 'cursor');
      assert.ok(cursor, 'cursor result should exist');
      assert.strictEqual(cursor.valid, false);
      assert.ok(cursor.issues.some((issue) => issue.includes('out of sync')));
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

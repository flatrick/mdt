/**
 * Unit tests for scripts/sync-hook-mirrors.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');

const {
  syncHookMirrors
} = require('../../scripts/sync-hook-mirrors');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function runTests() {
  console.log('\n=== Testing sync-hook-mirrors.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('syncHookMirrors copies configs and scripts and removes stale mirrored scripts', () => {
    const tempDir = createTestDir('mdt-hook-mirrors-');

    try {
      const platforms = {
        claude: {
          sourceConfig: path.join(tempDir, 'hooks', 'claude', 'hooks.json'),
          mirrorConfig: path.join(tempDir, 'hooks', 'hooks.json'),
          sourceScriptsDir: null,
          mirrorScriptsDir: null
        },
        cursor: {
          sourceConfig: path.join(tempDir, 'hooks', 'cursor', 'hooks.json'),
          mirrorConfig: path.join(tempDir, 'cursor-template', 'hooks.json'),
          sourceScriptsDir: path.join(tempDir, 'hooks', 'cursor', 'scripts'),
          mirrorScriptsDir: path.join(tempDir, 'cursor-template', 'hooks')
        }
      };

      writeJson(platforms.claude.sourceConfig, { hooks: { PreToolUse: [] } });
      writeJson(platforms.cursor.sourceConfig, { version: 1, hooks: { stop: [] } });
      writeFile(path.join(platforms.cursor.sourceScriptsDir, 'adapter.js'), 'module.exports = "adapter";\n');
      writeFile(path.join(platforms.cursor.sourceScriptsDir, 'nested', 'child.js'), 'module.exports = "child";\n');
      writeFile(path.join(platforms.cursor.mirrorScriptsDir, 'stale.js'), 'stale\n');

      syncHookMirrors({ platforms });

      assert.deepStrictEqual(
        JSON.parse(fs.readFileSync(platforms.claude.mirrorConfig, 'utf8')),
        { hooks: { PreToolUse: [] } }
      );
      assert.deepStrictEqual(
        JSON.parse(fs.readFileSync(platforms.cursor.mirrorConfig, 'utf8')),
        { version: 1, hooks: { stop: [] } }
      );
      assert.strictEqual(
        fs.readFileSync(path.join(platforms.cursor.mirrorScriptsDir, 'adapter.js'), 'utf8'),
        'module.exports = "adapter";\n'
      );
      assert.strictEqual(
        fs.readFileSync(path.join(platforms.cursor.mirrorScriptsDir, 'nested', 'child.js'), 'utf8'),
        'module.exports = "child";\n'
      );
      assert.ok(!fs.existsSync(path.join(platforms.cursor.mirrorScriptsDir, 'stale.js')), 'stale mirror script should be removed');
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

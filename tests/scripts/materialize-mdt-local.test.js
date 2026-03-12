const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { ensureSubprocessCapability } = require('../helpers/subprocess-capability');

function runMaterializer(args, options = {}) {
  const repoRoot = path.join(__dirname, '..', '..');
  const scriptPath = path.join(repoRoot, 'scripts', 'materialize-mdt-local.js');
  return spawnSync('node', [scriptPath, ...args], {
    encoding: 'utf8',
    cwd: options.cwd || repoRoot,
    env: { ...process.env, ...(options.env || {}) },
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 20000
  });
}

function runTests() {
  console.log('\n=== Testing materialize-mdt-local.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('materializes cursor rules into project .cursor/rules and records bridge decision', () => {
    const tmpHome = createTestDir('mdt-local-bridge-home-');
    const tmpProject = createTestDir('mdt-local-bridge-proj-');
    const cursorRoot = path.join(tmpHome, '.cursor');

    try {
      fs.writeFileSync(path.join(tmpProject, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf8');

      const result = runMaterializer(
        ['--target', 'cursor', '--surface', 'rules', '--repo', tmpProject, '--override', cursorRoot, 'typescript'],
        {
          env: {
            HOME: tmpHome,
            USERPROFILE: tmpHome
          }
        }
      );

      assert.strictEqual(result.status, 0, `materializer should succeed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
      assert.ok(fs.existsSync(path.join(tmpProject, '.cursor', 'rules', 'typescript-coding-style.md')));
      assert.ok(fs.existsSync(path.join(tmpProject, '.cursor', 'rules', 'common-coding-style.md')));

      const statePath = path.join(cursorRoot, 'mdt', 'bridge-decisions.json');
      assert.ok(fs.existsSync(statePath));
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      const projectEntry = Object.values(state.projects)[0];
      assert.strictEqual(projectEntry.root, tmpProject);
      assert.strictEqual(projectEntry.surfaces['cursor.rules'].decision, 'installed');
    } finally {
      cleanupTestDir(tmpHome);
      cleanupTestDir(tmpProject);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

ensureSubprocessCapability('tests/scripts/materialize-mdt-local.test.js');
runTests();

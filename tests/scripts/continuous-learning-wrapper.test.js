const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test } = require('../helpers/test-runner');

const repoRoot = path.join(__dirname, '..', '..');

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function withInstalledCodexLayout(wrapperSourcePath, callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdt-codex-wrapper-'));
  const codexRoot = path.join(tempDir, '.codex');
  const skillRoot = path.join(codexRoot, 'skills', 'continuous-learning-manual');
  const wrapperPath = path.join(skillRoot, 'scripts', 'codex-learn.js');
  const runtimePath = path.join(codexRoot, 'mdt', 'scripts', 'lib', 'continuous-learning', 'codex-learn-runtime.js');

  try {
    writeFile(wrapperPath, fs.readFileSync(wrapperSourcePath, 'utf8'));
    writeFile(
      path.join(skillRoot, 'scripts', 'detect-project.js'),
      'module.exports = { detectProject: () => ({}), inferInstalledConfigDir: () => null };\n'
    );
    writeFile(
      path.join(skillRoot, 'scripts', 'retrospect-week.js'),
      'module.exports = { generateWeeklyRetrospective: () => ({ text: "", outputPath: "" }) };\n'
    );
    writeFile(
      path.join(skillRoot, 'agents', 'start-observer.js'),
      'module.exports = { analyzeObservations: () => null, loadObserverConfig: () => ({}) };\n'
    );
    writeFile(
      runtimePath,
      [
        'module.exports = {',
        '  createCodexLearnRuntime: () => ({',
        '    buildCodexEnv: () => ({ ok: true }),',
        '    run: async () => {}',
        '  })',
        '};',
        ''
      ].join('\n')
    );

    callback(wrapperPath);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function runTests() {
  console.log('\n=== Testing continuous-learning wrappers ===\n');

  let passed = 0;
  let failed = 0;

  if (test('shared codex-learn wrapper resolves runtime from installed mdt path', () => {
    const wrapperSourcePath = path.join(repoRoot, 'skills', 'continuous-learning-manual', 'scripts', 'codex-learn.js');
    withInstalledCodexLayout(wrapperSourcePath, (wrapperPath) => {
      const loaded = require(wrapperPath);
      assert.strictEqual(typeof loaded.buildCodexEnv, 'function');
    });
  })) passed++; else failed++;

  if (test('codex-template codex-learn wrapper resolves runtime from installed mdt path', () => {
    const wrapperSourcePath = path.join(repoRoot, 'codex-template', 'skills', 'continuous-learning-manual', 'scripts', 'codex-learn.js');
    withInstalledCodexLayout(wrapperSourcePath, (wrapperPath) => {
      const loaded = require(wrapperPath);
      assert.strictEqual(typeof loaded.buildCodexEnv, 'function');
    });
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

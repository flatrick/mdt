const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { probeNodeSubprocess } = require('../helpers/subprocess-capability');
const {
  cleanupInstall,
  ensureFile,
  installTarget,
  repoRoot,
  runNodeScript
} = require('./shared-fixtures');

function runTests() {
  console.log('\n=== Compatibility Testing: Cursor IDE ===\n');

  const probe = probeNodeSubprocess();
  if (!probe.available) {
    console.log(`[subprocess-check] nested Node subprocesses unavailable (${probe.reason}); skipping suite`);
    console.log('\nPassed: 0');
    console.log('Failed: 0');
    console.log('Total:  0\n');
    process.exit(0);
  }

  let passed = 0;
  let failed = 0;

  if (test('Cursor IDE compatibility keeps the repo-local rules bridge separate from global install', () => {
    const fixture = installTarget('cursor', ['continuous-learning', 'typescript']);
    const repoDir = createTestDir('cursor-ide-compat-repo-');

    try {
      const scriptPath = path.join(fixture.overrideRoot, 'mdt', 'scripts', 'materialize-mdt-local.js');
      ensureFile(path.join(fixture.overrideRoot, 'commands', 'install-rules.md'));
      ensureFile(scriptPath);

      const result = runNodeScript(
        scriptPath,
        ['--target', 'cursor', '--surface', 'rules', '--repo', repoDir, '--override', fixture.overrideRoot],
        {
          cwd: repoRoot,
          env: fixture.env
        }
      );

      if (result.status !== 0) {
        throw new Error(`${result.stdout}\n${result.stderr}`);
      }

      ensureFile(path.join(repoDir, '.cursor', 'rules', 'common-coding-style.mdc'));
    } finally {
      cleanupInstall(fixture);
      cleanupTestDir(repoDir);
    }
  })) passed++; else failed++;

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

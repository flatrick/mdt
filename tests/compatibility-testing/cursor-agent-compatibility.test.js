const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { probeNodeSubprocess } = require('../helpers/subprocess-capability');
const { smokeToolSetups } = require('../../scripts/smoke-tool-setups');
const {
  cleanupInstall,
  ensureFile,
  installTarget,
  repoRoot,
  runNodeScript
} = require('./shared-fixtures');

function runTests() {
  console.log('\n=== Compatibility Testing: Cursor Agent ===\n');

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

  if (test('installed Cursor dev surface includes smoke and install-rules commands', () => {
    const fixture = installTarget('cursor', ['--dev', 'continuous-learning']);

    try {
      ensureFile(path.join(fixture.overrideRoot, 'commands', 'smoke.md'));
      ensureFile(path.join(fixture.overrideRoot, 'commands', 'install-rules.md'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'smoke-tool-setups.js'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'materialize-mdt-local.js'));
    } finally {
      cleanupInstall(fixture);
    }
  })) passed++; else failed++;

  if (test('installed Cursor surface still reports smoke-tool probe coverage', () => {
    const output = [];
    const result = smokeToolSetups({
      io: {
        log: message => output.push(String(message))
      },
      spawnImpl: (command) => {
        if (command === 'cursor-agent') {
          return { status: 0, stdout: 'cursor-agent 1.0.0' };
        }
        if (command === 'codex') {
          return { error: Object.assign(new Error('not installed'), { code: 'ENOENT' }) };
        }
        if (command === 'claude') {
          return { error: Object.assign(new Error('not installed'), { code: 'ENOENT' }) };
        }
        return { error: Object.assign(new Error(`unexpected command ${command}`), { code: 'ENOENT' }) };
      }
    });

    assert.strictEqual(result.exitCode, 0, output.join('\n'));
    assert.ok(output.join('\n').includes('- cursor: PASS'));
  })) passed++; else failed++;

  if (test('installed /install-rules bridge copies global rules into a repo-local .cursor/rules surface', () => {
    const fixture = installTarget('cursor', ['continuous-learning']);
    const repoDir = createTestDir('cursor-agent-compat-repo-');

    try {
      fs.writeFileSync(path.join(repoDir, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf8');
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'materialize-mdt-local.js'));
      fs.writeFileSync(path.join(fixture.overrideRoot, 'rules', 'common-coding-style.mdc'), '# common', 'utf8');
      fs.writeFileSync(path.join(fixture.overrideRoot, 'rules', 'typescript-coding-style.mdc'), '# ts', 'utf8');

      const scriptPath = path.join(fixture.overrideRoot, 'mdt', 'scripts', 'materialize-mdt-local.js');
      const result = runNodeScript(
        scriptPath,
        ['--target', 'cursor', '--surface', 'rules', '--repo', repoDir, '--override', fixture.overrideRoot],
        {
          cwd: repoRoot,
          env: fixture.env
        }
      );

      assert.strictEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
      ensureFile(path.join(repoDir, '.cursor', 'rules', 'common-coding-style.mdc'));
      ensureFile(path.join(repoDir, '.cursor', 'rules', 'typescript-coding-style.mdc'));
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

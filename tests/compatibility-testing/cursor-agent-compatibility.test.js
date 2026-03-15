const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { probeNodeSubprocess } = require('../helpers/subprocess-capability');
const {
  cleanupInstall,
  createCliShimBin,
  ensureFile,
  installTarget,
  prependPath,
  repoRoot,
  runInstalledMdt,
  runNodeScript
} = require('./shared-fixtures');

function runTests() {
  console.log('\n=== Compatibility Testing: Cursor Agent ===\n');

  const probe = probeNodeSubprocess();
  if (!probe.available) {
    console.log(`[subprocess-check] nested Node subprocesses unavailable (${probe.reason}); skipping suite`);
    console.log('\nPassed: 0');
    console.log('Skipped: 1');
    console.log('Failed: 0');
    console.log('Total:  1\n');
    process.exit(0);
  }

  let passed = 0;
  let failed = 0;

  if (test('installed Cursor dev surface includes mdt-dev-smoke and install-rules commands', () => {
    const fixture = installTarget('cursor', ['--dev', 'typescript', 'ai-learning']);

    try {
      ensureFile(path.join(fixture.overrideRoot, 'commands', 'mdt-dev-smoke.md'));
      ensureFile(path.join(fixture.overrideRoot, 'commands', 'install-rules.md'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'mdt-dev-smoke-tool-setups.js'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'materialize-mdt-local.js'));
    } finally {
      cleanupInstall(fixture);
    }
  })) passed++; else failed++;

  if (test('installed Cursor surface runs isolated smoke through the installed wrapper', () => {
    const fixture = installTarget('cursor', ['--dev', 'typescript', 'ai-learning']);
    const shimBin = createCliShimBin({
      agent: {
        '--help': 'agent help'
      },
      'cursor-agent': {
        '--help': 'cursor-agent help'
      }
    });

    try {
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'mdt-dev-smoke-tool-setups.js'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'mdt-dev-smoke-cursor-workflows.js'));

      const smokeSetup = runInstalledMdt(
        fixture,
        ['dev', 'smoke', 'tool-setups', '--tool', 'cursor'],
        {
          cwd: repoRoot,
          env: prependPath(shimBin, fixture.env)
        }
      );
      assert.strictEqual(smokeSetup.status, 0, `${smokeSetup.stdout}\n${smokeSetup.stderr}`);
      assert.ok(smokeSetup.stdout.includes('- cursor: PASS'));
      assert.ok(!smokeSetup.stdout.includes('- claude:'));
      assert.ok(!smokeSetup.stdout.includes('- codex:'));

      const workflowSmoke = runInstalledMdt(
        fixture,
        ['dev', 'smoke', 'workflows', '--tool', 'cursor'],
        {
          cwd: repoRoot,
          env: prependPath(shimBin, fixture.env)
        }
      );
      assert.strictEqual(workflowSmoke.status, 0, `${workflowSmoke.stdout}\n${workflowSmoke.stderr}`);
      assert.ok(workflowSmoke.stdout.includes('Cursor workflow dev smoke (installed-target mode):'));
      assert.ok(workflowSmoke.stdout.includes('mdt-dev-smoke: PASS'));
    } finally {
      cleanupTestDir(shimBin);
      cleanupInstall(fixture);
    }
  })) passed++; else failed++;

  if (test('installed /install-rules bridge copies global rules into a repo-local .cursor/rules surface', () => {
    const fixture = installTarget('cursor', ['ai-learning']);
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

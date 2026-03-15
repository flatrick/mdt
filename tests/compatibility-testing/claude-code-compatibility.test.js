const assert = require('assert');
const path = require('path');
const { test } = require('../helpers/test-runner');
const { probeNodeSubprocess } = require('../helpers/subprocess-capability');
const {
  cleanupInstall,
  createCliShimBin,
  ensureFile,
  installTarget,
  prependPath,
  repoRoot,
  runInstalledMdt
} = require('./shared-fixtures');

function runTests() {
  console.log('\n=== Compatibility Testing: Claude Code ===\n');

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

  if (test('installed Claude dev surface runs isolated smoke through the installed wrapper', () => {
    const fixture = installTarget('claude', ['--dev', 'typescript', 'ai-learning']);
    const shimBin = createCliShimBin({
      claude: {
        '--version': 'Claude Code 2.1.73',
        '--help': 'Claude help'
      }
    });

    try {
      ensureFile(path.join(fixture.overrideRoot, 'commands', 'mdt-dev-smoke.md'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'mdt-dev-smoke-claude-workflows.js'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'mdt-dev-smoke-tool-setups.js'));

      const smokeSetup = runInstalledMdt(
        fixture,
        ['dev', 'smoke', 'tool-setups', '--tool', 'claude'],
        {
          cwd: repoRoot,
          env: prependPath(shimBin, fixture.env)
        }
      );
      assert.strictEqual(smokeSetup.status, 0, `${smokeSetup.stdout}\n${smokeSetup.stderr}`);
      assert.ok(smokeSetup.stdout.includes('- claude: PASS'));
      assert.ok(!smokeSetup.stdout.includes('- cursor:'));
      assert.ok(!smokeSetup.stdout.includes('- codex:'));

      const workflowSmoke = runInstalledMdt(
        fixture,
        ['dev', 'smoke', 'workflows', '--tool', 'claude'],
        {
          cwd: repoRoot,
          env: prependPath(shimBin, fixture.env)
        }
      );
      assert.strictEqual(workflowSmoke.status, 0, `${workflowSmoke.stdout}\n${workflowSmoke.stderr}`);
      assert.ok(workflowSmoke.stdout.includes('Claude workflow dev smoke (installed-target mode):'));
      assert.ok(workflowSmoke.stdout.includes('mdt-dev-smoke: PASS'));
      assert.ok(workflowSmoke.stdout.includes('verify: PASS'));
    } finally {
      require('../helpers/test-runner').cleanupTestDir(shimBin);
      cleanupInstall(fixture);
    }
  })) passed++; else failed++;

  if (test('installed Claude hook surface retains continuous-learning automatic hook path', () => {
    const fixture = installTarget('claude', ['ai-learning']);

    try {
      ensureFile(path.join(fixture.overrideRoot, 'skills', 'ai-learning', 'hooks', 'observe.js'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'lib', 'continuous-learning', 'project-detection.js'));
    } finally {
      cleanupInstall(fixture);
    }
  })) passed++; else failed++;

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

const assert = require('assert');
const fs = require('fs');
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
  console.log('\n=== Compatibility Testing: Codex ===\n');

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

  if (test('installed Codex dev surface runs isolated smoke through the installed wrapper', () => {
    const fixture = installTarget('codex', ['--dev', 'typescript', 'ai-learning']);
    const shimBin = createCliShimBin({
      codex: {
        '--version': 'codex-cli 1.0.0',
        '--help': 'Codex help'
      }
    });

    try {
      ensureFile(path.join(fixture.overrideRoot, 'skills', 'mdt-dev-smoke', 'SKILL.md'));
      ensureFile(path.join(fixture.overrideRoot, 'skills', 'tdd-workflow', 'SKILL.md'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'mdt-dev-smoke-codex-workflows.js'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'mdt-dev-smoke-tool-setups.js'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'workflow-contracts', 'metadata.json'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'workflow-contracts', 'workflows', 'mdt-dev-smoke.json'));

      const smokeSetup = runInstalledMdt(
        fixture,
        ['dev', 'smoke', 'tool-setups', '--tool', 'codex'],
        {
          cwd: repoRoot,
          env: prependPath(shimBin, fixture.env)
        }
      );
      assert.strictEqual(smokeSetup.status, 0, `${smokeSetup.stdout}\n${smokeSetup.stderr}`);
      assert.ok(smokeSetup.stdout.includes('- codex: PASS'));
      assert.ok(!smokeSetup.stdout.includes('- claude:'));
      assert.ok(!smokeSetup.stdout.includes('- cursor:'));

      const workflowSmoke = runInstalledMdt(
        fixture,
        ['dev', 'smoke', 'workflows', '--tool', 'codex'],
        {
          cwd: repoRoot,
          env: prependPath(shimBin, fixture.env)
        }
      );
      assert.strictEqual(workflowSmoke.status, 0, `${workflowSmoke.stdout}\n${workflowSmoke.stderr}`);
      assert.ok(workflowSmoke.stdout.includes('Codex workflow dev smoke (installed-target mode):'));
      assert.ok(workflowSmoke.stdout.includes('mdt-dev-smoke: PASS'));
      assert.ok(workflowSmoke.stdout.includes('verify: PASS'));
    } finally {
      require('../helpers/test-runner').cleanupTestDir(shimBin);
      cleanupInstall(fixture);
    }
  })) passed++; else failed++;

  if (test('installed Codex wrapper fails clearly when the selected workflow smoke script is missing', () => {
    const fixture = installTarget('codex', ['--dev', 'typescript', 'ai-learning']);

    try {
      const missingScript = path.join(fixture.overrideRoot, 'mdt', 'scripts', 'mdt-dev-smoke-codex-workflows.js');
      fs.rmSync(missingScript);

      const result = runInstalledMdt(
        fixture,
        ['dev', 'smoke', 'workflows', '--tool', 'codex'],
        {
          cwd: repoRoot
        }
      );

      assert.strictEqual(result.status, 1, `${result.stdout}\n${result.stderr}`);
      assert.ok((result.stderr || result.stdout).includes('smoke-codex-workflows'));
    } finally {
      cleanupInstall(fixture);
    }
  })) passed++; else failed++;

  if (test('installed Codex observer surface keeps the extracted runtime reachable', () => {
    const fixture = installTarget('codex', ['ai-learning', 'continuous-learning-observer']);

    try {
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'codex-observer.js'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'lib', 'detached-process-lifecycle.js'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'lib', 'continuous-learning', 'observer-runtime.js'));
      ensureFile(path.join(fixture.overrideRoot, 'skills', 'ai-learning', 'agents', 'start-observer.js'));
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

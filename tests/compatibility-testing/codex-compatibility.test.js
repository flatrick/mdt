const assert = require('assert');
const path = require('path');
const { test } = require('../helpers/test-runner');
const { probeNodeSubprocess } = require('../helpers/subprocess-capability');
const { smokeToolSetups } = require('../../scripts/smoke-tool-setups');
const {
  cleanupInstall,
  ensureFile,
  installTarget
} = require('./shared-fixtures');

function runTests() {
  console.log('\n=== Compatibility Testing: Codex ===\n');

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

  if (test('installed Codex dev surface includes smoke assets and passes Codex CLI smoke probes', () => {
    const fixture = installTarget('codex', ['--dev', 'typescript', 'continuous-learning']);

    try {
      ensureFile(path.join(fixture.overrideRoot, 'skills', 'smoke', 'SKILL.md'));
      ensureFile(path.join(fixture.overrideRoot, 'skills', 'tdd-workflow', 'SKILL.md'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'smoke-codex-workflows.js'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'smoke-tool-setups.js'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'workflow-contracts', 'metadata.json'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'workflow-contracts', 'workflows', 'smoke.json'));

      const output = [];
      const result = smokeToolSetups({
        io: {
          log: message => output.push(String(message))
        },
        spawnImpl: (command) => {
          if (command === 'codex') {
            return { status: 0, stdout: 'codex-cli 1.0.0' };
          }
          return { error: Object.assign(new Error(`${command} not installed`), { code: 'ENOENT' }) };
        }
      });

      assert.strictEqual(result.exitCode, 0, output.join('\n'));
      assert.ok(output.join('\n').includes('- codex: PASS'));
    } finally {
      cleanupInstall(fixture);
    }
  })) passed++; else failed++;

  if (test('installed Codex observer surface keeps the extracted runtime reachable', () => {
    const fixture = installTarget('codex', ['continuous-learning', 'continuous-learning-observer']);

    try {
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'codex-observer.js'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'lib', 'detached-process-lifecycle.js'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'lib', 'continuous-learning', 'observer-runtime.js'));
      ensureFile(path.join(fixture.overrideRoot, 'skills', 'continuous-learning-manual', 'agents', 'start-observer.js'));
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

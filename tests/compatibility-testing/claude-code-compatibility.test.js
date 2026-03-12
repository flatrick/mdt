const assert = require('assert');
const path = require('path');
const { test } = require('../helpers/test-runner');
const { probeNodeSubprocess } = require('../helpers/subprocess-capability');
const { smokeClaudeWorkflows } = require('../../scripts/smoke-claude-workflows');
const {
  cleanupInstall,
  ensureFile,
  installTarget
} = require('./shared-fixtures');

function runTests() {
  console.log('\n=== Compatibility Testing: Claude Code ===\n');

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

  if (test('installed Claude dev surface passes workflow smoke in installed-target mode', () => {
    const fixture = installTarget('claude', ['--dev', 'typescript', 'continuous-learning']);

    try {
      ensureFile(path.join(fixture.overrideRoot, 'commands', 'smoke.md'));
      ensureFile(path.join(fixture.overrideRoot, 'mdt', 'scripts', 'smoke-claude-workflows.js'));

      const output = [];
      const result = smokeClaudeWorkflows({
        rootDir: path.dirname(fixture.overrideRoot),
        io: {
          log: message => output.push(String(message))
        },
        spawnImpl: () => ({ status: 0, stdout: '2.1.71' })
      });

      assert.strictEqual(result.exitCode, 0, output.join('\n'));
      assert.ok(output.join('\n').includes('installed-target'));
      assert.ok(output.join('\n').includes('smoke: PASS'));
      assert.ok(output.join('\n').includes('verify: PASS'));
    } finally {
      cleanupInstall(fixture);
    }
  })) passed++; else failed++;

  if (test('installed Claude hook surface retains continuous-learning automatic hook path', () => {
    const fixture = installTarget('claude', ['continuous-learning']);

    try {
      ensureFile(path.join(fixture.overrideRoot, 'skills', 'continuous-learning-automatic', 'hooks', 'observe.js'));
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

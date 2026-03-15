const assert = require('assert');
const { probeNodeSubprocess } = require('../helpers/subprocess-capability');
const { summarizeTool } = require('../../scripts/mdt-dev-smoke-tool-setups');
const { TOOL_WORKFLOW_CONTRACT } = require('../../scripts/lib/tool-workflow-contract');
const { test, skipTest } = require('../helpers/test-runner');
const {
  cleanupInstall,
  installTarget,
  repoRoot,
  runInstalledMdt
} = require('./shared-fixtures');

const LIVE_TOOL_FIXTURES = {
  claude: {
    target: 'claude',
    packages: ['--dev', 'typescript', 'ai-learning']
  },
  cursor: {
    target: 'cursor',
    packages: ['--dev', 'typescript', 'ai-learning']
  },
  codex: {
    target: 'codex',
    packages: ['--dev', 'typescript', 'ai-learning']
  }
};

function runTests() {
  console.log('\n=== Compatibility Testing: Live Tool Smoke ===\n');

  const probe = probeNodeSubprocess();
  if (!probe.available) {
    console.log(`[subprocess-check] nested Node subprocesses unavailable (${probe.reason}); skipping suite`);
    process.exit(0);
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const tool of Object.keys(LIVE_TOOL_FIXTURES)) {
    const result = test(`${tool} live smoke contract`, () => {
      const summary = summarizeTool(tool, TOOL_WORKFLOW_CONTRACT.smokeProbes[tool] || []);
      const probeDetails = summary.probes.map((p) => `${p.command}: ${p.detail}`).join('; ');

      if (summary.status === 'SKIP') {
        skipTest(probeDetails);
      }

      if (summary.status === 'FAIL') {
        throw new Error(probeDetails);
      }

      const fixtureConfig = LIVE_TOOL_FIXTURES[tool];
      const fixture = installTarget(fixtureConfig.target, fixtureConfig.packages);
      try {
        const setup = runInstalledMdt(
          fixture,
          ['dev', 'smoke', 'tool-setups', '--tool', tool],
          { cwd: repoRoot }
        );
        assert.strictEqual(setup.status, 0, `${setup.stdout}\n${setup.stderr}`);

        const workflow = runInstalledMdt(
          fixture,
          ['dev', 'smoke', 'workflows', '--tool', tool],
          { cwd: repoRoot }
        );
        assert.strictEqual(workflow.status, 0, `${workflow.stdout}\n${workflow.stderr}`);
      } finally {
        cleanupInstall(fixture);
      }
    });

    if (result === true) passed++;
    else if (result === null) skipped++;
    else failed++;
  }

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total:  ${passed + failed + skipped}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

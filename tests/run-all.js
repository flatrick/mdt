#!/usr/bin/env node
/**
 * Run all tests
 *
 * Usage: node tests/run-all.js [--profile <neutral|claude|cursor|codex|gemini>]
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { ensureSubprocessCapability } = require('./helpers/subprocess-capability');
const { buildTestEnv } = require('./helpers/test-env-profiles');

ensureSubprocessCapability('tests/run-all.js');

const testsDir = __dirname;
const parsedTimeoutMs = parseInt(process.env.MDT_TEST_SUITE_TIMEOUT_MS || '60000', 10);
const SUITE_TIMEOUT_MS = Number.isFinite(parsedTimeoutMs) && parsedTimeoutMs > 0 ? parsedTimeoutMs : 60000;

function parseRequestedProfile(argv, env) {
  const profileFromArg = argv.find((arg) => arg.startsWith('--profile='));
  if (profileFromArg) {
    const value = profileFromArg.slice('--profile='.length).trim();
    if (value) {
      return {
        profile: value,
        profileOverrideSource: '--profile'
      };
    }
  }

  const profileFlagIndex = argv.indexOf('--profile');
  if (profileFlagIndex >= 0) {
    const value = (argv[profileFlagIndex + 1] || '').trim();
    if (value) {
      return {
        profile: value,
        profileOverrideSource: '--profile'
      };
    }
  }

  if (env.MDT_TEST_ENV_PROFILE) {
    return {
      profile: env.MDT_TEST_ENV_PROFILE,
      profileOverrideSource: 'MDT_TEST_ENV_PROFILE'
    };
  }

  return {
    profile: 'neutral',
    profileOverrideSource: 'none'
  };
}

function isDebugModeEnabled(env) {
  return env.MDT_TEST_ENV_DEBUG === '1';
}

const { profile: requestedProfile, profileOverrideSource } = parseRequestedProfile(process.argv.slice(2), process.env);
const debugModeEnabled = isDebugModeEnabled(process.env);

if (debugModeEnabled) {
  const detectionKeys = ['CURSOR_AGENT', 'CLAUDE_SESSION_ID', 'CLAUDE_CODE', 'CURSOR_TRACE_ID'];
  const debugLine = (label, value) => `${label.padEnd(24)}: ${value}`;

  console.log('[MDT test preflight]');
  console.log(debugLine('selected profile', requestedProfile));
  console.log(debugLine('profile override source', profileOverrideSource));
  for (const key of detectionKeys) {
    const value = process.env[key];
    console.log(debugLine(key, value && value.length > 0 ? value : '<unset>'));
  }
  console.log();
}

try {
  buildTestEnv(requestedProfile);
} catch (error) {
  console.error(`✗ Invalid MDT_TEST_ENV_PROFILE: ${requestedProfile}`);
  console.error(`  ${error.message}`);
  process.exit(1);
}
const testFiles = [
  'helpers/test-env-profiles.test.js',
  'lib/detect-env.test.js',
  'lib/continuous-learning-runtime-context.test.js',
  'lib/continuous-learning-project-detection.test.js',
  'lib/detached-process-lifecycle.test.js',
  'lib/continuous-learning-observer-runtime.test.js',
  'lib/utils.test.js',
  'lib/utils-rounds.test.js',
  'lib/utils-rounds-2.test.js',
  'lib/package-manager.test.js',
  'lib/package-manager-rounds.test.js',
  'lib/session-manager.test.js',
  'lib/session-manager-rounds.test.js',
  'lib/session-manager-rounds-2.test.js',
  'lib/session-aliases.test.js',
  'lib/session-aliases-rounds.test.js',
  'lib/session-aliases-rounds-2.test.js',
  'lib/project-detect.test.js',
  'hooks/hooks.test.js',
  'hooks/hook-layout.test.js',
  'hooks/hooks-post-edit.test.js',
  'hooks/cursor-lifecycle.test.js',
  'hooks/hooks-rounds.test.js',
  'hooks/hooks-rounds-3.test.js',
  'hooks/hooks-rounds-4.test.js',
  'hooks/hooks-rounds-2.test.js',
  'hooks/command-hooks.test.js',
  'hooks/evaluate-session.test.js',
  'hooks/suggest-compact.test.js',
  'integration/hooks.test.js',
  'ci/validators.test.js',
  'ci/metadata-validator.test.js',
  'ci/markdown-links-validator.test.js',
  'ci/markdown-path-refs-validator.test.js',
  'ci/schema-contracts.test.js',
  'ci/hook-mirror-validator.test.js',
  'ci/validators-rounds.test.js',
  'ci/validators-rounds-3.test.js',
  'ci/validators-rounds-2.test.js',
  'compatibility-testing/codex-compatibility.test.js',
  'compatibility-testing/claude-code-compatibility.test.js',
  'compatibility-testing/cursor-agent-compatibility.test.js',
  'compatibility-testing/cursor-ide-compatibility.test.js',
  'scripts/check-dependencies.test.js',
  'scripts/hook-platforms.test.js',
  'scripts/codex-observer.test.js',
  'scripts/continuous-learning-observer.test.js',
  'scripts/detect-project.test.js',
  'scripts/instinct-cli.test.js',
  'scripts/continuous-learning-retrospective.test.js',
  'scripts/materialize-mdt-local-unit.test.js',
  'scripts/install-mdt-unit.test.js',
  'scripts/install-mdt.test.js',
  'scripts/run-with-flags.test.js',
  'scripts/setup-package-manager.test.js',
  'scripts/tool-workflow-contract.test.js',
  'scripts/smoke-claude-workflows.test.js',
  'scripts/smoke-codex-workflows.test.js',
  'scripts/smoke-tool-setups.test.js',
  'scripts/sync-hook-mirrors.test.js',
  'scripts/verify-tool-setups.test.js',
  'scripts/skill-create-output.test.js',
  'scripts/node-runtime-scripts.test.js'
];

const BOX_W = 58; // inner width between ║ delimiters
const boxLine = (s) => `║${s.padEnd(BOX_W)}║`;

console.log('╔' + '═'.repeat(BOX_W) + '╗');
console.log(boxLine('             ModelDev Toolkit - Test Suite'));
console.log('╚' + '═'.repeat(BOX_W) + '╝');
console.log(`Profile: ${requestedProfile}`);
console.log();

let totalPassed = 0;
let totalFailed = 0;
let totalTests = 0;
let suitesRun = 0;
let suitesFailed = 0;

function getLastMatchInt(text, regex) {
  const matches = [...text.matchAll(regex)];
  if (matches.length === 0) return null;
  return parseInt(matches[matches.length - 1][1], 10);
}

function parseSuiteCounts(text) {
  // Common format across most suites:
  //   Passed: N
  //   Failed: M
  const passed = getLastMatchInt(text, /Passed:\s*(\d+)/g);
  const failed = getLastMatchInt(text, /Failed:\s*(\d+)/g);
  if (passed !== null && failed !== null) {
    return { passed, failed };
  }

  // Alternate format used by project-detect suite:
  //   === Results: N passed, M failed ===
  const alt = text.match(/Results:\s*(\d+)\s+passed,\s*(\d+)\s+failed/i);
  if (alt) {
    return { passed: parseInt(alt[1], 10), failed: parseInt(alt[2], 10) };
  }

  return null;
}

for (const testFile of testFiles) {
  const testPath = path.join(testsDir, testFile);

  if (!fs.existsSync(testPath)) {
    console.log(`✗ Missing test file: ${testFile}`);
    totalFailed += 1;
    suitesFailed += 1;
    continue;
  }

  suitesRun += 1;
  console.log(`\n━━━ Running ${testFile} ━━━`);

  const result = spawnSync('node', [testPath], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: SUITE_TIMEOUT_MS,
    env: buildTestEnv(requestedProfile, {
      MDT_TEST_ENV_PROFILE: requestedProfile
    })
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';

  // Show both stdout and stderr so hook warnings are visible
  if (stdout) console.log(stdout);
  if (stderr) console.log(stderr);

  // Parse results from combined output
  const combined = stdout + stderr;
  const parsedCounts = parseSuiteCounts(combined);
  const hasParsableCounts = parsedCounts !== null;
  const status = typeof result.status === 'number' ? result.status : null;
  const hasSpawnError = Boolean(result.error);
  const timedOut = hasSpawnError && result.error.code === 'ETIMEDOUT';
  const hasSignal = Boolean(result.signal);

  if (hasParsableCounts) {
    totalPassed += parsedCounts.passed;
    totalFailed += parsedCounts.failed;
  }

  if (hasSpawnError) {
    console.log(`✗ Runner error in ${testFile}: ${result.error.code || result.error.message}`);
  }
  if (timedOut) {
    console.log(`✗ Suite timed out after ${SUITE_TIMEOUT_MS}ms: ${testFile}`);
  }
  if (hasSignal) {
    console.log(`✗ Suite terminated by signal ${result.signal}: ${testFile}`);
  }
  if (status !== 0) {
    console.log(`✗ Suite exited with non-zero status (${status === null ? 'null' : status}): ${testFile}`);
  }
  if (!hasParsableCounts) {
    console.log(`✗ Could not parse Passed/Failed counts for ${testFile}`);
  }

  const suiteFailed =
    hasSpawnError ||
    timedOut ||
    hasSignal ||
    status !== 0 ||
    !hasParsableCounts;

  // Keep suite process status authoritative while preserving aggregate counts.
  // If no parsed failures captured this suite failure, add one synthetic failure.
  if (suiteFailed) {
    suitesFailed += 1;
    if (!hasParsableCounts || (hasParsableCounts && parsedCounts.failed === 0)) {
      totalFailed += 1;
    }
  }
}

totalTests = totalPassed + totalFailed;

console.log('\n╔' + '═'.repeat(BOX_W) + '╗');
console.log(boxLine('                     Final Results'));
console.log('╠' + '═'.repeat(BOX_W) + '╣');
console.log(boxLine(`  Total Tests: ${String(totalTests).padStart(4)}`));
console.log(boxLine(`  Passed:      ${String(totalPassed).padStart(4)}  ✓`));
console.log(boxLine(`  Failed:      ${String(totalFailed).padStart(4)}  ${totalFailed > 0 ? '✗' : ' '}`));
console.log(boxLine(`  Suites:      ${String(suitesRun).padStart(4)}  run`));
console.log(boxLine(`  Suite Fail:  ${String(suitesFailed).padStart(4)}  ${suitesFailed > 0 ? '✗' : ' '}`));
console.log('╚' + '═'.repeat(BOX_W) + '╝');

process.exit(totalFailed > 0 || suitesFailed > 0 ? 1 : 0);

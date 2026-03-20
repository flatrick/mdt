#!/usr/bin/env node
/**
 * Run all test suites and emit structured test-run artifacts.
 *
 * Usage:
 *   node tests/run-all.js [--profile <neutral|claude|cursor|codex>] [--quiet|--verbose] [--log-root <path>]
 */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { probeNodeSubprocess } = require('./helpers/subprocess-capability');
const { buildTestEnv } = require('./helpers/test-env-profiles');
const {
  buildArtifactPath,
  ensureArtifactRoot,
  formatRunId,
  toRelativeArtifactPath
} = require('../scripts/lib/test-run-artifacts');
const { createPipelineLogger } = require('./lib/loggers');

const TEST_FILES = [
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
  'ci/support-maps-validator.test.js',
  'ci/dependency-sidecars-validator.test.js',
  'ci/resolver-closure-validator.test.js',
  'ci/addon-allowlist-validator.test.js',
  'ci/validators-rounds.test.js',
  'ci/validators-rounds-3.test.js',
  'ci/validators-rounds-2.test.js',
  'compatibility-testing/codex-compatibility.test.js',
  'compatibility-testing/claude-code-compatibility.test.js',
  'compatibility-testing/cursor-agent-compatibility.test.js',
  'compatibility-testing/live-tool-smoke.test.js',
  'compatibility-testing/cursor-ide-compatibility.test.js',
  'scripts/check-dependencies.test.js',
  'scripts/mdt-cli.test.js',
  'scripts/continuous-learning-wrapper.test.js',
  'scripts/hook-platforms.test.js',
  'scripts/codex-observer.test.js',
  'scripts/continuous-learning-observer.test.js',
  'scripts/detect-project.test.js',
  'scripts/instinct-cli.test.js',
  'scripts/continuous-learning-retrospective.test.js',
  'scripts/materialize-mdt-local-unit.test.js',
  'scripts/install-mdt-unit.test.js',
  'scripts/install-resolver.test.js',
  'scripts/install-mdt.test.js',
  'scripts/run-with-flags.test.js',
  'scripts/setup-package-manager.test.js',
  'scripts/test-run-artifacts.test.js',
  'scripts/tool-workflow-contract.test.js',
  'scripts/run-test-pipeline.test.js',
  'scripts/run-all-output-format.test.js',
  'scripts/mdt-dev-smoke-claude-workflows.test.js',
  'scripts/mdt-dev-smoke-cursor-workflows.test.js',
  'scripts/mdt-dev-smoke-codex-workflows.test.js',
  'scripts/mdt-dev-smoke-tool-setups.test.js',
  'scripts/sync-hook-mirrors.test.js',
  'scripts/verify-tool-setups.test.js',
  'scripts/skill-create-output.test.js',
  'scripts/node-runtime-scripts.test.js'
];

const BOX_W = 58;
const boxLine = (value) => `| ${String(value).padEnd(BOX_W - 2)}|`;

function parseArgs(argv, env = process.env) {
  const options = {
    profile: env.MDT_TEST_ENV_PROFILE || 'neutral',
    profileOverrideSource: env.MDT_TEST_ENV_PROFILE ? 'MDT_TEST_ENV_PROFILE' : 'none',
    verbose: false,
    quiet: true,
    logRoot: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--verbose') {
      options.verbose = true;
      options.quiet = false;
      continue;
    }

    if (arg === '--quiet') {
      options.quiet = true;
      options.verbose = false;
      continue;
    }

    if (arg.startsWith('--profile=')) {
      options.profile = arg.slice('--profile='.length).trim() || options.profile;
      options.profileOverrideSource = '--profile';
      continue;
    }

    if (arg === '--profile' && argv[index + 1]) {
      options.profile = String(argv[index + 1]).trim() || options.profile;
      options.profileOverrideSource = '--profile';
      index += 1;
      continue;
    }

    if (arg.startsWith('--log-root=')) {
      options.logRoot = arg.slice('--log-root='.length).trim() || null;
      continue;
    }

    if (arg === '--log-root' && argv[index + 1]) {
      options.logRoot = String(argv[index + 1]).trim() || null;
      index += 1;
    }
  }

  return options;
}

function isDebugModeEnabled(env) {
  return env.MDT_TEST_ENV_DEBUG === '1';
}

function getSuiteTimeoutMs(env) {
  const parsed = parseInt(env.MDT_TEST_SUITE_TIMEOUT_MS || '60000', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60000;
}

function readSuiteSummaryFromLog(logFile) {
  try {
    const lines = fs.readFileSync(logFile, 'utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }
      try {
        const row = JSON.parse(line);
        if (row.kind === 'suite' && row.event === 'finish') {
          return row;
        }
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // file missing or unreadable
  }
  return null;
}

function readTestLabelsByStatus(logFile, status) {
  const labels = [];
  try {
    for (const line of fs.readFileSync(logFile, 'utf8').split('\n')) {
      if (!line.trim()) {
        continue;
      }
      try {
        const row = JSON.parse(line);
        if (row.kind === 'test' && row.status === status && row.test) {
          const label = status === 'skip' && row.msg
            ? `${row.test} - ${row.msg}`
            : row.test;
          labels.push(label);
        }
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // file missing or unreadable
  }
  return labels;
}

function createSuiteArtifactContext(options = {}) {
  const artifactRoot = ensureArtifactRoot({
    repoRoot: options.repoRoot,
    logRoot: options.logRoot
  });
  const runId = options.runId || formatRunId();
  const rollupLog = buildArtifactPath({
    repoRoot: options.repoRoot,
    logRoot: artifactRoot,
    runId,
    name: options.rollupName || `run-all-${options.profile || 'neutral'}`
  });

  return {
    artifactRoot,
    runId,
    rollupLog
  };
}

function printDebugPreflight(io, profile, profileOverrideSource, env) {
  const detectionKeys = ['CURSOR_AGENT', 'CLAUDE_SESSION_ID', 'CLAUDE_CODE', 'CODEX_AGENT', 'CURSOR_TRACE_ID', 'CODEX_SESSION_ID'];
  const debugLine = (label, value) => `${label.padEnd(24)}: ${value}`;

  io.log('[MDT test preflight]');
  io.log(debugLine('selected profile', profile));
  io.log(debugLine('profile override source', profileOverrideSource));
  for (const key of detectionKeys) {
    const value = env[key];
    io.log(debugLine(key, value && value.length > 0 ? value : '<unset>'));
  }
  io.log('');
}

function printSuiteSummary(io, result) {
  const logPath = path.relative(process.cwd(), result.logFile) || result.logFile;
  if (result.status === 'fail') {
    io.log(`FAIL ${result.suite} -> ${logPath}`);
    for (const label of result.failedLabels.slice(0, 5)) {
      io.log(`  x ${label}`);
    }
    if (result.failedLabels.length > 5) {
      io.log(`  ... +${result.failedLabels.length - 5} more (see log)`);
    }
    return;
  }

  if (result.status === 'skip') {
    io.log(`SKIP ${result.suite} -> ${logPath}`);
    for (const label of result.skippedLabels.slice(0, 5)) {
      io.log(`  - ${label}`);
    }
    if (result.skippedLabels.length > 5) {
      io.log(`  ... +${result.skippedLabels.length - 5} more (see log)`);
    }
  }
}

function printFinalSummary(io, summary) {
  io.log('');
  io.log('+' + '-'.repeat(BOX_W) + '+');
  io.log(boxLine('MDT Test Suite Summary'));
  io.log('+' + '-'.repeat(BOX_W) + '+');
  io.log(boxLine(`Profile: ${summary.profile}`));
  io.log(boxLine(`Tests:   ${summary.tests.passed} passed, ${summary.tests.skipped} skipped, ${summary.tests.failed} failed`));
  io.log(boxLine(`Suites:  ${summary.suites.passed} passed, ${summary.suites.skipped} skipped, ${summary.suites.failed} failed`));
  io.log(boxLine(`Logs:    ${summary.artifactRoot}`));
  io.log('+' + '-'.repeat(BOX_W) + '+');
}

function incrementStatusCounter(target, status) {
  if (status === 'pass') {
    target.passed += 1;
    return;
  }
  if (status === 'skip') {
    target.skipped += 1;
    return;
  }
  target.failed += 1;
}

function runSuite(testFile, options) {
  const testPath = path.join(options.testsDir, testFile);
  const suiteLog = buildArtifactPath({
    repoRoot: options.repoRoot,
    logRoot: options.artifactRoot,
    runId: options.runId,
    name: testFile
  });

  const startMs = Date.now();

  if (!fs.existsSync(testPath)) {
    const durationMs = Date.now() - startMs;
    return {
      suite: testFile,
      logFile: suiteLog,
      status: 'fail',
      counts: { passed: 0, skipped: 0, failed: 1, total: 1 },
      failedLabels: ['suite file is missing'],
      skippedLabels: [],
      durationMs,
      exitCode: 1
    };
  }

  const result = spawnSync('node', [testPath], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: options.suiteTimeoutMs,
    env: {
      ...buildTestEnv(options.profile, { MDT_TEST_ENV_PROFILE: options.profile }),
      MDT_SUITE_LOG_FILE: suiteLog,
      MDT_TEST_RUN_ID: options.runId,
      MDT_SUITE_NAME: testFile,
      MDT_SUITE_PATH: path.join('tests', testFile)
    }
  });

  const durationMs = Date.now() - startMs;
  const statusCode = typeof result.status === 'number' ? result.status : null;

  const suiteSummary = readSuiteSummaryFromLog(suiteLog);
  const failedLabels = readTestLabelsByStatus(suiteLog, 'fail');
  const skippedLabels = readTestLabelsByStatus(suiteLog, 'skip');

  let counts = suiteSummary
    ? {
      passed: suiteSummary.passed || 0,
      skipped: suiteSummary.skipped || 0,
      failed: suiteSummary.failed || 0,
      total: suiteSummary.total || 0
    }
    : { passed: 0, skipped: 0, failed: statusCode !== 0 ? 1 : 0, total: statusCode !== 0 ? 1 : 0 };

  let status = suiteSummary ? suiteSummary.status : (statusCode === 0 ? 'pass' : 'fail');

  if (result.error && result.error.code === 'ETIMEDOUT') {
    status = 'fail';
    const label = `suite timed out after ${options.suiteTimeoutMs}ms`;
    failedLabels.push(label);
    if (counts.failed === 0) {
      counts = { ...counts, failed: 1, total: counts.total + 1 };
    }
  } else if (result.error) {
    status = 'fail';
    const label = `runner error: ${result.error.code || result.error.message}`;
    failedLabels.push(label);
    if (counts.failed === 0) {
      counts = { ...counts, failed: 1, total: counts.total + 1 };
    }
  } else if (result.signal) {
    status = 'fail';
    failedLabels.push(`suite terminated by signal ${result.signal}`);
    if (counts.failed === 0) {
      counts = { ...counts, failed: 1, total: counts.total + 1 };
    }
  }

  return {
    suite: testFile,
    logFile: suiteLog,
    status,
    counts,
    failedLabels,
    skippedLabels,
    durationMs,
    exitCode: statusCode
  };
}

function runAllTests(options = {}) {
  const io = options.io || console;
  const parsed = options.parsedArgs || parseArgs(options.argv || process.argv.slice(2), options.env || process.env);
  const env = options.env || process.env;
  const repoRoot = options.repoRoot || path.join(__dirname, '..');
  const testsDir = options.testsDir || __dirname;
  const suiteTimeoutMs = options.suiteTimeoutMs || getSuiteTimeoutMs(env);

  if (isDebugModeEnabled(env)) {
    printDebugPreflight(io, parsed.profile, parsed.profileOverrideSource, env);
  }

  buildTestEnv(parsed.profile);

  const artifactContext = createSuiteArtifactContext({
    repoRoot,
    logRoot: options.logRoot || parsed.logRoot,
    runId: options.runId || formatRunId(),
    profile: parsed.profile,
    rollupName: options.rollupName || `run-all-${parsed.profile}`
  });
  const rollupLogger = createPipelineLogger({
    filePath: artifactContext.rollupLog,
    runId: artifactContext.runId
  });
  const runStartMs = Date.now();

  const probe = probeNodeSubprocess();
  rollupLogger.write({
    kind: 'run',
    event: 'start',
    status: 'running',
    step: 'tests',
    message: 'test run started',
    data: {
      profile: parsed.profile,
      artifact_root: '.'
    }
  });

  if (!probe.available) {
    const message = `[subprocess-check] tests/run-all.js: nested Node subprocesses unavailable (${probe.reason})`;
    rollupLogger.write({
      kind: 'run',
      event: 'finish',
      status: 'skip',
      step: 'tests',
      message,
      passed: 0,
      skipped: 1,
      failed: 0,
      total: 1,
      exit_code: 0
    });

    const skippedSummary = {
      profile: parsed.profile,
      runId: artifactContext.runId,
      artifactRoot: artifactContext.artifactRoot,
      rollupLog: artifactContext.rollupLog,
      tests: { passed: 0, skipped: 1, failed: 0, total: 1 },
      suites: { passed: 0, skipped: 1, failed: 0, total: TEST_FILES.length },
      suitesByStatus: [{
        suite: 'tests/run-all.js',
        logFile: artifactContext.rollupLog,
        status: 'skip',
        counts: { passed: 0, skipped: 1, failed: 0, total: 1 },
        failedLabels: [],
        skippedLabels: [message],
        durationMs: 0,
        exitCode: 0
      }],
      durationMs: 0,
      slowestSuites: [],
      exitCode: 0
    };

    if (options.printSuites !== false) {
      io.log(message);
    }
    if (options.printSummary !== false) {
      printFinalSummary(io, {
        profile: skippedSummary.profile,
        artifactRoot: skippedSummary.artifactRoot,
        tests: skippedSummary.tests,
        suites: skippedSummary.suites
      });
    }
    return skippedSummary;
  }

  const summary = {
    profile: parsed.profile,
    runId: artifactContext.runId,
    artifactRoot: artifactContext.artifactRoot,
    rollupLog: artifactContext.rollupLog,
    tests: { passed: 0, skipped: 0, failed: 0, total: 0 },
    suites: { passed: 0, skipped: 0, failed: 0, total: TEST_FILES.length },
    suitesByStatus: []
  };

  for (const testFile of TEST_FILES) {
    const suiteResult = runSuite(testFile, {
      artifactRoot: artifactContext.artifactRoot,
      profile: parsed.profile,
      repoRoot,
      runId: artifactContext.runId,
      suiteTimeoutMs,
      testsDir
    });

    summary.tests.passed += suiteResult.counts.passed;
    summary.tests.skipped += suiteResult.counts.skipped;
    summary.tests.failed += suiteResult.counts.failed;
    summary.tests.total += suiteResult.counts.total;
    incrementStatusCounter(summary.suites, suiteResult.status);
    summary.suitesByStatus.push(suiteResult);

    if (parsed.verbose || suiteResult.status !== 'pass') {
      rollupLogger.write({
        kind: 'suite',
        event: 'finish',
        status: suiteResult.status,
        step: 'tests',
        suite: testFile,
        path: path.join('tests', testFile),
        message: suiteResult.status === 'pass' ? null : suiteResult.status === 'skip' ? 'suite fully skipped' : 'suite reported failures',
        passed: suiteResult.counts.passed,
        skipped: suiteResult.counts.skipped,
        failed: suiteResult.counts.failed,
        total: suiteResult.counts.total,
        duration_ms: suiteResult.durationMs,
        exit_code: suiteResult.exitCode,
        data: {
          log_file: toRelativeArtifactPath(artifactContext.rollupLog, suiteResult.logFile)
        }
      });
    }

    if (options.printSuites !== false && !parsed.verbose && (suiteResult.status === 'fail' || suiteResult.status === 'skip')) {
      printSuiteSummary(io, suiteResult);
    } else if (options.printSuites !== false && parsed.verbose) {
      io.log(`${suiteResult.status.toUpperCase()} ${testFile} -> ${suiteResult.logFile}`);
    }
  }

  const exitCode = summary.tests.failed > 0 || summary.suites.failed > 0 ? 1 : 0;

  const slowestSuites = summary.suitesByStatus
    .slice()
    .sort((left, right) => right.durationMs - left.durationMs)
    .slice(0, 5)
    .map((entry) => ({
      suite: entry.suite,
      duration_ms: entry.durationMs,
      log_file: toRelativeArtifactPath(artifactContext.rollupLog, entry.logFile)
    }));

  rollupLogger.write({
    kind: 'summary',
    event: 'finish',
    status: exitCode === 0 ? 'pass' : 'fail',
    step: 'tests',
    message: null,
    passed: summary.tests.passed,
    skipped: summary.tests.skipped,
    failed: summary.tests.failed,
    total: summary.tests.total,
    duration_ms: Date.now() - runStartMs,
    exit_code: exitCode,
    data: {
      suites: summary.suites,
      slowest_suites: slowestSuites
    }
  });

  if (options.printSummary !== false) {
    printFinalSummary(io, summary);
  }

  return {
    ...summary,
    durationMs: Date.now() - runStartMs,
    slowestSuites,
    exitCode
  };
}

if (require.main === module) {
  try {
    const result = runAllTests();
    process.exit(result.exitCode);
  } catch (error) {
    console.error(`x tests/run-all.js failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  TEST_FILES,
  parseArgs,
  readSuiteSummaryFromLog,
  readTestLabelsByStatus,
  runAllTests
};

#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const { checkDependencies } = require('./check-dependencies');
const {
  buildArtifactPath,
  createPipelineLogger,
  ensureArtifactRoot,
  formatRunId,
  toRelativeArtifactPath
} = require('../lib/test-run-artifacts');
const { runAllTests } = require('../../tests/run-all');

const REPO_ROOT = path.join(__dirname, '..', '..');

const SCRIPT_STEPS = [
  { name: 'validate-agents', script: 'scripts/ci/validate-agents.js' },
  { name: 'validate-commands', script: 'scripts/ci/validate-commands.js' },
  { name: 'validate-rules', script: 'scripts/ci/validate-rules.js' },
  { name: 'validate-skills', script: 'scripts/ci/validate-skills.js' },
  { name: 'validate-hooks', script: 'scripts/ci/validate-hooks.js' },
  { name: 'validate-hook-mirrors', script: 'scripts/ci/validate-hook-mirrors.js' },
  { name: 'validate-metadata', script: 'scripts/ci/validate-metadata.js' },
  { name: 'validate-no-hardcoded-paths', script: 'scripts/ci/validate-no-hardcoded-paths.js' },
  { name: 'validate-runtime-ignores', script: 'scripts/ci/validate-runtime-ignores.js' },
  { name: 'validate-install-packages', script: 'scripts/ci/validate-install-packages.js' },
  { name: 'validate-markdown-links', script: 'scripts/ci/validate-markdown-links.js' },
  { name: 'validate-markdown-path-refs', script: 'scripts/ci/validate-markdown-path-refs.js' },
  { name: 'validate-docs-consistency', script: 'scripts/ci/validate-docs-consistency.js' },
  { name: 'validate-frontmatter-format', script: 'scripts/ci/validate-frontmatter-format.js' },
  { name: 'verify-tool-setups', script: 'scripts/verify-tool-setups.js' }
];

function parseArgs(argv) {
  const options = {
    verbose: false,
    quiet: true,
    testsOnly: false,
    profile: null,
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
    if (arg === '--tests-only') {
      options.testsOnly = true;
      continue;
    }
    if (arg.startsWith('--profile=')) {
      options.profile = arg.slice('--profile='.length).trim() || null;
      continue;
    }
    if (arg === '--profile' && argv[index + 1]) {
      options.profile = String(argv[index + 1]).trim() || null;
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

function runScriptStep(step, context) {
  const logFile = buildArtifactPath({
    repoRoot: REPO_ROOT,
    logRoot: context.artifactRoot,
    runId: context.runId,
    name: step.name
  });
  const logger = createPipelineLogger({ filePath: logFile, runId: context.runId });
  const startMs = Date.now();

  const result = spawnSync('node', [path.join(REPO_ROOT, step.script)], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env
  });

  logger.writeOutput('stdout', result.stdout || '', {
    step: step.name,
    path: step.script
  });
  logger.writeOutput('stderr', result.stderr || '', {
    step: step.name,
    path: step.script
  });

  const status = result.status === 0 && !result.error && !result.signal ? 'pass' : 'fail';
  const durationMs = Date.now() - startMs;
  const message = result.error
    ? `step failed to execute: ${result.error.code || result.error.message}`
    : status === 'pass'
      ? 'step passed'
      : result.signal
        ? `step terminated by signal ${result.signal}`
        : `step exited with status ${result.status}`;

  logger.write({
    kind: 'step',
    event: 'finish',
    status,
    step: step.name,
    path: step.script,
    message: status === 'pass' ? null : message,
    duration_ms: durationMs,
    exit_code: typeof result.status === 'number' ? result.status : null
  });

  return {
    name: step.name,
    status,
    logFile,
    message,
    exitCode: typeof result.status === 'number' ? result.status : 1,
    durationMs
  };
}

function runDependencyStep(context) {
  const step = { name: 'check-dependencies', path: 'package.json#scripts.test' };
  const logFile = buildArtifactPath({
    repoRoot: REPO_ROOT,
    logRoot: context.artifactRoot,
    runId: context.runId,
    name: step.name
  });
  const logger = createPipelineLogger({ filePath: logFile, runId: context.runId });
  const startMs = Date.now();

  const result = checkDependencies(['eslint', 'markdownlint-cli'], REPO_ROOT);
  const status = result.ok ? 'pass' : 'fail';
  if (result.message) {
    logger.writeOutput(status === 'pass' ? 'stdout' : 'stderr', result.message, {
      step: step.name,
      path: step.path
    });
  }
  if (result.hint) {
    logger.writeOutput('stderr', result.hint, {
      step: step.name,
      path: step.path
    });
  }

  const durationMs = Date.now() - startMs;
  logger.write({
    kind: 'step',
    event: 'finish',
    status,
    step: step.name,
    path: step.path,
    message: result.ok ? null : result.message,
    duration_ms: durationMs,
    exit_code: result.ok ? 0 : 1
  });

  return {
    name: step.name,
    status,
    logFile,
    message: result.ok ? 'dependency preflight passed' : result.message,
    exitCode: result.ok ? 0 : 1,
    durationMs
  };
}

function printStepSummary(io, result) {
  io.log(`${result.status.toUpperCase()} ${result.name} -> ${result.logFile}`);
  if (result.status !== 'pass') {
    io.log(`  - ${result.message}`);
  }
}

function printFinalSummary(io, summary) {
  io.log('');
  io.log(`Test pipeline logs: ${summary.artifactRoot}`);
  io.log(`Steps: ${summary.steps.passed} passed, ${summary.steps.skipped} skipped, ${summary.steps.failed} failed`);
  io.log(`Suites: ${summary.suites.passed} passed, ${summary.suites.skipped} skipped, ${summary.suites.failed} failed`);
  io.log(`Tests: ${summary.tests.passed} passed, ${summary.tests.skipped} skipped, ${summary.tests.failed} failed`);
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

function runTestPipeline(options = {}) {
  const parsed = options.parsedArgs || parseArgs(options.argv || process.argv.slice(2));
  const io = options.io || console;
  const runId = options.runId || formatRunId();
  const runDependencyStepImpl = options.runDependencyStepImpl || runDependencyStep;
  const runScriptStepImpl = options.runScriptStepImpl || runScriptStep;
  const runAllTestsImpl = options.runAllTestsImpl || runAllTests;
  const artifactRoot = ensureArtifactRoot({
    repoRoot: REPO_ROOT,
    logRoot: options.logRoot || parsed.logRoot
  });
  const rollupLog = buildArtifactPath({
    repoRoot: REPO_ROOT,
    logRoot: artifactRoot,
    runId,
    name: parsed.testsOnly ? `tests-${parsed.profile || 'neutral'}` : 'npm-test'
  });
  const rollupLogger = createPipelineLogger({ filePath: rollupLog, runId });

  const summary = {
    artifactRoot,
    rollupLog,
    runId,
    steps: { passed: 0, skipped: 0, failed: 0 },
    suites: { passed: 0, skipped: 0, failed: 0 },
    tests: { passed: 0, skipped: 0, failed: 0 }
  };
  const pipelineStartMs = Date.now();

  rollupLogger.write({
    kind: 'run',
    event: 'start',
    status: 'running',
    step: 'pipeline',
    message: 'test pipeline started',
    data: {
      tests_only: parsed.testsOnly,
      profile: parsed.profile || null,
      artifact_root: '.'
    }
  });

  const stepResults = [];

  if (!parsed.testsOnly) {
    const dependencyResult = runDependencyStepImpl({ artifactRoot, runId });
    stepResults.push(dependencyResult);
    incrementStatusCounter(summary.steps, dependencyResult.status);
    rollupLogger.write({
      kind: 'step',
      event: 'finish',
      status: dependencyResult.status,
      step: dependencyResult.name,
      message: dependencyResult.message,
      duration_ms: dependencyResult.durationMs,
      exit_code: dependencyResult.exitCode,
      data: {
        log_file: toRelativeArtifactPath(rollupLog, dependencyResult.logFile)
      }
    });

    if (!parsed.quiet || dependencyResult.status !== 'pass') {
      printStepSummary(io, dependencyResult);
    }

    for (const step of SCRIPT_STEPS) {
      const result = runScriptStepImpl(step, { artifactRoot, runId });
      stepResults.push(result);
      incrementStatusCounter(summary.steps, result.status);
      rollupLogger.write({
        kind: 'step',
        event: 'finish',
        status: result.status,
        step: result.name,
        path: step.script,
        message: result.message,
        duration_ms: result.durationMs,
        exit_code: result.exitCode,
        data: {
          log_file: toRelativeArtifactPath(rollupLog, result.logFile)
        }
      });

      if (!parsed.quiet || result.status !== 'pass') {
        printStepSummary(io, result);
      }
    }
  }

  const testResult = runAllTestsImpl({
    parsedArgs: {
      profile: parsed.profile || process.env.MDT_TEST_ENV_PROFILE || 'neutral',
      profileOverrideSource: parsed.profile ? '--profile' : (process.env.MDT_TEST_ENV_PROFILE ? 'MDT_TEST_ENV_PROFILE' : 'none'),
      verbose: parsed.verbose,
      quiet: parsed.quiet,
      logRoot: artifactRoot
    },
    env: process.env,
    io,
    logRoot: artifactRoot,
    printSummary: false,
    printSuites: true,
    repoRoot: REPO_ROOT,
    rollupName: parsed.testsOnly ? `tests-${parsed.profile || 'neutral'}` : `run-all-${parsed.profile || process.env.MDT_TEST_ENV_PROFILE || 'neutral'}`,
    runId
  });

  summary.suites = {
    passed: testResult.suites.passed,
    skipped: testResult.suites.skipped,
    failed: testResult.suites.failed
  };
  summary.tests = {
    passed: testResult.tests.passed,
    skipped: testResult.tests.skipped,
    failed: testResult.tests.failed
  };

  rollupLogger.write({
    kind: 'summary',
    event: 'finish',
    status: testResult.exitCode === 0 ? 'pass' : 'fail',
    step: 'tests',
    message: null,
    passed: testResult.tests.passed,
    skipped: testResult.tests.skipped,
    failed: testResult.tests.failed,
    total: testResult.tests.total,
    duration_ms: testResult.durationMs,
    exit_code: testResult.exitCode,
    data: {
      suites: summary.suites,
      rollup_log: toRelativeArtifactPath(rollupLog, testResult.rollupLog),
      slowest_suites: testResult.slowestSuites || []
    }
  });

  const exitCode = summary.steps.failed > 0 || summary.tests.failed > 0 || summary.suites.failed > 0 ? 1 : 0;
  rollupLogger.write({
    kind: 'summary',
    event: 'finish',
    status: exitCode === 0 ? 'pass' : 'fail',
    step: 'pipeline',
    message: null,
    duration_ms: Date.now() - pipelineStartMs,
    exit_code: exitCode,
    data: {
      steps: summary.steps,
      suites: summary.suites,
      tests: summary.tests
    }
  });

  printFinalSummary(io, summary);

  return {
    ...summary,
    stepResults,
    exitCode
  };
}

if (require.main === module) {
  const result = runTestPipeline();
  process.exit(result.exitCode);
}

module.exports = {
  SCRIPT_STEPS,
  parseArgs,
  runDependencyStep,
  runScriptStep,
  runTestPipeline
};

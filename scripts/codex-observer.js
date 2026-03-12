#!/usr/bin/env node
/**
 * Optional external observer for Codex continuous learning.
 *
 * This runs outside the Codex session and watches project-scoped MDT observations
 * under ~/.codex/mdt/homunculus/<id>/observations.jsonl. When enough new
 * observations exist, it triggers the existing observer analysis pipeline using
 * the native Codex CLI from a normal shell environment.
 *
 * Usage:
 *   node scripts/codex-observer.js status
 *   node scripts/codex-observer.js once
 *   node scripts/codex-observer.js watch [--interval-seconds 15]
 *   node scripts/codex-observer.js --watch
 */

'use strict';

const fs = require('fs');
const path = require('path');

const {
  createContinuousLearningContext
} = require(path.join(__dirname, 'lib', 'continuous-learning', 'runtime-context.js'));
const {
  createProjectDetection
} = require(path.join(__dirname, 'lib', 'continuous-learning', 'project-detection.js'));
const {
  createObserverRuntime
} = require(path.join(__dirname, 'lib', 'continuous-learning', 'observer-runtime.js'));

function resolveSkillRoot(scriptDir = __dirname) {
  const context = createContinuousLearningContext({
    entrypointDir: scriptDir,
    skillName: 'continuous-learning-manual'
  });

  if (context.skillDir) {
    return context.skillDir;
  }

  throw new Error('Unable to locate continuous-learning-manual skill');
}

const skillRoot = resolveSkillRoot(__dirname);
const projectDetection = createProjectDetection({
  entrypointDir: path.join(skillRoot, 'scripts')
});
const observerRuntime = createObserverRuntime({
  entrypointDir: path.join(skillRoot, 'agents'),
  skillDir: skillRoot,
  configPath: path.join(skillRoot, 'config.json'),
  detectProject: projectDetection.detectProject
});
const { detectProject } = projectDetection;
const { analyzeObservations, loadObserverConfig } = observerRuntime;

function parseArgs(argv) {
  let command = 'status';
  let intervalSeconds = 15;
  let minObservations = null;
  let cwd = process.cwd();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === 'status' || arg === 'once' || arg === 'watch') {
      command = arg;
    } else if (arg === '--watch') {
      command = 'watch';
    } else if (arg === '--interval-seconds' && argv[i + 1]) {
      intervalSeconds = parsePositiveInt(argv[++i], 15);
    } else if (arg.startsWith('--interval-seconds=')) {
      intervalSeconds = parsePositiveInt(arg.split('=')[1], 15);
    } else if (arg === '--min-observations' && argv[i + 1]) {
      minObservations = parsePositiveInt(argv[++i], null);
    } else if (arg.startsWith('--min-observations=')) {
      minObservations = parsePositiveInt(arg.split('=')[1], null);
    } else if (arg === '--project-dir' && argv[i + 1]) {
      cwd = path.resolve(argv[++i]);
    } else if (arg.startsWith('--project-dir=')) {
      cwd = path.resolve(arg.split('=')[1]);
    }
  }

  return { command, intervalSeconds, minObservations, cwd };
}

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildCodexObserverEnv(env = process.env, options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const nextEnv = { ...env };
  const homeDir = options.homeDir || nextEnv.HOME || nextEnv.USERPROFILE || process.env.HOME || process.env.USERPROFILE || '';

  if (!nextEnv.CONFIG_DIR || !String(nextEnv.CONFIG_DIR).trim()) {
    nextEnv.CONFIG_DIR = path.join(homeDir, '.codex');
  }
  if (!nextEnv.DATA_DIR || !String(nextEnv.DATA_DIR).trim()) {
    nextEnv.DATA_DIR = path.join(nextEnv.CONFIG_DIR, 'mdt');
  }

  nextEnv.CODEX_AGENT = '1';
  nextEnv.MDT_OBSERVER_TOOL = 'codex';
  nextEnv.MDT_PROJECT_ROOT = nextEnv.MDT_PROJECT_ROOT || cwd;

  return nextEnv;
}

function countLines(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return 0;
  }

  return fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean).length;
}

function getObservationSnapshot(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      exists: false,
      size: 0,
      mtimeMs: 0,
      lines: 0
    };
  }

  const stat = fs.statSync(filePath);
  return {
    exists: true,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    lines: countLines(filePath)
  };
}

function hasObservationChange(previousSnapshot, nextSnapshot) {
  if (!previousSnapshot) {
    return nextSnapshot.exists;
  }

  return (
    previousSnapshot.exists !== nextSnapshot.exists ||
    previousSnapshot.size !== nextSnapshot.size ||
    previousSnapshot.mtimeMs !== nextSnapshot.mtimeMs ||
    previousSnapshot.lines !== nextSnapshot.lines
  );
}

function waitForChild(child) {
  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Codex observer analysis exited with code ${code}`));
      }
    });
    child.on('error', reject);
  });
}

function runWithProcessEnv(env, fn) {
  const previousValues = {};
  const keys = Object.keys(env);

  for (const key of keys) {
    previousValues[key] = process.env[key];
    if (env[key] === undefined || env[key] === null) {
      delete process.env[key];
    } else {
      process.env[key] = String(env[key]);
    }
  }

  try {
    return fn();
  } finally {
    for (const key of keys) {
      if (previousValues[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValues[key];
      }
    }
  }
}

function resolveObserverConfig(options = {}) {
  const loaded = options.config || loadObserverConfig(path.join(skillRoot, 'config.json'));
  const minObservations = options.minObservations ?? loaded.min_observations_to_analyze;

  return {
    ...loaded,
    tool: 'codex',
    min_observations_to_analyze: parsePositiveInt(minObservations, 1) || 1
  };
}

async function maybeAnalyzeProject(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const env = buildCodexObserverEnv(options.env || process.env, { cwd });
  const config = resolveObserverConfig({
    config: options.config,
    minObservations: options.minObservations
  });
  const detectProjectImpl = options.detectProjectImpl || detectProject;
  const analyzeImpl = options.analyzeImpl || analyzeObservations;
  const project = runWithProcessEnv(env, () => detectProjectImpl(cwd));
  const observations = countLines(project.observations_file);

  if (observations === 0) {
    return { triggered: false, reason: 'no-observations', observations, project };
  }

  if (observations < config.min_observations_to_analyze) {
    return { triggered: false, reason: 'below-threshold', observations, project };
  }

  const child = analyzeImpl({
    env: {
      ...env,
      CLV2_PROJECT_DIR: project.project_dir,
      CLV2_OBSERVATIONS_FILE: project.observations_file,
      CLV2_INSTINCTS_DIR: path.join(project.project_dir, 'instincts', 'personal'),
      CLV2_MIN_OBSERVATIONS: String(config.min_observations_to_analyze),
      CLV2_PROJECT_NAME: project.name,
      CLV2_PROJECT_ID: project.id,
      CLV2_LOG_FILE: path.join(project.project_dir, 'observer.log')
    },
    config
  });

  if (!child) {
    return { triggered: false, reason: 'no-child', observations, project };
  }

  await waitForChild(child);
  return { triggered: true, reason: 'analyzed', observations, project };
}

function printStatus(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const env = buildCodexObserverEnv(options.env || process.env, { cwd });
  const project = runWithProcessEnv(env, () => (options.detectProjectImpl || detectProject)(cwd));
  const config = resolveObserverConfig({
    config: options.config,
    minObservations: options.minObservations
  });

  console.log(`Project: ${project.name} (${project.id})`);
  console.log(`Storage: ${project.project_dir}`);
  console.log('Tool: codex');
  console.log(`Watch file: ${project.observations_file}`);
  console.log(`Observations: ${countLines(project.observations_file)}`);
  console.log(`Threshold: ${config.min_observations_to_analyze}`);
  console.log(`Config dir: ${env.CONFIG_DIR}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function watchProject(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const intervalSeconds = parsePositiveInt(options.intervalSeconds, 15);
  const env = buildCodexObserverEnv(options.env || process.env, { cwd });
  const project = runWithProcessEnv(env, () => (options.detectProjectImpl || detectProject)(cwd));
  let previousSnapshot = getObservationSnapshot(project.observations_file);
  let analyzing = false;

  console.log(`Watching ${project.observations_file}`);
  console.log(`Polling every ${intervalSeconds}s`);

  while (true) {
    const snapshot = getObservationSnapshot(project.observations_file);
    const changed = hasObservationChange(previousSnapshot, snapshot);

    if (changed && !analyzing) {
      analyzing = true;
      try {
        const result = await maybeAnalyzeProject({
          ...options,
          cwd
        });
        if (result.triggered) {
          console.log(`Analyzed ${result.observations} observations for ${result.project.name}`);
        } else if (result.reason === 'below-threshold') {
          console.log(
            `Pending observations for ${result.project.name}: ${result.observations}/${resolveObserverConfig(options).min_observations_to_analyze}`
          );
        }
      } catch (error) {
        console.error(error.message || String(error));
      } finally {
        analyzing = false;
      }
    }

    previousSnapshot = snapshot;
    await delay(intervalSeconds * 1000);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === 'status') {
    printStatus(args);
    return;
  }

  if (args.command === 'once') {
    const result = await maybeAnalyzeProject(args);
    if (result.triggered) {
      console.log(`Analyzed observations for ${result.project.name}`);
    } else {
      console.log(`No analysis triggered (${result.reason})`);
    }
    return;
  }

  if (args.command === 'watch') {
    await watchProject(args);
    return;
  }

  console.log('Usage: node scripts/codex-observer.js {status|once|watch} [--interval-seconds N] [--min-observations N] [--project-dir PATH]');
  process.exit(1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || String(error));
    process.exit(1);
  });
}

module.exports = {
  buildCodexObserverEnv,
  countLines,
  getObservationSnapshot,
  hasObservationChange,
  maybeAnalyzeProject,
  parseArgs,
  printStatus,
  resolveObserverConfig,
  resolveSkillRoot,
  runWithProcessEnv,
  waitForChild,
  watchProject
};

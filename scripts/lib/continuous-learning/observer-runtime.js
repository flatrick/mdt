'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const {
  cleanupStaleManagedProcessState,
  evaluateManagedProcessLease,
  readManagedProcessState,
  stopManagedProcess,
  writeManagedProcessState
} = require('../detached-process-lifecycle');
const {
  createContinuousLearningContext,
  inferInstalledConfigDir,
  inferToolFromConfigDir
} = require('./runtime-context');

const DEFAULT_CONFIG = {
  run_interval_minutes: 5,
  min_observations_to_analyze: 20,
  enabled: false,
  tool: null,
  models: {
    claude: 'haiku',
    cursor: 'auto',
    codex: ''
  },
  commands: {
    claude: 'claude',
    cursor: 'agent',
    codex: 'codex'
  }
};

function mergeObserverConfig(base, overrides) {
  return {
    ...base,
    ...overrides,
    models: {
      ...(base.models || {}),
      ...((overrides && overrides.models) || {})
    },
    commands: {
      ...(base.commands || {}),
      ...((overrides && overrides.commands) || {})
    }
  };
}

function buildAnalysisPrompt(projectName, observationsFile, instinctsDir) {
  return `Read ${observationsFile} and identify patterns for the project '${projectName}'. If you find 3+ occurrences of the same pattern, create an instinct file in ${instinctsDir}/<id>.md. Use YAML frontmatter with id, trigger, confidence, domain, source, scope.`;
}

function buildAnalyzerInvocation(options) {
  const {
    tool,
    config,
    prompt,
    workspace
  } = options;
  const model = config.models && config.models[tool] ? config.models[tool] : '';
  const command = config.commands && config.commands[tool] ? config.commands[tool] : '';

  if (tool === 'claude') {
    const args = ['--print', '--max-turns', '3'];
    if (model) {
      args.push('--model', model);
    }
    args.push(prompt);
    return { command: command || 'claude', args, model };
  }

  if (tool === 'cursor') {
    const args = ['--print', '--trust'];
    if (workspace) {
      args.push('--workspace', workspace);
    }
    if (model) {
      args.push('--model', model);
    }
    args.push(prompt);
    return { command: command || 'agent', args, model };
  }

  if (tool === 'codex') {
    const args = ['exec', '--full-auto'];
    if (workspace) {
      args.push('-C', workspace);
    }
    if (model) {
      args.push('--model', model);
    }
    args.push(prompt);
    return { command: command || 'codex', args, model };
  }

  throw new Error(`Unsupported observer tool '${tool}'`);
}

function shouldResolveWindowsSpawnCommand(command, platform = process.platform) {
  return platform === 'win32' && !/[\\/]/.test(command) && !/\.[a-z0-9]+$/i.test(command);
}

function resolveWindowsSpawnInvocation(invocation, options = {}) {
  const platform = options.platform || process.platform;
  const execFileSyncImpl = options.execFileSyncImpl || execFileSync;
  if (!shouldResolveWindowsSpawnCommand(invocation.command, platform)) {
    return invocation;
  }

  try {
    const output = execFileSyncImpl('where.exe', [invocation.command], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 15000
    });
    const candidates = String(output || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const preferredPath = candidates.find((candidate) => /\.(cmd|exe|bat)$/i.test(candidate))
      || candidates[0];
    if (!preferredPath) {
      return invocation;
    }

    if (/\.ps1$/i.test(preferredPath)) {
      return {
        ...invocation,
        command: 'pwsh',
        args: ['-NoProfile', '-File', preferredPath, ...invocation.args]
      };
    }

    if (/\.(cmd|bat)$/i.test(preferredPath)) {
      return {
        ...invocation,
        command: 'cmd.exe',
        args: ['/d', '/s', '/c', preferredPath, ...invocation.args]
      };
    }

    return {
      ...invocation,
      command: preferredPath
    };
  } catch {
    return invocation;
  }
}

function appendLog(logFile, message) {
  if (!logFile) {
    return;
  }
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
}

function archiveObservations(observationsFile, projectDir) {
  if (!observationsFile || !projectDir || !fs.existsSync(observationsFile)) {
    return;
  }

  const archiveDir = path.join(projectDir, 'observations.archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  try {
    fs.renameSync(observationsFile, path.join(archiveDir, `processed-${Date.now()}.jsonl`));
  } catch {
    // Best-effort archive move.
  }
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function createObserverRuntime(options = {}) {
  const entrypointDir = path.resolve(options.entrypointDir || process.cwd());
  const skillDir = path.resolve(options.skillDir || path.join(entrypointDir, '..'));
  const configPath = options.configPath
    ? path.resolve(options.configPath)
    : path.join(skillDir, 'config.json');
  const detectProject = options.detectProject;

  if (typeof detectProject !== 'function') {
    throw new Error('createObserverRuntime requires detectProject');
  }

  function buildObserverEnv(env = process.env, overrides = {}) {
    return createContinuousLearningContext({
      entrypointDir,
      skillDir: overrides.skillDir || skillDir,
      configPath,
      env
    }).env;
  }

  function loadObserverConfig(nextConfigPath = configPath) {
    let config = { ...DEFAULT_CONFIG };
    if (!fs.existsSync(nextConfigPath)) {
      return config;
    }

    try {
      const data = JSON.parse(fs.readFileSync(nextConfigPath, 'utf8'));
      config = mergeObserverConfig(config, data.observer || {});
    } catch {
      // Keep defaults when config parsing fails.
    }

    return config;
  }

  function resolveObserverStateFile(project) {
    return path.join(project.project_dir, '.observer.pid');
  }

  function readObserverState(stateFile) {
    return readManagedProcessState(stateFile);
  }

  function cleanupObserverStateIfStale(stateFile, runtimeOptions = {}) {
    return cleanupStaleManagedProcessState(stateFile, {
      isPidAliveImpl: runtimeOptions.isPidAliveImpl || isPidAlive
    });
  }

  function stopObserverProcess(stateFile, runtimeOptions = {}) {
    return stopManagedProcess(stateFile, {
      isPidAliveImpl: runtimeOptions.isPidAliveImpl || isPidAlive,
      killImpl: runtimeOptions.killImpl || process.kill
    });
  }

  function getLoopLeaseStatus(loopOptions = {}) {
    const env = loopOptions.env || process.env;
    const stateFile = env.MDT_HELPER_STATE_FILE;
    const instanceId = env.MDT_HELPER_INSTANCE_ID;
    const startupGraceUntil = parseInt(String(env.MDT_HELPER_LEASE_GRACE_UNTIL || '0'), 10);
    const pid = typeof loopOptions.currentPid === 'number' ? loopOptions.currentPid : process.pid;

    if (stateFile) {
      const leaseStatus = evaluateManagedProcessLease({
        stateFilePath: stateFile,
        pid,
        instanceId
      });

      if (leaseStatus.shouldExit && leaseStatus.reason === 'lease-missing' && Date.now() < startupGraceUntil) {
        return {
          shouldExit: false,
          reason: null
        };
      }

      if (leaseStatus.shouldExit) {
        return leaseStatus;
      }
    }

    const config = (loopOptions.loadConfigImpl || loadObserverConfig)(configPath);
    if (!config.enabled) {
      return {
        shouldExit: true,
        reason: 'observer-disabled',
        state: null
      };
    }

    return {
      shouldExit: false,
      reason: null,
      state: null
    };
  }

  function inferObserverTool(config, env = process.env) {
    const resolvedEnv = buildObserverEnv(env);
    if (resolvedEnv.MDT_OBSERVER_TOOL && resolvedEnv.MDT_OBSERVER_TOOL.trim()) {
      return resolvedEnv.MDT_OBSERVER_TOOL.trim().toLowerCase();
    }

    if (config.tool && String(config.tool).trim()) {
      return String(config.tool).trim().toLowerCase();
    }

    const context = createContinuousLearningContext({
      entrypointDir,
      skillDir,
      configPath,
      env: resolvedEnv
    });
    if (context.tool === 'cursor' || context.tool === 'claude') {
      return context.tool;
    }

    return inferToolFromConfigDir(context.configDir);
  }

  function analyzeObservations(runtimeOptions = {}) {
    const spawnImpl = runtimeOptions.spawnImpl || spawn;
    const env = buildObserverEnv(runtimeOptions.env || process.env, { skillDir: runtimeOptions.skillDir });
    const observationsFile = env.CLV2_OBSERVATIONS_FILE;
    const instinctsDir = env.CLV2_INSTINCTS_DIR;
    const minObs = parseInt(env.CLV2_MIN_OBSERVATIONS || '20', 10);
    const logFile = env.CLV2_LOG_FILE;
    const projectName = env.CLV2_PROJECT_NAME || 'global';
    const projectDir = env.CLV2_PROJECT_DIR;
    const config = runtimeOptions.config || loadObserverConfig();
    const tool = inferObserverTool(config, env);

    if (!observationsFile || !fs.existsSync(observationsFile)) {
      return null;
    }

    const lines = fs.readFileSync(observationsFile, 'utf8').split('\n').filter(Boolean);
    if (lines.length < minObs) {
      return null;
    }

    const prompt = buildAnalysisPrompt(projectName, observationsFile, instinctsDir);
    const invocation = buildAnalyzerInvocation({
      tool,
      config,
      prompt,
      workspace: projectDir || process.cwd()
    });
    const resolvedInvocation = resolveWindowsSpawnInvocation(invocation);

    appendLog(
      logFile,
      `Analyzing ${lines.length} observations for project ${projectName} with ${tool}${invocation.model ? ` (${invocation.model})` : ''}...`
    );

    const child = spawnImpl(resolvedInvocation.command, resolvedInvocation.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: projectDir || process.cwd(),
      env
    });

    child.on('close', (code) => {
      if (code !== 0) {
        appendLog(logFile, `${tool} analysis failed (exit ${code})`);
      }
      archiveObservations(observationsFile, projectDir);
    });

    child.on('error', (error) => {
      appendLog(logFile, `${tool} analysis failed to start: ${error.message}`);
    });

    return child;
  }

  function runLoop(loopOptions = {}) {
    const env = loopOptions.env || process.env;
    const intervalSec = parseInt(env.CLV2_INTERVAL_SECONDS || '300', 10);
    const validateIntervalMs = parseInt(String(loopOptions.validateIntervalMs || Math.min(intervalSec * 1000, 5000)), 10);
    const setIntervalImpl = loopOptions.setIntervalImpl || setInterval;
    const clearIntervalImpl = loopOptions.clearIntervalImpl || clearInterval;
    const setTimeoutImpl = loopOptions.setTimeoutImpl || setTimeout;
    const clearTimeoutImpl = loopOptions.clearTimeoutImpl || clearTimeout;
    const exitImpl = loopOptions.exitImpl || process.exit;
    const logFile = env.CLV2_LOG_FILE;
    let analysisTimer = null;
    let validationTimer = null;
    let startupTimer = null;
    let stopped = false;

    function stopLoop(reason) {
      if (stopped) {
        return;
      }
      stopped = true;
      if (analysisTimer) {
        clearIntervalImpl(analysisTimer);
      }
      if (validationTimer) {
        clearIntervalImpl(validationTimer);
      }
      if (startupTimer) {
        clearTimeoutImpl(startupTimer);
      }
      if (reason) {
        appendLog(logFile, `Observer loop exiting: ${reason}`);
      }
      exitImpl(0);
    }

    function validateLease() {
      const status = getLoopLeaseStatus(loopOptions);
      if (status.shouldExit) {
        stopLoop(status.reason);
        return false;
      }
      return true;
    }

    function analyze() {
      if (!validateLease()) {
        return;
      }
      const analyzeImpl = loopOptions.analyzeObservations || analyzeObservations;
      analyzeImpl({
        ...loopOptions,
        env,
        config: (loopOptions.loadConfigImpl || loadObserverConfig)(configPath)
      });
    }

    validationTimer = setIntervalImpl(validateLease, validateIntervalMs);
    analysisTimer = setIntervalImpl(analyze, intervalSec * 1000);
    startupTimer = setTimeoutImpl(analyze, 5000);

    return {
      stopLoop,
      validateLease
    };
  }

  function main(argv = process.argv.slice(2), runtimeOptions = {}) {
    const env = runtimeOptions.env || process.env;
    const observerEnv = buildObserverEnv(env);
    const log = runtimeOptions.logImpl || console.log;
    const exitImpl = runtimeOptions.exitImpl || process.exit;
    const spawnImpl = runtimeOptions.spawnImpl || spawn;
    const isPidAliveImpl = runtimeOptions.isPidAliveImpl || isPidAlive;
    const setTimeoutImpl = runtimeOptions.setTimeoutImpl || setTimeout;
    for (const [key, value] of Object.entries(observerEnv)) {
      if (process.env[key] === undefined && value !== undefined) {
        process.env[key] = value;
      }
    }

    const project = detectProject(process.cwd());
    const config = loadObserverConfig();
    const pidFile = resolveObserverStateFile(project);
    const logFile = path.join(project.project_dir, 'observer.log');
    const observationsFile = project.observations_file;
    const instinctsDir = path.join(project.project_dir, 'instincts', 'personal');
    const intervalSeconds = config.run_interval_minutes * 60;
    const minObservations = config.min_observations_to_analyze;
    const cmd = argv[0] || 'start';

    if (cmd === '--loop') {
      runLoop({
        env: observerEnv,
        loadConfigImpl: loadObserverConfig
      });
      return;
    }

    log(`Project: ${project.name} (${project.id})`);
    log(`Storage: ${project.project_dir}`);
    log(`Observer tool: ${inferObserverTool(config)}`);

    if (cmd === 'stop') {
      const stopResult = stopObserverProcess(pidFile, runtimeOptions);
      if (stopResult.state && stopResult.reason === 'signaled') {
        log(`Stopping observer for ${project.name} (PID: ${stopResult.state.pid})...`);
        log('Observer stopped and lease removed.');
      } else if (stopResult.state && stopResult.reason === 'stale') {
        log(`Observer not running (stale lease removed for PID: ${stopResult.state.pid}).`);
      } else {
        log('Observer not running.');
      }
      exitImpl(0);
      return;
    }

    if (cmd === 'status') {
      const state = readObserverState(pidFile);
      if (state) {
        if (isPidAliveImpl(state.pid)) {
          log(`Observer is running (PID: ${state.pid})`);
          log(`Lease: ${pidFile}`);
          log(`Log: ${logFile}`);
          const lineCount = fs.existsSync(observationsFile)
            ? fs.readFileSync(observationsFile, 'utf8').split('\n').filter(Boolean).length
            : 0;
          log(`Observations: ${lineCount} lines`);
          const instinctCount = fs.existsSync(instinctsDir)
            ? fs.readdirSync(instinctsDir).filter(f => /\.(yaml|yml|md)$/i.test(f)).length
            : 0;
          log(`Instincts: ${instinctCount}`);
          exitImpl(0);
        } else {
          cleanupObserverStateIfStale(pidFile, runtimeOptions);
          log(`Observer not running (stale lease removed for PID: ${state.pid})`);
          exitImpl(1);
        }
      } else {
        log('Observer not running');
        exitImpl(1);
      }
      return;
    }

    if (cmd !== 'start') {
      log('Usage: node start-observer.js {start|stop|status}');
      exitImpl(1);
      return;
    }

    if (!config.enabled) {
      log('Observer is disabled in config.json (observer.enabled: false).');
      log('Set observer.enabled to true in config.json to enable.');
      exitImpl(1);
      return;
    }

    const existingState = readObserverState(pidFile);
    if (existingState) {
      if (isPidAliveImpl(existingState.pid)) {
        log(`Observer already running for ${project.name} (PID: ${existingState.pid})`);
        exitImpl(0);
        return;
      }
      cleanupObserverStateIfStale(pidFile, runtimeOptions);
    }

    log(`Starting observer agent for ${project.name}...`);
    const instanceId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const entrypoint = path.join(entrypointDir, 'start-observer.js');

    const child = spawnImpl(process.execPath, [entrypoint, '--loop'], {
      stdio: ['ignore', 'ignore', 'ignore'],
      detached: true,
      cwd: project.root || process.cwd(),
      env: {
        ...observerEnv,
        CLV2_PROJECT_DIR: project.project_dir,
        CLV2_OBSERVATIONS_FILE: observationsFile,
        CLV2_INSTINCTS_DIR: instinctsDir,
        CLV2_MIN_OBSERVATIONS: String(minObservations),
        CLV2_INTERVAL_SECONDS: String(intervalSeconds),
        CLV2_PROJECT_NAME: project.name,
        CLV2_PROJECT_ID: project.id,
        CLV2_LOG_FILE: logFile,
        MDT_HELPER_STATE_FILE: pidFile,
        MDT_HELPER_INSTANCE_ID: instanceId,
        MDT_HELPER_LEASE_GRACE_UNTIL: String(Date.now() + 10000)
      }
    });

    child.unref();

    writeManagedProcessState(pidFile, {
      pid: child.pid,
      instanceId,
      cwd: project.root || process.cwd(),
      entrypoint
    });
    appendLog(logFile, `Observer started for ${project.name} (PID: ${child.pid}, instance: ${instanceId})`);

    setTimeoutImpl(() => {
      if (isPidAliveImpl(child.pid)) {
        log(`Observer started (PID: ${child.pid})`);
        log(`Lease: ${pidFile}`);
        log(`Log: ${logFile}`);
      } else {
        const leaseStatus = evaluateManagedProcessLease({
          stateFilePath: pidFile,
          pid: child.pid,
          instanceId
        });
        log(`Failed to start observer (process died, check ${logFile})`);
        if (!leaseStatus.shouldExit) {
          stopObserverProcess(pidFile, runtimeOptions);
        }
        try {
          cleanupObserverStateIfStale(pidFile, runtimeOptions);
        } catch {
          // Best-effort stale lease cleanup.
        }
        exitImpl(1);
      }
    }, 2000);
  }

  return {
    DEFAULT_CONFIG,
    analyzeObservations,
    buildObserverEnv,
    buildAnalysisPrompt,
    buildAnalyzerInvocation,
    inferInstalledConfigDir,
    inferObserverTool,
    inferToolFromConfigDir,
    getLoopLeaseStatus,
    loadObserverConfig,
    main,
    mergeObserverConfig,
    readObserverState,
    resolveWindowsSpawnInvocation,
    resolveObserverStateFile,
    shouldResolveWindowsSpawnCommand,
    stopObserverProcess,
    runLoop
  };
}

module.exports = {
  DEFAULT_CONFIG,
  createObserverRuntime
};

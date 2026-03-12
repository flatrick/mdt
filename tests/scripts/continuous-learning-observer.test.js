/**
 * Tests for continuous-learning-manual observer runner selection.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const { createInstalledContinuousLearningLayout } = require('../helpers/continuous-learning-install-layout');
const { createObserverRuntime } = require('../../scripts/lib/continuous-learning/observer-runtime');
const {
  DEFAULT_CONFIG,
  analyzeObservations,
  buildObserverEnv,
  buildAnalyzerInvocation,
  getLoopLeaseStatus,
  inferInstalledConfigDir,
  inferObserverTool,
  inferToolFromConfigDir,
  loadObserverConfig,
  readObserverState,
  resolveWindowsSpawnInvocation,
  resolveObserverStateFile,
  shouldResolveWindowsSpawnCommand
} = require('../../skills/continuous-learning-manual/agents/start-observer.js');

function runTests() {
  console.log('\n=== Testing continuous-learning observer ===\n');

  let passed = 0;
  let failed = 0;

  if (test('loadObserverConfig keeps cheap-model defaults and merges overrides', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'observer-config-'));
    try {
      const configPath = path.join(tempDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify({
        observer: {
          enabled: true,
          models: { cursor: 'gpt-5-mini' },
          commands: { cursor: 'cursor-agent' }
        }
      }), 'utf8');

      const config = loadObserverConfig(configPath);
      assert.strictEqual(config.enabled, true);
      assert.strictEqual(config.models.claude, DEFAULT_CONFIG.models.claude);
      assert.strictEqual(config.models.cursor, 'gpt-5-mini');
      assert.strictEqual(config.commands.cursor, 'cursor-agent');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('inferToolFromConfigDir maps tool config roots correctly', () => {
    assert.strictEqual(inferToolFromConfigDir('/tmp/project/.cursor'), 'cursor');
    assert.strictEqual(inferToolFromConfigDir('/tmp/project/.claude'), 'claude');
    assert.strictEqual(inferToolFromConfigDir('/tmp/project/.codex'), 'codex');
    assert.strictEqual(inferToolFromConfigDir('/tmp/project/.unknown'), 'unknown');
  })) passed++; else failed++;

  if (test('inferInstalledConfigDir detects installed project-local Cursor config roots', () => {
    const layout = createInstalledContinuousLearningLayout({
      tool: 'cursor',
      files: ['skills/continuous-learning-manual/agents/start-observer.js']
    });
    try {
      const skillDir = layout.skillDir;
      assert.strictEqual(
        inferInstalledConfigDir(skillDir),
        layout.configDir
      );
    } finally {
      cleanupTestDir(layout.tempDir);
    }
  })) passed++; else failed++;

  if (test('inferInstalledConfigDir detects installed project-local Codex config roots', () => {
    const layout = createInstalledContinuousLearningLayout({
      tool: 'codex',
      files: ['skills/continuous-learning-manual/agents/start-observer.js']
    });
    try {
      const skillDir = layout.skillDir;
      assert.strictEqual(
        inferInstalledConfigDir(skillDir),
        layout.configDir
      );
    } finally {
      cleanupTestDir(layout.tempDir);
    }
  })) passed++; else failed++;

  if (test('buildObserverEnv anchors direct launches to installed Cursor config roots', () => {
    const layout = createInstalledContinuousLearningLayout({
      tool: 'cursor',
      files: ['skills/continuous-learning-manual/agents/start-observer.js']
    });
    try {
      const env = buildObserverEnv({}, { skillDir: layout.skillDir });
      assert.strictEqual(env.CONFIG_DIR, layout.configDir);
      assert.strictEqual(env.CURSOR_AGENT, '1');
    } finally {
      cleanupTestDir(layout.tempDir);
    }
  })) passed++; else failed++;

  if (test('inferObserverTool prefers explicit env override then detected tool', () => {
    assert.strictEqual(
      inferObserverTool(DEFAULT_CONFIG, { MDT_OBSERVER_TOOL: 'cursor', CURSOR_AGENT: '0' }),
      'cursor'
    );
    assert.strictEqual(
      inferObserverTool(DEFAULT_CONFIG, { CURSOR_AGENT: '1' }),
      'cursor'
    );
    assert.strictEqual(
      inferObserverTool({ ...DEFAULT_CONFIG, tool: 'claude' }, {}),
      'claude'
    );
    const layout = createInstalledContinuousLearningLayout({
      tool: 'cursor',
      files: ['skills/continuous-learning-manual/agents/start-observer.js']
    });
    try {
      assert.strictEqual(
        inferObserverTool(DEFAULT_CONFIG, buildObserverEnv({}, { skillDir: layout.skillDir })),
        'cursor'
      );
    } finally {
      cleanupTestDir(layout.tempDir);
    }
  })) passed++; else failed++;

  if (test('buildAnalyzerInvocation uses Claude cheap model runner', () => {
    const invocation = buildAnalyzerInvocation({
      tool: 'claude',
      config: DEFAULT_CONFIG,
      prompt: 'Analyze observations',
      workspace: '/tmp/project'
    });

    assert.strictEqual(invocation.command, 'claude');
    assert.deepStrictEqual(invocation.args, ['--print', '--max-turns', '3', '--model', 'haiku', 'Analyze observations']);
    assert.strictEqual(invocation.model, 'haiku');
  })) passed++; else failed++;

  if (test('buildAnalyzerInvocation uses Cursor native runner with configurable model', () => {
    const invocation = buildAnalyzerInvocation({
      tool: 'cursor',
      config: {
        ...DEFAULT_CONFIG,
        models: { ...DEFAULT_CONFIG.models, cursor: 'gpt-5-mini' },
        commands: { ...DEFAULT_CONFIG.commands, cursor: 'cursor-agent' }
      },
      prompt: 'Analyze observations',
      workspace: '/tmp/project'
    });

    assert.strictEqual(invocation.command, 'cursor-agent');
    assert.deepStrictEqual(
      invocation.args,
      ['--print', '--trust', '--workspace', '/tmp/project', '--model', 'gpt-5-mini', 'Analyze observations']
    );
    assert.strictEqual(invocation.model, 'gpt-5-mini');
  })) passed++; else failed++;

  if (test('buildAnalyzerInvocation uses Codex exec runner', () => {
    const invocation = buildAnalyzerInvocation({
      tool: 'codex',
      config: {
        ...DEFAULT_CONFIG,
        models: { ...DEFAULT_CONFIG.models, codex: 'gpt-5.3-codex' },
        commands: { ...DEFAULT_CONFIG.commands, codex: 'codex' }
      },
      prompt: 'Analyze observations',
      workspace: '/tmp/project'
    });

    assert.strictEqual(invocation.command, 'codex');
    assert.deepStrictEqual(
      invocation.args,
      ['exec', '--full-auto', '-C', '/tmp/project', '--model', 'gpt-5.3-codex', 'Analyze observations']
    );
    assert.strictEqual(invocation.model, 'gpt-5.3-codex');
  })) passed++; else failed++;

  if (test('shouldResolveWindowsSpawnCommand only targets bare Windows commands', () => {
    assert.strictEqual(shouldResolveWindowsSpawnCommand('codex', 'win32'), true);
    assert.strictEqual(shouldResolveWindowsSpawnCommand('C:\\tools\\codex.cmd', 'win32'), false);
    assert.strictEqual(shouldResolveWindowsSpawnCommand('codex.cmd', 'win32'), false);
    assert.strictEqual(shouldResolveWindowsSpawnCommand('codex', 'linux'), false);
  })) passed++; else failed++;

  if (test('resolveWindowsSpawnInvocation prefers cmd/exe shims for Codex on Windows', () => {
    const resolved = resolveWindowsSpawnInvocation(
      { command: 'codex', args: ['exec', '--full-auto'] },
      {
        platform: 'win32',
        execFileSyncImpl: () => 'C:\\nvm4w\\nodejs\\codex\nC:\\nvm4w\\nodejs\\codex.cmd\n'
      }
    );
    assert.strictEqual(resolved.command, 'cmd.exe');
    assert.deepStrictEqual(resolved.args, ['/d', '/s', '/c', 'C:\\nvm4w\\nodejs\\codex.cmd', 'exec', '--full-auto']);
  })) passed++; else failed++;

  if (test('analyzeObservations uses native Cursor runner and archives processed observations', () => {
    const tempDir = createTestDir('observer-runner-');
    try {
      const projectDir = path.join(tempDir, 'project');
      fs.mkdirSync(projectDir, { recursive: true });
      const observationsFile = path.join(projectDir, 'observations.jsonl');
      const instinctsDir = path.join(projectDir, 'instincts');
      const logFile = path.join(projectDir, 'observer.log');
      fs.mkdirSync(instinctsDir, { recursive: true });
      fs.writeFileSync(observationsFile, '{"event":"tool_complete"}\n{"event":"tool_complete"}\n', 'utf8');

      let spawned = null;
      const child = new EventEmitter();
      const spawnImpl = (command, args, options) => {
        spawned = { command, args, options };
        return child;
      };

      const result = analyzeObservations({
        config: {
          ...DEFAULT_CONFIG,
          tool: 'cursor',
          models: { ...DEFAULT_CONFIG.models, cursor: 'gpt-5-mini' },
          commands: { ...DEFAULT_CONFIG.commands, cursor: 'agent' }
        },
        env: {
          ...process.env,
          CLV2_OBSERVATIONS_FILE: observationsFile,
          CLV2_INSTINCTS_DIR: instinctsDir,
          CLV2_MIN_OBSERVATIONS: '2',
          CLV2_LOG_FILE: logFile,
          CLV2_PROJECT_NAME: 'demo-project',
          CLV2_PROJECT_DIR: projectDir
        },
        spawnImpl
      });

      assert.ok(result, 'Expected analyzer child process');
      assert.ok(
        spawned.command === 'agent' || spawned.command === 'cmd.exe' || /agent(\.cmd|\.exe|\.ps1)?$/i.test(spawned.command),
        `Unexpected spawned command: ${spawned.command}`
      );
      assert.ok(spawned.args.includes('--model'));
      assert.ok(spawned.args.includes('gpt-5-mini'));
      assert.ok(spawned.args.includes('--workspace'));
      assert.ok(spawned.args.includes(projectDir));

      child.emit('close', 0);

      const archiveDir = path.join(projectDir, 'observations.archive');
      assert.ok(fs.existsSync(archiveDir), 'Expected archive directory');
      const archived = fs.readdirSync(archiveDir);
      assert.ok(archived.some((name) => name.startsWith('processed-')), 'Expected archived observations file');
      const logContent = fs.readFileSync(logFile, 'utf8');
      assert.ok(logContent.includes('with cursor (gpt-5-mini)'), `Unexpected log content: ${logContent}`);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('status accepts legacy lease files and cleans stale leases', () => {
    const tempDir = createTestDir('observer-status-legacy-');
    try {
      const projectDir = path.join(tempDir, 'homunculus', 'demo-project');
      fs.mkdirSync(path.join(projectDir, 'instincts', 'personal'), { recursive: true });
      const observationsFile = path.join(projectDir, 'observations.jsonl');
      fs.writeFileSync(observationsFile, '{"event":"tool_complete"}\n', 'utf8');
      const runtime = createObserverRuntime({
        entrypointDir: path.join(process.cwd(), 'skills', 'continuous-learning-manual', 'agents'),
        skillDir: path.join(process.cwd(), 'skills', 'continuous-learning-manual'),
        configPath: path.join(process.cwd(), 'skills', 'continuous-learning-manual', 'config.json'),
        detectProject: () => ({
          id: 'demo-project',
          name: 'demo-project',
          root: tempDir,
          project_dir: projectDir,
          observations_file: observationsFile
        })
      });
      const pidFile = resolveObserverStateFile({ project_dir: projectDir });
      fs.writeFileSync(pidFile, '54321', 'utf8');

      const output = [];
      let exitCode = null;
      runtime.main(['status'], {
        logImpl: (message) => output.push(String(message)),
        exitImpl: (code) => {
          exitCode = code;
        },
        isPidAliveImpl: () => false
      });

      assert.strictEqual(exitCode, 1);
      assert.ok(output.some((line) => line.includes('stale lease removed for PID: 54321')));
      assert.strictEqual(fs.existsSync(pidFile), false);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('start writes JSON lease state and reports child PID', () => {
    const tempDir = createTestDir('observer-start-json-');
    try {
      const skillDir = path.join(process.cwd(), 'skills', 'continuous-learning-manual');
      const configPath = path.join(tempDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify({
        observer: {
          enabled: true,
          run_interval_minutes: 5,
          min_observations_to_analyze: 2
        }
      }), 'utf8');
      const projectDir = path.join(tempDir, 'project');
      fs.mkdirSync(path.join(projectDir, 'instincts', 'personal'), { recursive: true });
      const observationsFile = path.join(projectDir, 'observations.jsonl');
      const runtime = createObserverRuntime({
        entrypointDir: path.join(skillDir, 'agents'),
        skillDir,
        configPath,
        detectProject: () => ({
          id: 'demo-project',
          name: 'demo-project',
          root: tempDir,
          project_dir: projectDir,
          observations_file: observationsFile
        })
      });

      const output = [];
      let exitCode = null;
      let spawned = null;
      const fakeChild = { pid: 67890, unref: () => {} };
      runtime.main(['start'], {
        env: process.env,
        logImpl: (message) => output.push(String(message)),
        exitImpl: (code) => {
          exitCode = code;
        },
        isPidAliveImpl: (pid) => pid === 67890,
        spawnImpl: (command, args, options) => {
          spawned = { command, args, options };
          return fakeChild;
        },
        setTimeoutImpl: (fn) => {
          fn();
          return 1;
        }
      });

      const stateFile = path.join(projectDir, '.observer.pid');
      const state = readObserverState(stateFile);
      assert.ok(spawned, 'Expected detached child spawn');
      assert.strictEqual(state.pid, 67890);
      assert.ok(state.instanceId);
      assert.strictEqual(state.format, 'json');
      assert.strictEqual(spawned.options.env.MDT_HELPER_STATE_FILE, stateFile);
      assert.strictEqual(spawned.options.env.MDT_HELPER_INSTANCE_ID, state.instanceId);
      assert.ok(output.some((line) => line.includes('Observer started (PID: 67890)')));
      assert.ok(output.some((line) => line.includes(`Lease: ${stateFile}`)));
      assert.strictEqual(exitCode, null);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('stop removes lease and reports clean shutdown path', () => {
    const tempDir = createTestDir('observer-stop-json-');
    try {
      const skillDir = path.join(process.cwd(), 'skills', 'continuous-learning-manual');
      const configPath = path.join(tempDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify({ observer: { enabled: true } }), 'utf8');
      const projectDir = path.join(tempDir, 'project');
      fs.mkdirSync(projectDir, { recursive: true });
      const runtime = createObserverRuntime({
        entrypointDir: path.join(skillDir, 'agents'),
        skillDir,
        configPath,
        detectProject: () => ({
          id: 'demo-project',
          name: 'demo-project',
          root: tempDir,
          project_dir: projectDir,
          observations_file: path.join(projectDir, 'observations.jsonl')
        })
      });
      const pidFile = path.join(projectDir, '.observer.pid');
      fs.writeFileSync(pidFile, JSON.stringify({ pid: 2468, instanceId: 'instance-stop' }), 'utf8');

      const output = [];
      let exitCode = null;
      let killArgs = null;
      runtime.main(['stop'], {
        logImpl: (message) => output.push(String(message)),
        exitImpl: (code) => {
          exitCode = code;
        },
        isPidAliveImpl: () => true,
        killImpl: (pid, signal) => {
          killArgs = { pid, signal };
        }
      });

      assert.deepStrictEqual(killArgs, { pid: 2468, signal: 'SIGTERM' });
      assert.ok(output.some((line) => line.includes('Observer stopped and lease removed.')));
      assert.strictEqual(fs.existsSync(pidFile), false);
      assert.strictEqual(exitCode, 0);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('getLoopLeaseStatus exits when observer config is disabled after launch', () => {
    const tempDir = createTestDir('observer-loop-disabled-');
    try {
      const stateFile = path.join(tempDir, '.observer.pid');
      fs.writeFileSync(stateFile, JSON.stringify({
        pid: 999,
        instanceId: 'instance-live'
      }), 'utf8');

      const result = getLoopLeaseStatus({
        env: {
          MDT_HELPER_STATE_FILE: stateFile,
          MDT_HELPER_INSTANCE_ID: 'instance-live',
          MDT_HELPER_LEASE_GRACE_UNTIL: '0'
        },
        currentPid: 999,
        loadConfigImpl: () => ({ enabled: false })
      });

      assert.strictEqual(result.shouldExit, true);
      assert.strictEqual(result.reason, 'observer-disabled');
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  if (test('runLoop exits when lease is removed or replaced', () => {
    const tempDir = createTestDir('observer-loop-lease-');
    try {
      const stateFile = path.join(tempDir, '.observer.pid');
      fs.writeFileSync(stateFile, JSON.stringify({
        pid: 777,
        instanceId: 'instance-a'
      }), 'utf8');

      const runtime = createObserverRuntime({
        entrypointDir: path.join(process.cwd(), 'skills', 'continuous-learning-manual', 'agents'),
        skillDir: path.join(process.cwd(), 'skills', 'continuous-learning-manual'),
        configPath: path.join(process.cwd(), 'skills', 'continuous-learning-manual', 'config.json'),
        detectProject: () => ({})
      });

      const intervalCallbacks = [];
      const timeoutCallbacks = [];
      const exitCodes = [];

      runtime.runLoop({
        env: {
          ...process.env,
          MDT_HELPER_STATE_FILE: stateFile,
          MDT_HELPER_INSTANCE_ID: 'instance-a',
          MDT_HELPER_LEASE_GRACE_UNTIL: '0',
          CLV2_INTERVAL_SECONDS: '60',
          CLV2_LOG_FILE: path.join(tempDir, 'observer.log')
        },
        currentPid: 777,
        loadConfigImpl: () => ({ enabled: true }),
        analyzeObservations: () => null,
        setIntervalImpl: (fn) => {
          intervalCallbacks.push(fn);
          return intervalCallbacks.length;
        },
        clearIntervalImpl: () => {},
        setTimeoutImpl: (fn) => {
          timeoutCallbacks.push(fn);
          return timeoutCallbacks.length;
        },
        clearTimeoutImpl: () => {},
        exitImpl: (code) => {
          exitCodes.push(code);
        }
      });

      fs.writeFileSync(stateFile, JSON.stringify({
        pid: 777,
        instanceId: 'instance-b'
      }), 'utf8');

      intervalCallbacks[0]();
      assert.deepStrictEqual(exitCodes, [0]);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

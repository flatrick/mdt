/**
 * Tests for continuous-learning-v2 observer runner selection.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const {
  DEFAULT_CONFIG,
  analyzeObservations,
  buildAnalyzerInvocation,
  inferObserverTool,
  inferToolFromConfigDir,
  loadObserverConfig
} = require('../../skills/continuous-learning-v2/agents/start-observer.js');

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
    assert.strictEqual(inferToolFromConfigDir('/tmp/project/.unknown'), 'unknown');
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
      assert.strictEqual(spawned.command, 'agent');
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

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

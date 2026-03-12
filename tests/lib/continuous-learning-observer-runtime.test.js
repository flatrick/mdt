'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { test, cleanupTestDir } = require('../helpers/test-runner');
const { createInstalledContinuousLearningLayout } = require('../helpers/continuous-learning-install-layout');
const {
  DEFAULT_CONFIG,
  createObserverRuntime
} = require('../../scripts/lib/continuous-learning/observer-runtime');

function runTests() {
  console.log('\n=== Testing continuous-learning private observer runtime ===\n');

  let passed = 0;
  let failed = 0;

  if (test('private observer runtime infers installed Cursor config roots', () => {
    const layout = createInstalledContinuousLearningLayout({
      tool: 'cursor',
      files: ['skills/continuous-learning-manual/config.json']
    });
    try {
      const runtime = createObserverRuntime({
        entrypointDir: path.join(layout.skillDir, 'agents'),
        skillDir: layout.skillDir,
        configPath: path.join(layout.skillDir, 'config.json'),
        detectProject: () => ({})
      });
      const env = runtime.buildObserverEnv({}, { skillDir: layout.skillDir });
      assert.strictEqual(env.CONFIG_DIR, layout.configDir);
      assert.strictEqual(env.CURSOR_AGENT, '1');
    } finally {
      cleanupTestDir(layout.tempDir);
    }
  })) passed++; else failed++;

  if (test('private observer runtime analyzes observations with the configured tool', () => {
    const layout = createInstalledContinuousLearningLayout({
      tool: 'cursor',
      files: ['skills/continuous-learning-manual/config.json']
    });
    try {
      const projectDir = path.join(layout.tempDir, 'project');
      const observationsFile = path.join(projectDir, 'observations.jsonl');
      const instinctsDir = path.join(projectDir, 'instincts');
      const logFile = path.join(projectDir, 'observer.log');
      fs.mkdirSync(instinctsDir, { recursive: true });
      fs.writeFileSync(observationsFile, '{"event":"tool_complete"}\n{"event":"tool_complete"}\n', 'utf8');

      let spawned = null;
      const child = new EventEmitter();
      const runtime = createObserverRuntime({
        entrypointDir: path.join(layout.skillDir, 'agents'),
        skillDir: layout.skillDir,
        configPath: path.join(layout.skillDir, 'config.json'),
        detectProject: () => ({
          project_dir: projectDir,
          observations_file: observationsFile
        })
      });

      const result = runtime.analyzeObservations({
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
        spawnImpl: (command, args, options) => {
          spawned = { command, args, options };
          return child;
        }
      });

      assert.ok(result, 'Expected analyzer child process');
      assert.ok(
        spawned.command === 'agent' || spawned.command === 'cmd.exe' || /agent(\.cmd|\.exe|\.ps1)?$/i.test(spawned.command),
        `Unexpected spawned command: ${spawned.command}`
      );
      assert.ok(spawned.args.includes('gpt-5-mini'));

      child.emit('close', 0);
      assert.ok(fs.existsSync(path.join(projectDir, 'observations.archive')));
    } finally {
      cleanupTestDir(layout.tempDir);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

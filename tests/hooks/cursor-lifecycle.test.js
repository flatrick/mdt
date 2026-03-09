/**
 * Tests for Cursor lifecycle hook wrappers.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { asyncTest, createTestDir, cleanupTestDir, test } = require('../helpers/test-runner');
const { withEnv } = require('../helpers/env-test-utils');
const { getDateString } = require('../../scripts/lib/utils');
const { buildHookEnv, getPluginRoot, runExistingHook } = require('../../hooks/cursor/scripts/adapter');
const { processCursorAfterFileEdit } = require('../../hooks/cursor/scripts/after-file-edit');
const { processCursorAfterShellExecution } = require('../../hooks/cursor/scripts/after-shell-execution');
const { processCursorSessionEnd } = require('../../hooks/cursor/scripts/session-end');
const { processCursorStop } = require('../../hooks/cursor/scripts/stop');

function buildCursorInput(options = {}) {
  const {
    conversationId = 'cursor-conversation-12345678',
    messages = [],
    modifiedFiles = [],
    usage = null,
    model = 'cursor/test-model'
  } = options;

  const input = {
    conversation_id: conversationId,
    messages,
    modified_files: modifiedFiles,
    model
  };

  if (usage) {
    input.usage = usage;
  }

  return input;
}

async function runTests() {
  console.log('\n=== Testing Cursor lifecycle hooks ===\n');

  let passed = 0;
  let failed = 0;

  if (test('buildHookEnv injects MDT_ROOT when missing', () => {
    const env = buildHookEnv({});
    assert.strictEqual(env.MDT_ROOT, getPluginRoot());
  })) passed++; else failed++;

  if (test('buildHookEnv preserves existing MDT_ROOT', () => {
    const env = buildHookEnv({ MDT_ROOT: '/custom/root' });
    assert.strictEqual(env.MDT_ROOT, '/custom/root');
  })) passed++; else failed++;

  if (test('buildHookEnv marks delegated hooks as Cursor and anchors CONFIG_DIR to project .cursor install', () => {
    const testDir = createTestDir('cursor-hook-env-');
    const originalCwd = process.cwd();
    try {
      const configDir = path.join(testDir, '.cursor');
      fs.mkdirSync(configDir, { recursive: true });
      process.chdir(testDir);
      const env = buildHookEnv({});
      assert.strictEqual(env.CURSOR_AGENT, '1');
      assert.strictEqual(env.CONFIG_DIR, configDir);
    } finally {
      process.chdir(originalCwd);
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  if (test('runExistingHook forwards delegated stderr on success', () => {
    const testDir = createTestDir('cursor-hook-forward-');
    try {
      const scriptPath = path.join(testDir, 'warn.js');
      fs.writeFileSync(
        scriptPath,
        '#!/usr/bin/env node\nprocess.stderr.write("[MDT] delegated warning\\n");\n',
        'utf8'
      );

      let captured = '';
      runExistingHook('warn.js', '{}', {
        scriptPath,
        runner: () => ({
          status: 0,
          stdout: '',
          stderr: '[MDT] delegated warning\n'
        }),
        io: {
          stderr: {
            write: (chunk) => {
              captured += String(chunk);
            }
          }
        }
      });

      assert.ok(captured.includes('delegated warning'), `Expected delegated stderr, got: ${captured}`);
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  if (await asyncTest('session-end writes session summary from Cursor-native payload and records usage', async () => {
    const testDir = createTestDir('cursor-session-end-');
    try {
      const configDir = path.join(testDir, 'config');
      const learnConfig = path.join(testDir, 'continuous-learning.json');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        learnConfig,
        JSON.stringify({ min_session_length: 2, learned_skills_path: '<config>/skills/learned' }),
        'utf8'
      );

      const input = buildCursorInput({
        messages: [
          { role: 'user', content: 'Investigate the failing Cursor session summary hook' },
          { role: 'assistant', content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'hooks/cursor/scripts/session-end.js' } }] },
          { role: 'user', content: 'Also make cost tracking visible when usage is missing' }
        ],
        modifiedFiles: ['hooks/cursor/scripts/session-end.js', 'hooks/cursor/scripts/stop.js'],
        usage: { input_tokens: 111, output_tokens: 22, total_tokens: 133 }
      });

      await withEnv({
        CONFIG_DIR: configDir,
        MDT_CONTINUOUS_LEARNING_CONFIG: learnConfig,
        CURSOR_TRACE_ID: 'cursor-trace-12345678'
      }, async () => {
        const stderr = [];
        const originalError = console.error;
        try {
          console.error = (msg) => stderr.push(String(msg));
          const raw = JSON.stringify(input);
          const output = await processCursorSessionEnd(raw);
          assert.strictEqual(output, raw, 'Should pass through the raw Cursor payload');
        } finally {
          console.error = originalError;
        }

        const combinedStderr = stderr.join('\n');
        assert.ok(combinedStderr.includes('Session has 2 messages'), `Expected evaluation log, got: ${combinedStderr}`);

        const sessionFile = path.join(configDir, 'sessions', `${getDateString()}-12345678-session.tmp`);
        assert.ok(fs.existsSync(sessionFile), 'Should create a Cursor session file');
        const content = fs.readFileSync(sessionFile, 'utf8');
        assert.ok(content.includes('Investigate the failing Cursor session summary hook'), 'Should include user task summary');
        assert.ok(content.includes('hooks/cursor/scripts/stop.js'), 'Should include modified files from Cursor payload');
        assert.ok(content.includes('Total user messages: 2'), 'Should count user messages from Cursor payload');

        const metricsFile = path.join(configDir, 'metrics', 'costs.jsonl');
        assert.ok(fs.existsSync(metricsFile), 'Should record usage metrics when usage is provided');
        const metricsContent = fs.readFileSync(metricsFile, 'utf8');
        assert.ok(metricsContent.includes('"total_tokens":133'), 'Should store normalized usage');
      });
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  if (await asyncTest('session-end logs explicit fallback when Cursor usage data is unavailable', async () => {
    const testDir = createTestDir('cursor-session-cost-');
    try {
      const configDir = path.join(testDir, 'config');
      const learnConfig = path.join(testDir, 'continuous-learning.json');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        learnConfig,
        JSON.stringify({ min_session_length: 10, learned_skills_path: '<config>/skills/learned' }),
        'utf8'
      );

      const input = buildCursorInput({
        messages: [{ role: 'user', content: 'Short session' }]
      });

      await withEnv({
        CONFIG_DIR: configDir,
        MDT_CONTINUOUS_LEARNING_CONFIG: learnConfig,
        CURSOR_TRACE_ID: 'cursor-trace-12345678'
      }, async () => {
        const stderr = [];
        const originalError = console.error;
        try {
          console.error = (msg) => stderr.push(String(msg));
          await processCursorSessionEnd(JSON.stringify(input));
        } finally {
          console.error = originalError;
        }

        const combinedStderr = stderr.join('\n');
        assert.ok(
          combinedStderr.includes('Cost tracking: not available in Cursor payload'),
          `Expected explicit missing-usage log, got: ${combinedStderr}`
        );

        const metricsFile = path.join(configDir, 'metrics', 'costs.jsonl');
        assert.ok(!fs.existsSync(metricsFile), 'Should not create metrics file without usage');
      });
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  if (await asyncTest('session-end skips invalid payloads instead of creating a default session file', async () => {
    const testDir = createTestDir('cursor-session-invalid-');
    try {
      const configDir = path.join(testDir, 'config');
      fs.mkdirSync(configDir, { recursive: true });

      await withEnv({
        CONFIG_DIR: configDir,
        CURSOR_TRACE_ID: 'cursor-trace-12345678'
      }, async () => {
        const stderr = [];
        const originalError = console.error;
        try {
          console.error = (msg) => stderr.push(String(msg));
          await processCursorSessionEnd('{"conversation_id":');
        } finally {
          console.error = originalError;
        }

        const combinedStderr = stderr.join('\n');
        assert.ok(
          combinedStderr.includes('Invalid Cursor payload'),
          `Expected invalid payload warning, got: ${combinedStderr}`
        );
        assert.ok(!fs.existsSync(path.join(configDir, 'sessions')), 'Should not create session files for invalid payloads');
      });
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  if (await asyncTest('stop no longer writes session files or evaluates sessions', async () => {
    const testDir = createTestDir('cursor-stop-');
    try {
      const configDir = path.join(testDir, 'config');
      fs.mkdirSync(configDir, { recursive: true });

      const input = buildCursorInput({
        messages: [{ role: 'user', content: 'Do not persist from stop anymore' }],
        modifiedFiles: ['README.md']
      });

      await withEnv({
        CONFIG_DIR: configDir,
        MDT_DISABLED_HOOKS: 'stop:check-console-log',
        CURSOR_TRACE_ID: 'cursor-trace-12345678'
      }, async () => {
        const stderr = [];
        const originalError = console.error;
        try {
          console.error = (msg) => stderr.push(String(msg));
          await processCursorStop(JSON.stringify(input));
        } finally {
          console.error = originalError;
        }

        const combinedStderr = stderr.join('\n');
        assert.ok(!fs.existsSync(path.join(configDir, 'sessions')), 'Stop should not create session files');
        assert.ok(!combinedStderr.includes('Session has'), 'Stop should not evaluate session length');
        assert.ok(!combinedStderr.includes('Cost tracking'), 'Stop should not run cost tracking');
      });
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  if (await asyncTest('after-file-edit records continuous-learning observations from Cursor payloads', async () => {
    const testDir = createTestDir('cursor-after-file-edit-');
    try {
      const configDir = path.join(testDir, 'config');
      const projectDir = path.join(testDir, 'workspace');
      fs.mkdirSync(configDir, { recursive: true });
      fs.mkdirSync(projectDir, { recursive: true });

      const input = {
        conversation_id: 'cursor-observe-edit-12345678',
        path: path.join(projectDir, 'src', 'app.ts'),
        output: 'Formatted src/app.ts',
        cwd: projectDir,
        workspace_roots: [projectDir]
      };

      await withEnv({
        CONFIG_DIR: configDir,
        CURSOR_TRACE_ID: 'cursor-observe-edit-12345678'
      }, async () => {
        const output = await processCursorAfterFileEdit(JSON.stringify(input));
        assert.strictEqual(output, JSON.stringify(input), 'Should pass through raw Cursor payload');

        const homunculusRoot = path.join(configDir, 'homunculus');
        const projectsFile = path.join(homunculusRoot, 'projects.json');
        assert.ok(fs.existsSync(projectsFile), 'Should create project registry for observed Cursor activity');
        const projects = JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
        const [projectId] = Object.keys(projects);
        assert.ok(projectId, 'Should register a detected project');

        const observationsFile = path.join(homunculusRoot, 'projects', projectId, 'observations.jsonl');
        assert.ok(fs.existsSync(observationsFile), 'Should append Cursor edit observation');
        const observations = fs.readFileSync(observationsFile, 'utf8');
        assert.ok(observations.includes('"event":"tool_complete"'), 'Should record completed-tool observation');
        assert.ok(observations.includes('"tool":"Edit"'), 'Should classify the edit as Edit tool usage');
        assert.ok(observations.includes('Formatted src/app.ts'), 'Should include edit output context');
      });
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  if (await asyncTest('after-shell-execution records continuous-learning observations from Cursor payloads', async () => {
    const testDir = createTestDir('cursor-after-shell-');
    try {
      const configDir = path.join(testDir, 'config');
      const projectDir = path.join(testDir, 'workspace');
      fs.mkdirSync(configDir, { recursive: true });
      fs.mkdirSync(projectDir, { recursive: true });

      const input = {
        conversation_id: 'cursor-observe-shell-12345678',
        command: 'npm run build',
        output: 'Build succeeded',
        cwd: projectDir,
        workspace_roots: [projectDir]
      };

      await withEnv({
        CONFIG_DIR: configDir,
        CURSOR_TRACE_ID: 'cursor-observe-shell-12345678'
      }, async () => {
        const stderr = [];
        const originalError = console.error;
        try {
          console.error = (msg) => stderr.push(String(msg));
          const output = await processCursorAfterShellExecution(JSON.stringify(input));
          assert.strictEqual(output, JSON.stringify(input), 'Should pass through raw Cursor payload');
        } finally {
          console.error = originalError;
        }

        const combinedStderr = stderr.join('\n');
        assert.ok(combinedStderr.includes('Build completed'), `Expected build hook log, got: ${combinedStderr}`);

        const projects = JSON.parse(fs.readFileSync(path.join(configDir, 'homunculus', 'projects.json'), 'utf8'));
        const [projectId] = Object.keys(projects);
        const observationsFile = path.join(configDir, 'homunculus', 'projects', projectId, 'observations.jsonl');
        const observations = fs.readFileSync(observationsFile, 'utf8');
        assert.ok(observations.includes('"tool":"Bash"'), 'Should classify shell execution as Bash tool usage');
        assert.ok(observations.includes('Build succeeded'), 'Should include shell output context');
      });
    } finally {
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

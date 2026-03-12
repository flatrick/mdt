const assert = require('assert');
const path = require('path');
const { test } = require('../helpers/test-runner');
const {
  buildCiCommand,
  main,
  normalizeJsonResult,
  parseCommonOptions
} = require('../../scripts/mdt');

function createIo() {
  const stdout = [];
  const stderr = [];
  return {
    io: {
      log: (message) => stdout.push(String(message)),
      error: (message) => stderr.push(String(message))
    },
    stdout,
    stderr
  };
}

function runMain(argv) {
  const output = createIo();
  const exitCode = main(argv, output);
  return {
    exitCode,
    stdout: output.stdout.join('\n'),
    stderr: output.stderr.join('\n')
  };
}

function runTests() {
  console.log('\n=== Testing mdt CLI ===\n');

  let passed = 0;
  let failed = 0;

  if (test('parseCommonOptions normalizes shared umbrella flags', () => {
    const parsed = parseCommonOptions([
      '--format', 'json',
      '--cwd', '.',
      '--tool', 'cursor',
      '--config-root', '.cursor',
      '--surface', 'rules',
      '--dry-run',
      '--dev',
      'typescript'
    ]);

    assert.strictEqual(parsed.format, 'json');
    assert.strictEqual(parsed.tool, 'cursor');
    assert.strictEqual(parsed.surface, 'rules');
    assert.strictEqual(parsed.dryRun, true);
    assert.strictEqual(parsed.dev, true);
    assert.deepStrictEqual(parsed.positionals, ['typescript']);
  })) passed++; else failed++;

  if (test('unknown umbrella option exits with usage error', () => {
    const result = runMain(['install', '--repo', '.']);
    assert.strictEqual(result.exitCode, 2);
    assert.ok(result.stderr.includes('Unknown option: --repo'));
  })) passed++; else failed++;

  if (test('smoke workflows cursor dispatch succeeds on the real repository', () => {
    const result = runMain(['smoke', 'workflows', '--tool', 'cursor']);
    assert.strictEqual(result.exitCode, 0, result.stderr || result.stdout);
    assert.ok(result.stdout.includes('Cursor workflow smoke'));
  })) passed++; else failed++;

  if (test('smoke workflows codex supports umbrella json output', () => {
    const result = runMain(['smoke', 'workflows', '--tool', 'codex', '--format', 'json']);
    assert.strictEqual(result.exitCode, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.strictEqual(payload.ok, true);
    assert.strictEqual(payload.command, 'smoke workflows codex');
    assert.ok(payload.data.stdout.includes('"ok": true') || payload.data.stdout.includes('Codex workflow smoke'));
  })) passed++; else failed++;

  if (test('normalizeJsonResult wraps child output in the shared envelope', () => {
    const payload = normalizeJsonResult('install', 1, 'stdout line', 'stderr line');
    assert.strictEqual(payload.ok, false);
    assert.strictEqual(payload.command, 'install');
    assert.strictEqual(payload.data.exitCode, 1);
    assert.ok(payload.errors[0].message.includes('stderr line'));
  })) passed++; else failed++;

  if (test('ci validate all runs validators through the shared dispatcher', () => {
    const invoked = [];
    const result = buildCiCommand(['validate', 'all'], {
      execScript: (scriptPath, scriptArgs, options) => {
        invoked.push({
          scriptPath: path.relative(path.join(__dirname, '..', '..'), scriptPath).replace(/\\/g, '/'),
          scriptArgs,
          commandName: options.commandName
        });
        return { exitCode: 0, stdout: options.commandName, stderr: '' };
      }
    });

    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(invoked.length >= 5, true);
    assert.ok(invoked.some((entry) => entry.scriptPath === 'scripts/ci/validate-agents.js'));
    assert.ok(invoked.some((entry) => entry.scriptPath === 'scripts/ci/validate-install-packages.js'));
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

/**
 * Tests for CI validator scripts (round/edge-case set)
 *
 * Run with: node tests/ci/validators-rounds.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const validatorsDir = path.join(__dirname, '..', '..', 'scripts', 'ci');

function getValidatorFunction(validatorName) {
  const mod = require(path.join(validatorsDir, `${validatorName}.js`));
  const map = {
    'validate-agents': mod.validateAgents,
    'validate-hooks': mod.validateHooks,
    'validate-commands': mod.validateCommands,
    'validate-skills': mod.validateSkills,
    'validate-rules': mod.validateRules,
    'validate-no-hardcoded-paths': mod.validateNoHardcodedPaths
  };
  if (!map[validatorName]) {
    throw new Error(`Unsupported validator: ${validatorName}`);
  }
  return map[validatorName];
}

function runValidatorFunction(validatorName, options = {}) {
  const logs = [];
  const errors = [];
  const warns = [];
  const fn = getValidatorFunction(validatorName);
  const result = fn({
    ...options,
    io: {
      log: msg => logs.push(String(msg)),
      error: msg => errors.push(String(msg)),
      warn: msg => warns.push(String(msg))
    }
  });
  return {
    code: result.exitCode,
    stdout: logs.join('\n') + (warns.length ? `\n${warns.join('\n')}` : ''),
    stderr: errors.join('\n')
  };
}

// Test helpers
function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    return true;
  } catch (err) {
    console.log(`  \u2717 ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

function createTestDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ci-validator-test-'));
}

function cleanupTestDir(testDir) {
  fs.rmSync(testDir, { recursive: true, force: true });
}

/**
 * Run a validator script via a wrapper that overrides its directory constant.
 * This allows testing error cases without modifying real project files.
 *
 * @param {string} validatorName - e.g., 'validate-agents'
 * @param {string} dirConstant - the constant name to override (e.g., 'AGENTS_DIR')
 * @param {string} overridePath - the temp directory to use
 * @returns {{code: number, stdout: string, stderr: string}}
 */
function runValidatorWithDir(validatorName, dirConstant, overridePath) {
  const optionMap = {
    AGENTS_DIR: 'agentsDir',
    HOOKS_FILE: 'hooksFile',
    COMMANDS_DIR: 'commandsDir',
    SKILLS_DIR: 'skillsDir',
    RULES_DIR: 'rulesDir'
  };
  const key = optionMap[dirConstant];
  if (!key) throw new Error(`Unsupported dir constant: ${dirConstant}`);
  return runValidatorFunction(validatorName, { [key]: overridePath });
}

/**
 * Run a validator script with multiple directory overrides.
 * @param {string} validatorName
 * @param {Record<string, string>} overrides - map of constant name to path
 */
function runValidatorWithDirs(validatorName, overrides) {
  const optionMap = {
    AGENTS_DIR: 'agentsDir',
    HOOKS_FILE: 'hooksFile',
    COMMANDS_DIR: 'commandsDir',
    SKILLS_DIR: 'skillsDir',
    RULES_DIR: 'rulesDir'
  };
  const options = {};
  for (const [constant, overridePath] of Object.entries(overrides)) {
    const key = optionMap[constant];
    if (!key) throw new Error(`Unsupported dir constant: ${constant}`);
    options[key] = overridePath;
  }
  return runValidatorFunction(validatorName, options);
}

/**
 * Run a validator script directly (tests real project)
 */
function runValidator(validatorName) {
  return runValidatorFunction(validatorName);
}

function runTests() {
  console.log('\n=== Testing CI Validators (Round Cases) ===\n');

  let passed = 0;
  let failed = 0;
  // Round 19: Whitespace and edge-case tests
  // ==========================================

  // --- validate-hooks.js whitespace/null edge cases ---
  console.log('\nvalidate-hooks.js (whitespace edge cases):');

  if (test('rejects whitespace-only command string', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: [{ type: 'command', command: '   \t  ' }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should reject whitespace-only command');
    assert.ok(result.stderr.includes('command'), 'Should report command field error');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects null command value', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: [{ type: 'command', command: null }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should reject null command');
    assert.ok(result.stderr.includes('command'), 'Should report command field error');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects numeric command value', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: [{ type: 'command', command: 42 }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should reject numeric command');
    assert.ok(result.stderr.includes('command'), 'Should report command field error');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // --- validate-agents.js whitespace edge cases ---
  console.log('\nvalidate-agents.js (whitespace edge cases):');

  if (test('rejects agent with whitespace-only model value', () => {
    const testDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'ws-model.md'), '---\nmodel:   \t  \ntools: Read, Write\n---\n# Agent');

    const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should reject whitespace-only model');
    assert.ok(result.stderr.includes('model'), 'Should report model field error');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects agent with whitespace-only tools value', () => {
    const testDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'ws-tools.md'), '---\nmodel: sonnet\ntools:   \t  \n---\n# Agent');

    const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should reject whitespace-only tools');
    assert.ok(result.stderr.includes('tools'), 'Should report tools field error');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('accepts agent with extra unknown frontmatter fields', () => {
    const testDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'extra.md'), '---\nmodel: sonnet\ntools: Read, Write\ncustom_field: some value\nauthor: test\n---\n# Agent');

    const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
    assert.strictEqual(result.code, 0, 'Should accept extra unknown fields');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects agent with invalid model value', () => {
    const testDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'bad-model.md'), '---\nmodel: gpt-4\ntools: Read\n---\n# Agent');

    const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should reject invalid model');
    assert.ok(result.stderr.includes('Invalid model'), 'Should report invalid model');
    assert.ok(result.stderr.includes('gpt-4'), 'Should show the invalid value');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // --- validate-commands.js additional edge cases ---
  console.log('\nvalidate-commands.js (additional edge cases):');

  if (test('reports all invalid agents in mixed agent references', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();
    fs.writeFileSync(path.join(agentsDir, 'real-agent.md'), '---\nmodel: sonnet\ntools: Read\n---\n# A');
    fs.writeFileSync(path.join(testDir, 'cmd.md'),
      '# Cmd\nSee agents/real-agent.md and agents/fake-one.md and agents/fake-two.md');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    assert.strictEqual(result.code, 1, 'Should fail on invalid agent refs');
    assert.ok(result.stderr.includes('fake-one'), 'Should report first invalid agent');
    assert.ok(result.stderr.includes('fake-two'), 'Should report second invalid agent');
    assert.ok(!result.stderr.includes('real-agent'), 'Should NOT report valid agent');
    cleanupTestDir(testDir); cleanupTestDir(agentsDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  if (test('validates workflow with hyphenated agent names', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();
    fs.writeFileSync(path.join(agentsDir, 'tdd-guide.md'), '---\nmodel: sonnet\ntools: Read\n---\n# T');
    fs.writeFileSync(path.join(agentsDir, 'code-reviewer.md'), '---\nmodel: sonnet\ntools: Read\n---\n# C');
    fs.writeFileSync(path.join(testDir, 'flow.md'), '# Workflow\n\ntdd-guide -> code-reviewer');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    assert.strictEqual(result.code, 0, 'Should pass on hyphenated agent names in workflow');
    cleanupTestDir(testDir); cleanupTestDir(agentsDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  if (test('detects skill directory reference warning', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();
    // Reference a non-existent skill directory
    fs.writeFileSync(path.join(testDir, 'cmd.md'),
      '# Command\nSee skills/nonexistent-skill/ for details.');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    // Should pass (warnings don't cause exit 1) but stderr should have warning
    assert.strictEqual(result.code, 0, 'Skill warnings should not cause failure');
    assert.ok(result.stdout.includes('warning'), 'Should report warning count');
    cleanupTestDir(testDir); cleanupTestDir(agentsDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  // ==========================================
  // Round 22: Hook schema edge cases & empty directory paths
  // ==========================================

  // --- validate-hooks.js: schema edge cases ---
  console.log('\nvalidate-hooks.js (schema edge cases):');

  if (test('rejects event type value that is not an array', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: { PreToolUse: 'not-an-array' }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should fail on non-array event type value');
    assert.ok(result.stderr.includes('must be an array'), 'Should report must be an array');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects matcher entry that is null', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: { PreToolUse: [null] }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should fail on null matcher entry');
    assert.ok(result.stderr.includes('is not an object'), 'Should report not an object');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects matcher entry that is a string', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: { PreToolUse: ['just-a-string'] }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should fail on string matcher entry');
    assert.ok(result.stderr.includes('is not an object'), 'Should report not an object');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects top-level data that is a string', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, '"just a string"');

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should fail on string data');
    assert.ok(result.stderr.includes('must be an object or array'), 'Should report must be object or array');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects top-level data that is a number', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, '42');

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should fail on numeric data');
    assert.ok(result.stderr.includes('must be an object or array'), 'Should report must be object or array');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects empty string command', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: [{ type: 'command', command: '' }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should reject empty string command');
    assert.ok(result.stderr.includes('command'), 'Should report command field error');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects empty array command', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: [{ type: 'command', command: [] }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should reject empty array command');
    assert.ok(result.stderr.includes('command'), 'Should report command field error');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects array command with non-string elements', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: [{ type: 'command', command: ['node', 123, null] }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should reject non-string array elements');
    assert.ok(result.stderr.includes('command'), 'Should report command field error');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects non-string type field', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: [{ type: 42, command: 'echo hi' }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should reject non-string type');
    assert.ok(result.stderr.includes('type'), 'Should report type field error');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects non-number timeout type', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: [{ type: 'command', command: 'echo', timeout: 'fast' }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should reject string timeout');
    assert.ok(result.stderr.includes('timeout'), 'Should report timeout type error');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('accepts timeout of exactly 0', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: [{ type: 'command', command: 'echo', timeout: 0 }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 0, 'Should accept timeout of 0');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('validates object format without wrapping hooks key', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    // data.hooks is undefined, so fallback to data itself
    fs.writeFileSync(hooksFile, JSON.stringify({
      PreToolUse: [{ matcher: 'test', hooks: [{ type: 'command', command: 'echo ok' }] }]
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 0, 'Should accept object format without hooks wrapper');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // --- validate-hooks.js: legacy format error paths ---
  console.log('\nvalidate-hooks.js (legacy format errors):');

  if (test('legacy format: rejects matcher missing matcher field', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify([
      { hooks: [{ type: 'command', command: 'echo ok' }] }
    ]));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should fail on missing matcher in legacy format');
    assert.ok(result.stderr.includes('matcher'), 'Should report missing matcher');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('legacy format: rejects matcher missing hooks array', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify([
      { matcher: 'test' }
    ]));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should fail on missing hooks array in legacy format');
    assert.ok(result.stderr.includes('hooks'), 'Should report missing hooks');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // --- validate-agents.js: empty directory ---
  console.log('\nvalidate-agents.js (empty directory):');

  if (test('passes on empty agents directory', () => {
    const testDir = createTestDir();
    // No .md files, just an empty dir

    const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
    assert.strictEqual(result.code, 0, 'Should pass on empty directory');
    assert.ok(result.stdout.includes('Validated 0'), 'Should report 0 validated');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // --- validate-commands.js: whitespace-only file ---
  console.log('\nvalidate-commands.js (whitespace edge cases):');

  if (test('fails on whitespace-only command file', () => {
    const testDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'blank.md'), '   \n\t\n  ');

    const result = runValidatorWithDir('validate-commands', 'COMMANDS_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should reject whitespace-only command file');
    assert.ok(result.stderr.includes('Empty'), 'Should report empty file');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('accepts valid skill directory reference', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();
    // Create a matching skill directory
    fs.mkdirSync(path.join(skillsDir, 'my-skill'));
    fs.writeFileSync(path.join(testDir, 'cmd.md'),
      '# Command\nSee skills/my-skill/ for details.');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    assert.strictEqual(result.code, 0, 'Should pass on valid skill reference');
    assert.ok(!result.stdout.includes('warning'), 'Should have no warnings');
    cleanupTestDir(testDir); cleanupTestDir(agentsDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  // --- validate-rules.js: mixed valid/invalid ---
  console.log('\nvalidate-rules.js (mixed files):');

  if (test('fails on mix of valid and empty rule files', () => {
    const testDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'good.md'), '# Good Rule\nContent here.');
    fs.writeFileSync(path.join(testDir, 'bad.md'), '');

    const result = runValidatorWithDir('validate-rules', 'RULES_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should fail when any rule is empty');
    assert.ok(result.stderr.includes('bad.md'), 'Should report the bad file');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 27: hook validation edge cases ──
  console.log('\nvalidate-hooks.js (Round 27 edge cases):');

  if (test('rejects array command with empty string element', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: [{ type: 'command', command: ['node', '', 'script.js'] }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should reject array with empty string element');
    assert.ok(result.stderr.includes('command'), 'Should report command field error');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects negative timeout', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: [{ type: 'command', command: 'echo hi', timeout: -5 }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should reject negative timeout');
    assert.ok(result.stderr.includes('timeout'), 'Should report timeout error');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects non-boolean async field', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PostToolUse: [{ matcher: 'test', hooks: [{ type: 'command', command: 'echo ok', async: 'yes' }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should reject non-boolean async');
    assert.ok(result.stderr.includes('async'), 'Should report async type error');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('reports correct index for error in deeply nested hook', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    const manyHooks = [];
    for (let i = 0; i < 5; i++) {
      manyHooks.push({ type: 'command', command: 'echo ok' });
    }
    // Add an invalid hook at index 5
    manyHooks.push({ type: 'command', command: '' });
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: manyHooks }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should fail on invalid hook at high index');
    assert.ok(result.stderr.includes('hooks[5]'), 'Should report correct hook index 5');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('validates node -e with escaped quotes in inline JS', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: [{ type: 'command', command: 'node -e "const x = 1 + 2; process.exit(0)"' }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 0, 'Should pass valid multi-statement inline JS');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('accepts multiple valid event types in single hooks file', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: [{ type: 'command', command: 'echo pre' }] }],
        PostToolUse: [{ matcher: 'test', hooks: [{ type: 'command', command: 'echo post' }] }],
        Stop: [{ matcher: 'test', hooks: [{ type: 'command', command: 'echo stop' }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 0, 'Should accept multiple valid event types');
    assert.ok(result.stdout.includes('3'), 'Should report 3 matchers validated');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 27: command validation edge cases ──
  console.log('\nvalidate-commands.js (Round 27 edge cases):');

  if (test('validates multiple command refs on same non-creates line', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();
    // Create two valid commands
    fs.writeFileSync(path.join(testDir, 'cmd-a.md'), '# Command A\nBasic command.');
    fs.writeFileSync(path.join(testDir, 'cmd-b.md'), '# Command B\nBasic command.');
    // Create a third command that references both on one line
    fs.writeFileSync(path.join(testDir, 'cmd-c.md'),
      '# Command C\nUse `/cmd-a` and `/cmd-b` together.');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    assert.strictEqual(result.code, 0, 'Should pass when multiple refs on same line are all valid');
    cleanupTestDir(testDir); cleanupTestDir(agentsDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  if (test('fails when one of multiple refs on same line is invalid', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();
    // Only cmd-a exists
    fs.writeFileSync(path.join(testDir, 'cmd-a.md'), '# Command A\nBasic command.');
    // cmd-c references cmd-a (valid) and cmd-z (invalid) on same line
    fs.writeFileSync(path.join(testDir, 'cmd-c.md'),
      '# Command C\nUse `/cmd-a` and `/cmd-z` together.');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    assert.strictEqual(result.code, 1, 'Should fail when any ref is invalid');
    assert.ok(result.stderr.includes('cmd-z'), 'Should report the invalid reference');
    cleanupTestDir(testDir); cleanupTestDir(agentsDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  if (test('code blocks are stripped before checking references', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();
    // Reference inside a code block should not be validated
    fs.writeFileSync(path.join(testDir, 'cmd-x.md'),
      '# Command X\n```\n`/nonexistent-cmd` in code block\n```\nEnd.');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    assert.strictEqual(result.code, 0, 'Should ignore command refs inside code blocks');
    cleanupTestDir(testDir); cleanupTestDir(agentsDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  // --- validate-skills.js: mixed valid/invalid ---
  console.log('\nvalidate-skills.js (mixed dirs):');

  if (test('fails on mix of valid and invalid skill directories', () => {
    const testDir = createTestDir();
    // Valid skill
    const goodSkill = path.join(testDir, 'good-skill');
    fs.mkdirSync(goodSkill);
    fs.writeFileSync(path.join(goodSkill, 'SKILL.md'), '# Good Skill\n\n## When to Use\nUse this for valid examples.');
    // Missing SKILL.md
    const badSkill = path.join(testDir, 'bad-skill');
    fs.mkdirSync(badSkill);
    // Empty SKILL.md
    const emptySkill = path.join(testDir, 'empty-skill');
    fs.mkdirSync(emptySkill);
    fs.writeFileSync(path.join(emptySkill, 'SKILL.md'), '');

    const result = runValidatorWithDir('validate-skills', 'SKILLS_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should fail when any skill is invalid');
    assert.ok(result.stderr.includes('bad-skill'), 'Should report missing SKILL.md');
    assert.ok(result.stderr.includes('empty-skill'), 'Should report empty SKILL.md');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 30: validate-commands skill warnings and workflow edge cases ──
  console.log('\nRound 30: validate-commands (skill warnings):');

  if (test('warns (not errors) when skill directory reference is not found', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();
    // Create a command that references a skill via path (skills/name/) format
    // but the skill doesn't exist — should warn, not error
    fs.writeFileSync(path.join(testDir, 'cmd-a.md'),
      '# Command A\nSee skills/nonexistent-skill/ for details.');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    // Skill directory references produce warnings, not errors — exit 0
    assert.strictEqual(result.code, 0, 'Skill path references should warn, not error');
    cleanupTestDir(testDir); cleanupTestDir(agentsDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  if (test('passes when command has no slash references at all', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'cmd-simple.md'),
      '# Simple Command\nThis command has no references to other commands.');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    assert.strictEqual(result.code, 0, 'Should pass with no references');
    cleanupTestDir(testDir); cleanupTestDir(agentsDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  console.log('\nRound 30: validate-agents (model validation):');

  if (test('rejects agent with unrecognized model value', () => {
    const testDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'bad-model.md'),
      '---\nmodel: gpt-4\ntools: Read, Write\n---\n# Bad Model Agent');

    const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should reject unrecognized model');
    assert.ok(result.stderr.includes('gpt-4'), 'Should mention the invalid model');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('accepts all valid model values (haiku, sonnet, opus)', () => {
    const testDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'haiku.md'),
      '---\nmodel: haiku\ntools: Read\n---\n# Haiku Agent');
    fs.writeFileSync(path.join(testDir, 'sonnet.md'),
      '---\nmodel: sonnet\ntools: Read, Write\n---\n# Sonnet Agent');
    fs.writeFileSync(path.join(testDir, 'opus.md'),
      '---\nmodel: opus\ntools: Read, Write, Bash\n---\n# Opus Agent');

    const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
    assert.strictEqual(result.code, 0, 'All valid models should pass');
    assert.ok(result.stdout.includes('3'), 'Should validate 3 agent files');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 32: empty frontmatter & edge cases ──
  console.log('\nRound 32: validate-agents (empty frontmatter):');

  if (test('rejects agent with empty frontmatter block (no key-value pairs)', () => {
    const testDir = createTestDir();
    // Blank line between --- markers creates a valid but empty frontmatter block
    fs.writeFileSync(path.join(testDir, 'empty-fm.md'), '---\n\n---\n# Agent with empty frontmatter');

    const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should reject empty frontmatter');
    assert.ok(result.stderr.includes('model'), 'Should report missing model');
    assert.ok(result.stderr.includes('tools'), 'Should report missing tools');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects agent with no content between --- markers (Missing frontmatter)', () => {
    const testDir = createTestDir();
    // ---\n--- with no blank line → regex doesn't match → "Missing frontmatter"
    fs.writeFileSync(path.join(testDir, 'no-fm.md'), '---\n---\n# Agent');

    const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should reject missing frontmatter');
    assert.ok(result.stderr.includes('Missing frontmatter'), 'Should report missing frontmatter');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects agent with partial frontmatter (only model, no tools)', () => {
    const testDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'partial.md'), '---\nmodel: haiku\n---\n# Partial agent');

    const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should reject partial frontmatter');
    assert.ok(result.stderr.includes('tools'), 'Should report missing tools');
    assert.ok(!result.stderr.includes('model'), 'Should NOT report model (it is present)');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('handles multiple agents where only one is invalid', () => {
    const testDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'good.md'), '---\nmodel: sonnet\ntools: Read\n---\n# Good');
    fs.writeFileSync(path.join(testDir, 'bad.md'), '---\nmodel: invalid-model\ntools: Read\n---\n# Bad');

    const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should fail when any agent is invalid');
    assert.ok(result.stderr.includes('bad.md'), 'Should identify the bad file');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  console.log('\nRound 32: validate-rules (non-file entries):');

  if (test('skips directory entries even if named with .md extension', () => {
    const testDir = createTestDir();
    // Create a directory named "tricky.md" — stat.isFile() should skip it
    fs.mkdirSync(path.join(testDir, 'tricky.md'));
    fs.writeFileSync(path.join(testDir, 'real.md'), '# A real rule\nDo not mutate shared objects.');

    const result = runValidatorWithDir('validate-rules', 'RULES_DIR', testDir);
    assert.strictEqual(result.code, 0, 'Should skip directory entries');
    assert.ok(result.stdout.includes('Validated 1'), 'Should count only the real file');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('handles deeply nested rule in subdirectory', () => {
    const testDir = createTestDir();
    const deepDir = path.join(testDir, 'cat1', 'sub1');
    fs.mkdirSync(deepDir, { recursive: true });
    fs.writeFileSync(path.join(deepDir, 'deep-rule.md'), '# Deep nested rule\nValidate input at boundaries.');

    const result = runValidatorWithDir('validate-rules', 'RULES_DIR', testDir);
    assert.strictEqual(result.code, 0, 'Should validate deeply nested rules');
    assert.ok(result.stdout.includes('Validated 1'), 'Should find the nested rule');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  console.log('\nRound 32: validate-commands (agent reference with valid workflow):');

  if (test('passes workflow with three chained agents', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();
    fs.writeFileSync(path.join(agentsDir, 'planner.md'), '---\nmodel: sonnet\ntools: Read\n---\n# P');
    fs.writeFileSync(path.join(agentsDir, 'tdd-guide.md'), '---\nmodel: sonnet\ntools: Read\n---\n# T');
    fs.writeFileSync(path.join(agentsDir, 'code-reviewer.md'), '---\nmodel: sonnet\ntools: Read\n---\n# C');
    fs.writeFileSync(path.join(testDir, 'flow.md'), '# Flow\n\nplanner -> tdd-guide -> code-reviewer');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    assert.strictEqual(result.code, 0, 'Should pass on valid 3-agent workflow');
    cleanupTestDir(testDir); cleanupTestDir(agentsDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  if (test('detects broken agent in middle of workflow chain', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();
    fs.writeFileSync(path.join(agentsDir, 'planner.md'), '---\nmodel: sonnet\ntools: Read\n---\n# P');
    fs.writeFileSync(path.join(agentsDir, 'code-reviewer.md'), '---\nmodel: sonnet\ntools: Read\n---\n# C');
    // missing-agent is NOT created
    fs.writeFileSync(path.join(testDir, 'flow.md'), '# Flow\n\nplanner -> missing-agent -> code-reviewer');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    assert.strictEqual(result.code, 1, 'Should detect broken agent in workflow chain');
    assert.ok(result.stderr.includes('missing-agent'), 'Should report the missing agent');
    cleanupTestDir(testDir); cleanupTestDir(agentsDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  // ── Round 42: case sensitivity, space-before-colon, missing dirs, empty matchers ──
  console.log('\nRound 42: validate-agents (case sensitivity):');

  if (test('rejects uppercase model value (case-sensitive check)', () => {
    const testDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'upper.md'), '---\nmodel: Haiku\ntools: Read\n---\n# Uppercase model');

    const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should reject capitalized model');
    assert.ok(result.stderr.includes('Invalid model'), 'Should report invalid model');
    assert.ok(result.stderr.includes('Haiku'), 'Should show the rejected value');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('handles space before colon in frontmatter key', () => {
    const testDir = createTestDir();
    // "model : sonnet" — space before colon. extractFrontmatter uses indexOf(':') + trim()
    fs.writeFileSync(path.join(testDir, 'space.md'), '---\nmodel : sonnet\ntools : Read, Write\n---\n# Agent with space-colon');

    const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
    assert.strictEqual(result.code, 0, 'Should accept space before colon (trim handles it)');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  console.log('\nRound 42: validate-commands (missing agents dir):');

  if (test('flags agent path references when AGENTS_DIR does not exist', () => {
    const testDir = createTestDir();
    const skillsDir = createTestDir();
    // AGENTS_DIR points to non-existent path → validAgents set stays empty
    fs.writeFileSync(path.join(testDir, 'cmd.md'), '# Command\nSee agents/planner.md for details.');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: '/nonexistent/agents-dir', SKILLS_DIR: skillsDir
    });
    assert.strictEqual(result.code, 1, 'Should fail when agents dir missing but agent referenced');
    assert.ok(result.stderr.includes('planner'), 'Should report the unresolvable agent reference');
    cleanupTestDir(testDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  console.log('\nRound 42: validate-hooks (empty matchers array):');

  if (test('accepts event type with empty matchers array', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: []
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 0, 'Should accept empty matchers array');
    assert.ok(result.stdout.includes('Validated 0'), 'Should report 0 matchers');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 47: escape sequence and frontmatter edge cases ──
  console.log('\nRound 47: validate-hooks (inline JS escape sequences):');

  if (test('validates inline JS with mixed escape sequences (newline + escaped quote)', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    // Command value after JSON parse: node -e "var a = \"ok\"\nconsole.log(a)"
    // Regex captures: var a = \"ok\"\nconsole.log(a)
    // After unescape chain: var a = "ok"\nconsole.log(a) (real newline) — valid JS
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: [{ type: 'command',
          command: 'node -e "var a = \\"ok\\"\\nconsole.log(a)"' }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 0, 'Should handle escaped quotes and newline separators');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects inline JS with syntax error after unescaping', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    // After unescape this becomes: var x = { — missing closing brace
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: [{ type: 'command',
          command: 'node -e "var x = {"' }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should reject JS syntax error after unescaping');
    assert.ok(result.stderr.includes('invalid inline JS'), 'Should report inline JS error');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  console.log('\nRound 47: validate-agents (frontmatter lines without colon):');

  if (test('silently ignores frontmatter line without colon', () => {
    const testDir = createTestDir();
    // Line "just some text" has no colon — should be skipped, not cause crash
    fs.writeFileSync(path.join(testDir, 'mixed.md'),
      '---\nmodel: sonnet\njust some text without colon\ntools: Read\n---\n# Agent');

    const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
    assert.strictEqual(result.code, 0, 'Should ignore lines without colon in frontmatter');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 52: command inline backtick refs, workflow whitespace, code-only rules ──
  console.log('\nRound 52: validate-commands (inline backtick refs):');

  if (test('validates command refs inside inline backticks (not stripped by code block removal)', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'deploy.md'), '# Deploy\nDeploy the app.');
    // Inline backtick ref `/deploy` should be validated (only fenced blocks stripped)
    fs.writeFileSync(path.join(testDir, 'workflow.md'),
      '# Workflow\nFirst run `/deploy` to deploy the app.');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    assert.strictEqual(result.code, 0, 'Inline backtick command refs should be validated');
    cleanupTestDir(testDir); cleanupTestDir(agentsDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  console.log('\nRound 52: validate-commands (workflow whitespace):');

  if (test('validates workflow arrows with irregular whitespace', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();
    fs.writeFileSync(path.join(agentsDir, 'planner.md'), '# Planner');
    fs.writeFileSync(path.join(agentsDir, 'reviewer.md'), '# Reviewer');
    // Three workflow lines: no spaces, double spaces, tab-separated
    fs.writeFileSync(path.join(testDir, 'flow.md'),
      '# Workflow\n\nplanner->reviewer\nplanner  ->  reviewer');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    assert.strictEqual(result.code, 0, 'Workflow arrows with irregular whitespace should be valid');
    cleanupTestDir(testDir); cleanupTestDir(agentsDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  console.log('\nRound 52: validate-rules (code-only content):');

  if (test('fails rule file containing only a fenced code block (missing heading)', () => {
    const testDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'code-only.md'),
      '```javascript\nfunction example() {\n  return true;\n}\n```');

    const result = runValidatorWithDir('validate-rules', 'RULES_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Rule with only code block should fail without heading');
    assert.ok(result.stderr.includes('Missing markdown heading'), 'Should report missing heading');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 57: readFileSync error path, statSync catch block, adjacent code blocks ──
  console.log('\nRound 57: validate-skills.js (SKILL.md is a directory — readFileSync error):');

  if (test('fails gracefully when SKILL.md is a directory instead of a file', () => {
    const testDir = createTestDir();
    const skillDir = path.join(testDir, 'dir-skill');
    fs.mkdirSync(skillDir);
    // Create SKILL.md as a DIRECTORY, not a file — existsSync returns true
    // but readFileSync throws EISDIR, exercising the catch block (lines 33-37)
    fs.mkdirSync(path.join(skillDir, 'SKILL.md'));

    const result = runValidatorWithDir('validate-skills', 'SKILLS_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should fail when SKILL.md is a directory');
    assert.ok(result.stderr.includes('dir-skill'), 'Should report the problematic skill');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  console.log('\nRound 57: validate-rules.js (broken symlink — statSync catch block):');

  if (test('reports error for broken symlink .md file in rules directory', () => {
    const testDir = createTestDir();
    // Create a valid rule first
    fs.writeFileSync(path.join(testDir, 'valid.md'), '# Valid Rule');
    // Create a broken symlink (dangling → target doesn't exist)
    // statSync follows symlinks and throws ENOENT, exercising catch (lines 35-38)
    try {
      fs.symlinkSync('/nonexistent/target.md', path.join(testDir, 'broken.md'));
    } catch {
      // Skip on systems that don't support symlinks
      console.log('    (skipped — symlinks not supported)');
      cleanupTestDir(testDir);
      return;
    }

    const result = runValidatorWithDir('validate-rules', 'RULES_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should fail on broken symlink');
    assert.ok(result.stderr.includes('broken.md'), 'Should report the broken symlink file');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  console.log('\nRound 57: validate-commands.js (adjacent code blocks both stripped):');

  if (test('strips multiple adjacent code blocks before checking references', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();
    // Two adjacent code blocks, each with broken refs — BOTH must be stripped
    fs.writeFileSync(path.join(testDir, 'multi-blocks.md'),
      '# Multi Block\n\n' +
      '```\n`/phantom-a` in first block\n```\n\n' +
      'Content between blocks\n\n' +
      '```\n`/phantom-b` in second block\nagents/ghost-agent.md\n```\n\n' +
      'Final content');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    assert.strictEqual(result.code, 0,
      'Both code blocks should be stripped — no broken refs reported');
    assert.ok(!result.stderr.includes('phantom-a'), 'First block ref should be stripped');
    assert.ok(!result.stderr.includes('phantom-b'), 'Second block ref should be stripped');
    assert.ok(!result.stderr.includes('ghost-agent'), 'Agent ref in second block should be stripped');
    cleanupTestDir(testDir); cleanupTestDir(agentsDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  // ── Round 58: readFileSync catch block, colonIdx edge case, command-as-object ──
  console.log('\nRound 58: validate-agents.js (unreadable agent file — readFileSync catch):');

  if (test('reports error when agent .md file is unreadable (chmod 000)', () => {
    // Skip on Windows or when running as root (permissions won't work)
    if (process.platform === 'win32' || (process.getuid && process.getuid() === 0)) {
      console.log('    (skipped — not supported on this platform)');
      return;
    }
    const testDir = createTestDir();
    const agentFile = path.join(testDir, 'locked.md');
    fs.writeFileSync(agentFile, '---\nmodel: sonnet\ntools: Read\n---\n# Agent');
    fs.chmodSync(agentFile, 0o000);

    try {
      const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
      assert.strictEqual(result.code, 1, 'Should exit 1 on read error');
      assert.ok(result.stderr.includes('locked.md'), 'Should mention the unreadable file');
    } finally {
      fs.chmodSync(agentFile, 0o644);
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  console.log('\nRound 58: validate-agents.js (frontmatter line with colon at position 0):');

  if (test('rejects agent when required field key has colon at position 0 (no key name)', () => {
    const testDir = createTestDir();
    fs.writeFileSync(path.join(testDir, 'bad-colon.md'),
      '---\n:sonnet\ntools: Read\n---\n# Agent with leading colon');

    const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should fail — model field is missing (colon at idx 0 skipped)');
    assert.ok(result.stderr.includes('model'), 'Should report missing model field');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  console.log('\nRound 58: validate-hooks.js (command is a plain object — not string or array):');

  if (test('rejects hook entry where command is a plain object', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'test', hooks: [{ type: 'command', command: { run: 'echo hi' } }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should reject object command (not string or array)');
    assert.ok(result.stderr.includes('command'), 'Should report invalid command field');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 63: object-format missing matcher, unreadable command file, empty commands dir ──
  // Summary
  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();


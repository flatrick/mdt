/**
 * Tests for CI validator scripts (round/edge-case set)
 *
 * Run with: node tests/ci/validators-rounds-2.test.js
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

  console.log('\nRound 63: validate-hooks.js (object-format matcher missing matcher field):');

  if (test('rejects object-format matcher entry missing matcher field', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    // Object format: matcher entry has hooks array but NO matcher field
    fs.writeFileSync(hooksFile, JSON.stringify({
      hooks: {
        PreToolUse: [{ hooks: [{ type: 'command', command: 'echo ok' }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should fail on missing matcher field in object format');
    assert.ok(result.stderr.includes("missing 'matcher' field"), 'Should report missing matcher field');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  console.log('\nRound 63: validate-commands.js (unreadable command file):');

  if (test('reports error when command .md file is unreadable (chmod 000)', () => {
    if (process.platform === 'win32' || (process.getuid && process.getuid() === 0)) {
      console.log('    (skipped — not supported on this platform)');
      return;
    }
    const testDir = createTestDir();
    const cmdFile = path.join(testDir, 'locked.md');
    fs.writeFileSync(cmdFile, '# Locked Command');
    fs.chmodSync(cmdFile, 0o000);

    try {
      const result = runValidatorWithDirs('validate-commands', {
        COMMANDS_DIR: testDir, AGENTS_DIR: '/nonexistent', SKILLS_DIR: '/nonexistent'
      });
      assert.strictEqual(result.code, 1, 'Should exit 1 on read error');
      assert.ok(result.stderr.includes('locked.md'), 'Should mention the unreadable file');
    } finally {
      fs.chmodSync(cmdFile, 0o644);
      cleanupTestDir(testDir);
    }
  })) passed++; else failed++;

  console.log('\nRound 63: validate-commands.js (empty commands directory):');

  if (test('passes on empty commands directory (no .md files)', () => {
    const testDir = createTestDir();
    // Only non-.md files — no .md files to validate
    fs.writeFileSync(path.join(testDir, 'readme.txt'), 'not a command');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: '/nonexistent', SKILLS_DIR: '/nonexistent'
    });
    assert.strictEqual(result.code, 0, 'Should pass on empty commands directory');
    assert.ok(result.stdout.includes('Validated 0'), 'Should report 0 validated');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 65: empty directories for rules and skills ──
  console.log('\nRound 65: validate-rules.js (empty directory — no .md files):');

  if (test('passes on rules directory with no .md files (Validated 0)', () => {
    const testDir = createTestDir();
    // Only non-.md files — readdirSync filter yields empty array
    fs.writeFileSync(path.join(testDir, 'notes.txt'), 'not a rule');
    fs.writeFileSync(path.join(testDir, 'config.json'), '{}');

    const result = runValidatorWithDir('validate-rules', 'RULES_DIR', testDir);
    assert.strictEqual(result.code, 0, 'Should pass on empty rules directory');
    assert.ok(result.stdout.includes('Validated 0'), 'Should report 0 validated rule files');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  console.log('\nRound 65: validate-skills.js (empty directory — no subdirectories):');

  if (test('passes on skills directory with only files, no subdirectories (Validated 0)', () => {
    const testDir = createTestDir();
    // Only files, no subdirectories — isDirectory filter yields empty array
    fs.writeFileSync(path.join(testDir, 'README.md'), '# Skills');
    fs.writeFileSync(path.join(testDir, '.gitkeep'), '');

    const result = runValidatorWithDir('validate-skills', 'SKILLS_DIR', testDir);
    assert.strictEqual(result.code, 0, 'Should pass on skills directory with no subdirectories');
    assert.ok(result.stdout.includes('Validated 0'), 'Should report 0 validated skill directories');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 70: validate-commands.js "would create:" line skip ──
  console.log('\nRound 70: validate-commands.js (would create: skip):');

  if (test('skips command references on "would create:" lines', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();
    // "Would create:" is the alternate form checked by the regex at line 80:
    //   if (/creates:|would create:/i.test(line)) continue;
    // Only "creates:" was previously tested (Round 20). "Would create:" exercises
    // the second alternation in the regex.
    fs.writeFileSync(path.join(testDir, 'gen-cmd.md'),
      '# Generator Command\n\nWould create: `/phantom-cmd` in your project.\n\nThis is safe.');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    assert.strictEqual(result.code, 0, 'Should skip "would create:" lines');
    assert.ok(!result.stderr.includes('phantom-cmd'), 'Should not flag ref on "would create:" line');
    cleanupTestDir(testDir); cleanupTestDir(agentsDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  // ── Round 72: validate-hooks.js async/timeout type validation ──
  console.log('\nRound 72: validate-hooks.js (async and timeout type validation):');

  if (test('rejects hook with non-boolean async field', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      PreToolUse: [{
        matcher: 'Write',
        hooks: [{
          type: 'intercept',
          command: 'echo test',
          async: 'yes'  // Should be boolean, not string
        }]
      }]
    }));
    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should fail on non-boolean async');
    assert.ok(result.stderr.includes('async'), 'Should mention async in error');
    assert.ok(result.stderr.includes('boolean'), 'Should mention boolean type');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (test('rejects hook with negative timeout value', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, JSON.stringify({
      PostToolUse: [{
        matcher: 'Edit',
        hooks: [{
          type: 'intercept',
          command: 'echo test',
          timeout: -5  // Must be non-negative
        }]
      }]
    }));
    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1, 'Should fail on negative timeout');
    assert.ok(result.stderr.includes('timeout'), 'Should mention timeout in error');
    assert.ok(result.stderr.includes('non-negative'), 'Should mention non-negative');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 73: validate-commands.js skill directory statSync catch ──
  console.log('\nRound 73: validate-commands.js (unreadable skill entry — statSync catch):');

  if (test('skips unreadable skill directory entries without error (broken symlink)', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();

    // Create one valid skill directory and one broken symlink
    const validSkill = path.join(skillsDir, 'valid-skill');
    fs.mkdirSync(validSkill, { recursive: true });
    // Broken symlink: target does not exist — statSync will throw ENOENT
    const brokenLink = path.join(skillsDir, 'broken-skill');
    fs.symlinkSync('/nonexistent/target/path', brokenLink);

    // Command that references the valid skill (should resolve)
    fs.writeFileSync(path.join(testDir, 'cmd.md'),
      '# Command\nSee skills/valid-skill/ for details.');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    assert.strictEqual(result.code, 0,
      'Should pass — broken symlink in skills dir should be skipped silently');
    // The broken-skill should NOT be in validSkills, so referencing it would warn
    // but the valid-skill reference should resolve fine
    cleanupTestDir(testDir);
    cleanupTestDir(agentsDir);
    fs.rmSync(skillsDir, { recursive: true, force: true });
  })) passed++; else failed++;

  // ── Round 76: validate-hooks.js invalid JSON in hooks.json ──
  console.log('\nRound 76: validate-hooks.js (invalid JSON in hooks.json):');

  if (test('reports error for invalid JSON in hooks.json', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    fs.writeFileSync(hooksFile, '{not valid json!!!');

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 1,
      `Expected exit 1 for invalid JSON, got ${result.code}`);
    assert.ok(result.stderr.includes('Invalid JSON'),
      `stderr should mention Invalid JSON, got: ${result.stderr}`);
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 78: validate-hooks.js wrapped { hooks: { ... } } format ──
  console.log('\nRound 78: validate-hooks.js (wrapped hooks format):');

  if (test('validates wrapped format { hooks: { PreToolUse: [...] } }', () => {
    const testDir = createTestDir();
    const hooksFile = path.join(testDir, 'hooks.json');
    // The production hooks.json uses this wrapped format — { hooks: { ... } }
    // data.hooks is the object with event types, not data itself
    fs.writeFileSync(hooksFile, JSON.stringify({
      "$schema": "https://json.schemastore.org/claude-code-settings.json",
      hooks: {
        PreToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'echo ok' }] }],
        PostToolUse: [{ matcher: 'Read', hooks: [{ type: 'command', command: 'echo done' }] }]
      }
    }));

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', hooksFile);
    assert.strictEqual(result.code, 0,
      `Should pass wrapped hooks format, got exit ${result.code}. stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes('Validated 2'),
      `Should validate 2 matchers, got: ${result.stdout}`);
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 79: validate-commands.js warnings count suffix in output ──
  console.log('\nRound 79: validate-commands.js (warnings count in output):');

  if (test('output includes (N warnings) suffix when skill references produce warnings', () => {
    const testDir = createTestDir();
    const agentsDir = createTestDir();
    const skillsDir = createTestDir();
    // Create a command that references 2 non-existent skill directories
    // Each triggers a WARN (not error) — warnCount should be 2
    fs.writeFileSync(path.join(testDir, 'cmd-warn.md'),
      '# Command\nSee skills/fake-skill-a/ and skills/fake-skill-b/ for details.');

    const result = runValidatorWithDirs('validate-commands', {
      COMMANDS_DIR: testDir, AGENTS_DIR: agentsDir, SKILLS_DIR: skillsDir
    });
    assert.strictEqual(result.code, 0, 'Skill warnings should not cause error exit');
    // The validate-commands output appends "(N warnings)" when warnCount > 0
    assert.ok(result.stdout.includes('(2 warnings)'),
      `Output should include "(2 warnings)" suffix, got: ${result.stdout}`);
    cleanupTestDir(testDir); cleanupTestDir(agentsDir); cleanupTestDir(skillsDir);
  })) passed++; else failed++;

  // ── Round 80: validate-hooks.js legacy array format (lines 115-135) ──
  console.log('\nRound 80: validate-hooks.js (legacy array format):');

  if (test('validates hooks in legacy array format (hooks is an array, not object)', () => {
    const testDir = createTestDir();
    // The legacy array format wraps hooks as { hooks: [...] } where the array
    // contains matcher objects directly. This exercises lines 115-135 of
    // validate-hooks.js which use "Hook ${i}" error labels instead of "${eventType}[${i}]".
    const hooksJson = JSON.stringify({
      hooks: [
        {
          matcher: 'Edit',
          hooks: [{ type: 'command', command: 'echo legacy test' }]
        }
      ]
    });
    fs.writeFileSync(path.join(testDir, 'hooks.json'), hooksJson);

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', path.join(testDir, 'hooks.json'));
    assert.strictEqual(result.code, 0, 'Should pass on valid legacy array format');
    assert.ok(result.stdout.includes('Validated 1 hook'),
      `Should report 1 validated matcher, got: ${result.stdout}`);
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 82: Notification and SubagentStop event types ──

  console.log('\nRound 82: validate-hooks (Notification and SubagentStop event types):');

  if (test('accepts Notification and SubagentStop as valid event types', () => {
    const testDir = createTestDir();
    const hooksJson = JSON.stringify({
      hooks: [
        {
          matcher: { type: 'Notification' },
          hooks: [{ type: 'command', command: 'echo notification' }]
        },
        {
          matcher: { type: 'SubagentStop' },
          hooks: [{ type: 'command', command: 'echo subagent stopped' }]
        }
      ]
    });
    fs.writeFileSync(path.join(testDir, 'hooks.json'), hooksJson);

    const result = runValidatorWithDir('validate-hooks', 'HOOKS_FILE', path.join(testDir, 'hooks.json'));
    assert.strictEqual(result.code, 0, 'Should pass with Notification and SubagentStop events');
    assert.ok(result.stdout.includes('Validated 2 hook'),
      `Should report 2 validated matchers, got: ${result.stdout}`);
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // ── Round 83: validate-agents whitespace-only field, validate-skills empty SKILL.md ──

  console.log('\nRound 83: validate-agents (whitespace-only frontmatter field value):');

  if (test('rejects agent with whitespace-only model field (trim guard)', () => {
    const testDir = createTestDir();
    // model has only whitespace — extractFrontmatter produces { model: '   ', tools: 'Read' }
    // The condition: typeof frontmatter[field] === 'string' && !frontmatter[field].trim()
    // evaluates to true for model → "Missing required field: model"
    fs.writeFileSync(path.join(testDir, 'ws.md'), '---\nmodel:   \ntools: Read\n---\n# Whitespace model');

    const result = runValidatorWithDir('validate-agents', 'AGENTS_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should reject whitespace-only model');
    assert.ok(result.stderr.includes('model'), 'Should report missing model field');
    assert.ok(!result.stderr.includes('tools'), 'tools field is valid and should NOT be flagged');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  console.log('\nRound 83: validate-skills (empty SKILL.md file):');

  if (test('rejects skill directory with empty SKILL.md file', () => {
    const testDir = createTestDir();
    const skillDir = path.join(testDir, 'empty-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    // Create SKILL.md with only whitespace (trim to zero length)
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '   \n  \n');

    const result = runValidatorWithDir('validate-skills', 'SKILLS_DIR', testDir);
    assert.strictEqual(result.code, 1, 'Should reject empty SKILL.md');
    assert.ok(result.stderr.includes('Empty file'),
      `Should report "Empty file", got: ${result.stderr}`);
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // Round 95: validate-no-hardcoded-paths.js (Node-only runtime guard)
  console.log('\nRound 95: validate-no-hardcoded-paths.js:');

  if (test('passes on real project (Node-only: no .sh/.ps1 in repo, no hardcoded ~/.claude/)', () => {
    const result = runValidator('validate-no-hardcoded-paths');
    assert.strictEqual(result.code, 0, `Should pass, got stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes('Validated Node-only runtime'), 'Should output validation message');
  })) passed++; else failed++;

  // Summary
  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();



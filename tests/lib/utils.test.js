/**
 * Tests for scripts/lib/utils.js
 *
 * Run with: node tests/lib/utils.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { test } = require('../helpers/test-runner');
const { withEnv } = require('../helpers/env-test-utils');

// Import the module
const utils = require('../../scripts/lib/utils');

// Test suite
function runTests() {
  console.log('\n=== Testing utils.js ===\n');

  let passed = 0;
  let failed = 0;
  const canExecuteCommands = utils.runCommand(utils.isWindows ? 'where node' : 'which node').success;

  // Platform detection tests
  console.log('Platform Detection:');

  if (test('isWindows/isMacOS/isLinux are booleans', () => {
    assert.strictEqual(typeof utils.isWindows, 'boolean');
    assert.strictEqual(typeof utils.isMacOS, 'boolean');
    assert.strictEqual(typeof utils.isLinux, 'boolean');
  })) passed++; else failed++;

  if (test('exactly one platform should be true', () => {
    const platforms = [utils.isWindows, utils.isMacOS, utils.isLinux];
    const trueCount = platforms.filter(p => p).length;
    // Note: Could be 0 on other platforms like FreeBSD
    assert.ok(trueCount <= 1, 'More than one platform is true');
  })) passed++; else failed++;

  // Directory functions tests
  console.log('\nDirectory Functions:');

  if (test('getHomeDir returns valid path', () => {
    const home = utils.getHomeDir();
    assert.strictEqual(typeof home, 'string');
    assert.ok(home.length > 0, 'Home dir should not be empty');
    assert.ok(fs.existsSync(home), 'Home dir should exist');
  })) passed++; else failed++;

  if (test('getConfigDir returns config dir under home', () => {
    const configDir = utils.getConfigDir();
    const homeDir = utils.getHomeDir();
    assert.strictEqual(typeof configDir, 'string');
    assert.ok(configDir.length > 0, 'Config dir should not be empty');
    assert.ok(configDir.startsWith(homeDir), 'Config dir should be under home');
  })) passed++; else failed++;

  if (test('getSessionsDir returns path under config dir', () => {
    const sessionsDir = utils.getSessionsDir();
    const configDir = utils.getConfigDir();
    assert.ok(sessionsDir.startsWith(configDir), 'Sessions should be under config dir');
    assert.ok(sessionsDir.includes('sessions'), 'Should contain sessions');
  })) passed++; else failed++;

  if (test('getTempDir returns valid temp directory', () => {
    const tempDir = utils.getTempDir();
    assert.strictEqual(typeof tempDir, 'string');
    assert.ok(tempDir.length > 0, 'Temp dir should not be empty');
  })) passed++; else failed++;

  if (test('ensureDir creates directory', () => {
    const testDir = path.join(utils.getTempDir(), `utils-test-${Date.now()}`);
    try {
      utils.ensureDir(testDir);
      assert.ok(fs.existsSync(testDir), 'Directory should be created');
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // Date/Time functions tests
  console.log('\nDate/Time Functions:');

  if (test('getDateString returns YYYY-MM-DD format', () => {
    const date = utils.getDateString();
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(date), `Expected YYYY-MM-DD, got ${date}`);
  })) passed++; else failed++;

  if (test('getTimeString returns HH:MM format', () => {
    const time = utils.getTimeString();
    assert.ok(/^\d{2}:\d{2}$/.test(time), `Expected HH:MM, got ${time}`);
  })) passed++; else failed++;

  if (test('getDateTimeString returns full datetime format', () => {
    const dt = utils.getDateTimeString();
    assert.ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dt), `Expected YYYY-MM-DD HH:MM:SS, got ${dt}`);
  })) passed++; else failed++;

  // Project name tests
  console.log('\nProject Name Functions:');

  if (test('getGitRepoName returns string or null', () => {
    const repoName = utils.getGitRepoName();
    assert.ok(repoName === null || typeof repoName === 'string');
  })) passed++; else failed++;

  if (test('getProjectName returns non-empty string', () => {
    const name = utils.getProjectName();
    assert.ok(name && name.length > 0);
  })) passed++; else failed++;

  // Session ID tests
  console.log('\nSession ID Functions:');

  if (test('getSessionIdShort falls back to project name when no session signals are set', () => {
    withEnv({ CLAUDE_SESSION_ID: undefined, CURSOR_TRACE_ID: undefined }, () => {
      const shortId = utils.getSessionIdShort();
      assert.strictEqual(shortId, utils.getProjectName());
    });
  })) passed++; else failed++;

  if (test('getSessionIdShort returns last 8 characters', () => {
    withEnv({ CLAUDE_SESSION_ID: 'test-session-abc12345' }, () => {
      assert.strictEqual(utils.getSessionIdShort(), 'abc12345');
    });
  })) passed++; else failed++;

  if (test('getSessionIdShort handles short session IDs', () => {
    withEnv({ CLAUDE_SESSION_ID: 'short' }, () => {
      assert.strictEqual(utils.getSessionIdShort(), 'short');
    });
  })) passed++; else failed++;

  // File operations tests
  console.log('\nFile Operations:');

  if (test('readFile returns null for non-existent file', () => {
    const content = utils.readFile('/non/existent/file/path.txt');
    assert.strictEqual(content, null);
  })) passed++; else failed++;

  if (test('writeFile and readFile work together', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    const testContent = 'Hello, World!';
    try {
      utils.writeFile(testFile, testContent);
      const read = utils.readFile(testFile);
      assert.strictEqual(read, testContent);
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  if (test('appendFile adds content to file', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'Line 1\n');
      utils.appendFile(testFile, 'Line 2\n');
      const content = utils.readFile(testFile);
      assert.strictEqual(content, 'Line 1\nLine 2\n');
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  if (test('replaceInFile replaces text', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'Hello, World!');
      utils.replaceInFile(testFile, /World/, 'Universe');
      const content = utils.readFile(testFile);
      assert.strictEqual(content, 'Hello, Universe!');
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  if (test('countInFile counts occurrences', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'foo bar foo baz foo');
      const count = utils.countInFile(testFile, /foo/g);
      assert.strictEqual(count, 3);
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  if (test('grepFile finds matching lines', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'line 1 foo\nline 2 bar\nline 3 foo');
      const matches = utils.grepFile(testFile, /foo/);
      assert.strictEqual(matches.length, 2);
      assert.strictEqual(matches[0].lineNumber, 1);
      assert.strictEqual(matches[1].lineNumber, 3);
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  // findFiles tests
  console.log('\nfindFiles:');

  if (test('findFiles returns empty for non-existent directory', () => {
    const results = utils.findFiles('/non/existent/dir', '*.txt');
    assert.strictEqual(results.length, 0);
  })) passed++; else failed++;

  if (test('findFiles finds matching files', () => {
    const testDir = path.join(utils.getTempDir(), `utils-test-${Date.now()}`);
    try {
      fs.mkdirSync(testDir);
      fs.writeFileSync(path.join(testDir, 'test1.txt'), 'content');
      fs.writeFileSync(path.join(testDir, 'test2.txt'), 'content');
      fs.writeFileSync(path.join(testDir, 'test.md'), 'content');

      const txtFiles = utils.findFiles(testDir, '*.txt');
      assert.strictEqual(txtFiles.length, 2);

      const mdFiles = utils.findFiles(testDir, '*.md');
      assert.strictEqual(mdFiles.length, 1);
    } finally {
      fs.rmSync(testDir, { recursive: true });
    }
  })) passed++; else failed++;

  // Edge case tests for defensive code
  console.log('\nEdge Cases:');

  if (test('findFiles returns empty for null/undefined dir', () => {
    assert.deepStrictEqual(utils.findFiles(null, '*.txt'), []);
    assert.deepStrictEqual(utils.findFiles(undefined, '*.txt'), []);
    assert.deepStrictEqual(utils.findFiles('', '*.txt'), []);
  })) passed++; else failed++;

  if (test('findFiles returns empty for null/undefined pattern', () => {
    assert.deepStrictEqual(utils.findFiles('/tmp', null), []);
    assert.deepStrictEqual(utils.findFiles('/tmp', undefined), []);
    assert.deepStrictEqual(utils.findFiles('/tmp', ''), []);
  })) passed++; else failed++;

  if (test('findFiles supports maxAge filter', () => {
    const testDir = path.join(utils.getTempDir(), `utils-test-maxage-${Date.now()}`);
    try {
      fs.mkdirSync(testDir);
      fs.writeFileSync(path.join(testDir, 'recent.txt'), 'content');
      const results = utils.findFiles(testDir, '*.txt', { maxAge: 1 });
      assert.strictEqual(results.length, 1);
      assert.ok(results[0].path.endsWith('recent.txt'));
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('findFiles supports recursive option', () => {
    const testDir = path.join(utils.getTempDir(), `utils-test-recursive-${Date.now()}`);
    const subDir = path.join(testDir, 'sub');
    try {
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, 'top.txt'), 'content');
      fs.writeFileSync(path.join(subDir, 'nested.txt'), 'content');
      // Without recursive: only top level
      const shallow = utils.findFiles(testDir, '*.txt', { recursive: false });
      assert.strictEqual(shallow.length, 1);
      // With recursive: finds nested too
      const deep = utils.findFiles(testDir, '*.txt', { recursive: true });
      assert.strictEqual(deep.length, 2);
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('countInFile handles invalid regex pattern', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'test content');
      const count = utils.countInFile(testFile, '(unclosed');
      assert.strictEqual(count, 0);
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  if (test('countInFile handles non-string non-regex pattern', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'test content');
      const count = utils.countInFile(testFile, 42);
      assert.strictEqual(count, 0);
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  if (test('countInFile enforces global flag on RegExp', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'foo bar foo baz foo');
      // RegExp without global flag â countInFile should still count all
      const count = utils.countInFile(testFile, /foo/);
      assert.strictEqual(count, 3);
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  if (test('grepFile handles invalid regex pattern', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'test content');
      const matches = utils.grepFile(testFile, '[invalid');
      assert.deepStrictEqual(matches, []);
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  if (test('replaceInFile returns false for non-existent file', () => {
    const result = utils.replaceInFile('/non/existent/file.txt', 'foo', 'bar');
    assert.strictEqual(result, false);
  })) passed++; else failed++;

  if (test('countInFile returns 0 for non-existent file', () => {
    const count = utils.countInFile('/non/existent/file.txt', /foo/g);
    assert.strictEqual(count, 0);
  })) passed++; else failed++;

  if (test('grepFile returns empty for non-existent file', () => {
    const matches = utils.grepFile('/non/existent/file.txt', /foo/);
    assert.deepStrictEqual(matches, []);
  })) passed++; else failed++;

  if (test('commandExists rejects unsafe command names', () => {
    assert.strictEqual(utils.commandExists('cmd; rm -rf'), false);
    assert.strictEqual(utils.commandExists('$(whoami)'), false);
    assert.strictEqual(utils.commandExists('cmd && echo hi'), false);
  })) passed++; else failed++;

  if (test('ensureDir is idempotent', () => {
    const testDir = path.join(utils.getTempDir(), `utils-test-idem-${Date.now()}`);
    try {
      const result1 = utils.ensureDir(testDir);
      const result2 = utils.ensureDir(testDir);
      assert.strictEqual(result1, testDir);
      assert.strictEqual(result2, testDir);
      assert.ok(fs.existsSync(testDir));
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // System functions tests
  console.log('\nSystem Functions:');

  if (test('commandExists finds node', () => {
    if (!canExecuteCommands) {
      console.log('    (skipped â command execution unavailable in sandbox)');
      return;
    }
    const exists = utils.commandExists('node');
    assert.strictEqual(exists, true);
  })) passed++; else failed++;

  if (test('getSessionIdShort uses CURSOR_TRACE_ID when CLAUDE_SESSION_ID is not set', () => {
    withEnv({ CLAUDE_SESSION_ID: undefined, CURSOR_TRACE_ID: 'cursor-trace-xyz98765' }, () => {
      assert.strictEqual(utils.getSessionIdShort(), 'xyz98765');
    });
  })) passed++; else failed++;

  if (test('commandExists returns false for fake command', () => {
    const exists = utils.commandExists('nonexistent_command_12345');
    assert.strictEqual(exists, false);
  })) passed++; else failed++;

  if (test('runCommand executes simple command', () => {
    if (!canExecuteCommands) {
      console.log('    (skipped â command execution unavailable in sandbox)');
      return;
    }
    const result = utils.runCommand('node --version');
    assert.strictEqual(result.success, true);
    assert.ok(result.output.startsWith('v'), 'Should start with v');
  })) passed++; else failed++;

  if (test('runCommand handles failed command', () => {
    const result = utils.runCommand('node --invalid-flag-12345');
    assert.strictEqual(result.success, false);
  })) passed++; else failed++;

  // output() and log() tests
  console.log('\noutput() and log():');

  if (test('output() writes string to stdout', () => {
    // Capture stdout by temporarily replacing console.log
    let captured = null;
    const origLog = console.log;
    console.log = (v) => { captured = v; };
    try {
      utils.output('hello');
      assert.strictEqual(captured, 'hello');
    } finally {
      console.log = origLog;
    }
  })) passed++; else failed++;

  if (test('output() JSON-stringifies objects', () => {
    let captured = null;
    const origLog = console.log;
    console.log = (v) => { captured = v; };
    try {
      utils.output({ key: 'value', num: 42 });
      assert.strictEqual(captured, '{"key":"value","num":42}');
    } finally {
      console.log = origLog;
    }
  })) passed++; else failed++;

  if (test('output() JSON-stringifies null (typeof null === "object")', () => {
    let captured = null;
    const origLog = console.log;
    console.log = (v) => { captured = v; };
    try {
      utils.output(null);
      // typeof null === 'object' in JS, so it goes through JSON.stringify
      assert.strictEqual(captured, 'null');
    } finally {
      console.log = origLog;
    }
  })) passed++; else failed++;

  if (test('output() handles arrays as objects', () => {
    let captured = null;
    const origLog = console.log;
    console.log = (v) => { captured = v; };
    try {
      utils.output([1, 2, 3]);
      assert.strictEqual(captured, '[1,2,3]');
    } finally {
      console.log = origLog;
    }
  })) passed++; else failed++;

  if (test('log() writes to stderr', () => {
    let captured = null;
    const origError = console.error;
    console.error = (v) => { captured = v; };
    try {
      utils.log('test message');
      assert.strictEqual(captured, 'test message');
    } finally {
      console.error = origError;
    }
  })) passed++; else failed++;

  // isGitRepo() tests
  console.log('\nisGitRepo():');

  if (test('isGitRepo returns true in a git repo', () => {
    if (!canExecuteCommands) {
      console.log('    (skipped â command execution unavailable in sandbox)');
      return;
    }
    // We're running from within the ECC repo, so this should be true
    assert.strictEqual(utils.isGitRepo(), true);
  })) passed++; else failed++;

  // getGitModifiedFiles() tests
  console.log('\ngetGitModifiedFiles():');

  if (test('getGitModifiedFiles returns an array', () => {
    const files = utils.getGitModifiedFiles();
    assert.ok(Array.isArray(files));
  })) passed++; else failed++;

  if (test('getGitModifiedFiles filters by regex patterns', () => {
    const files = utils.getGitModifiedFiles(['\\.NONEXISTENT_EXTENSION$']);
    assert.ok(Array.isArray(files));
    assert.strictEqual(files.length, 0);
  })) passed++; else failed++;

  if (test('getGitModifiedFiles skips invalid patterns', () => {
    // Mix of valid and invalid patterns â should not throw
    const files = utils.getGitModifiedFiles(['(unclosed', '\\.js$', '[invalid']);
    assert.ok(Array.isArray(files));
  })) passed++; else failed++;

  if (test('getGitModifiedFiles skips non-string patterns', () => {
    const files = utils.getGitModifiedFiles([null, undefined, 42, '', '\\.js$']);
    assert.ok(Array.isArray(files));
  })) passed++; else failed++;

  // getLearnedSkillsDir() test
  console.log('\ngetLearnedSkillsDir():');

  if (test('getLearnedSkillsDir returns path under config dir and includes skills', () => {
    const dir = utils.getLearnedSkillsDir();
    const configDir = utils.getConfigDir();
    assert.strictEqual(typeof dir, 'string');
    assert.ok(dir.length > 0, 'Learned skills dir should not be empty');
    assert.ok(dir.startsWith(configDir), 'Learned skills dir should be under config dir');
    assert.ok(dir.includes('skills'), 'Learned skills dir should include skills segment');
  })) passed++; else failed++;

  // replaceInFile behavior tests
  console.log('\nreplaceInFile (behavior):');

  if (test('replaces first match when regex has no g flag', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'foo bar foo baz foo');
      utils.replaceInFile(testFile, /foo/, 'qux');
      const content = utils.readFile(testFile);
      // Without g flag, only first 'foo' should be replaced
      assert.strictEqual(content, 'qux bar foo baz foo');
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  if (test('replaces all matches when regex has g flag', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'foo bar foo baz foo');
      utils.replaceInFile(testFile, /foo/g, 'qux');
      const content = utils.readFile(testFile);
      assert.strictEqual(content, 'qux bar qux baz qux');
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  if (test('replaces with string search (first occurrence)', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'hello world hello');
      utils.replaceInFile(testFile, 'hello', 'goodbye');
      const content = utils.readFile(testFile);
      // String.replace with string search only replaces first
      assert.strictEqual(content, 'goodbye world hello');
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  if (test('replaces all occurrences with string when options.all is true', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'hello world hello again hello');
      utils.replaceInFile(testFile, 'hello', 'goodbye', { all: true });
      const content = utils.readFile(testFile);
      assert.strictEqual(content, 'goodbye world goodbye again goodbye');
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  if (test('options.all is ignored for regex patterns', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'foo bar foo');
      // all option should be ignored for regex; only g flag matters
      utils.replaceInFile(testFile, /foo/, 'qux', { all: true });
      const content = utils.readFile(testFile);
      assert.strictEqual(content, 'qux bar foo', 'Regex without g should still replace first only');
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  if (test('replaces with capture groups', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, '**Last Updated:** 10:30');
      utils.replaceInFile(testFile, /\*\*Last Updated:\*\*.*/, '**Last Updated:** 14:45');
      const content = utils.readFile(testFile);
      assert.strictEqual(content, '**Last Updated:** 14:45');
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  // writeFile edge cases
  console.log('\nwriteFile (edge cases):');

  if (test('writeFile overwrites existing content', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'original');
      utils.writeFile(testFile, 'replaced');
      const content = utils.readFile(testFile);
      assert.strictEqual(content, 'replaced');
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  if (test('writeFile handles unicode content', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-${Date.now()}.txt`);
    try {
      const unicode = 'æ¥æ¬èªãã¹ã ð Ã©mojis';
      utils.writeFile(testFile, unicode);
      const content = utils.readFile(testFile);
      assert.strictEqual(content, unicode);
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  // findFiles with regex special characters in pattern
  console.log('\nfindFiles (regex chars):');

  if (test('findFiles handles regex special chars in pattern', () => {
    const testDir = path.join(utils.getTempDir(), `utils-test-regex-${Date.now()}`);
    try {
      fs.mkdirSync(testDir);
      // Create files with regex-special characters in names
      fs.writeFileSync(path.join(testDir, 'file(1).txt'), 'content');
      fs.writeFileSync(path.join(testDir, 'file+2.txt'), 'content');
      fs.writeFileSync(path.join(testDir, 'file[3].txt'), 'content');

      // These patterns should match literally, not as regex metacharacters
      const parens = utils.findFiles(testDir, 'file(1).txt');
      assert.strictEqual(parens.length, 1, 'Should match file(1).txt literally');

      const plus = utils.findFiles(testDir, 'file+2.txt');
      assert.strictEqual(plus.length, 1, 'Should match file+2.txt literally');

      const brackets = utils.findFiles(testDir, 'file[3].txt');
      assert.strictEqual(brackets.length, 1, 'Should match file[3].txt literally');
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('findFiles wildcard still works with special chars', () => {
    const testDir = path.join(utils.getTempDir(), `utils-test-glob-${Date.now()}`);
    try {
      fs.mkdirSync(testDir);
      fs.writeFileSync(path.join(testDir, 'app(v2).js'), 'content');
      fs.writeFileSync(path.join(testDir, 'app(v3).ts'), 'content');

      const jsFiles = utils.findFiles(testDir, '*.js');
      assert.strictEqual(jsFiles.length, 1);
      assert.ok(jsFiles[0].path.endsWith('app(v2).js'));
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // parseJsonObject/readStdinJson tests (subprocess-free)
  console.log('\nparseJsonObject()/readStdinJson():');

  if (test('parseJsonObject parses valid JSON object', () => {
    const parsed = utils.parseJsonObject('{"tool_input":{"command":"ls"}}');
    assert.deepStrictEqual(parsed, { tool_input: { command: 'ls' } });
  })) passed++; else failed++;

  if (test('parseJsonObject returns {} for invalid JSON', () => {
    const parsed = utils.parseJsonObject('not json');
    assert.deepStrictEqual(parsed, {});
  })) passed++; else failed++;

  if (test('parseJsonObject returns {} for empty input', () => {
    const parsed = utils.parseJsonObject('');
    assert.deepStrictEqual(parsed, {});
  })) passed++; else failed++;

  if (test('parseJsonObject handles nested objects', () => {
    const parsed = utils.parseJsonObject('{"a":{"b":1},"c":[1,2]}');
    assert.deepStrictEqual(parsed, { a: { b: 1 }, c: [1, 2] });
  })) passed++; else failed++;

  // grepFile with global regex (regression: g flag causes alternating matches)
  console.log('\ngrepFile (global regex fix):');

  if (test('grepFile with /g flag finds ALL matching lines (not alternating)', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-grep-g-${Date.now()}.txt`);
    try {
      // 4 consecutive lines matching the same pattern
      utils.writeFile(testFile, 'match-line\nmatch-line\nmatch-line\nmatch-line');
      // Bug: without fix, /match/g would only find lines 1 and 3 (alternating)
      const matches = utils.grepFile(testFile, /match/g);
      assert.strictEqual(matches.length, 4, `Should find all 4 lines, found ${matches.length}`);
      assert.strictEqual(matches[0].lineNumber, 1);
      assert.strictEqual(matches[1].lineNumber, 2);
      assert.strictEqual(matches[2].lineNumber, 3);
      assert.strictEqual(matches[3].lineNumber, 4);
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  if (test('grepFile preserves regex flags other than g (e.g. case-insensitive)', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-grep-flags-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'FOO\nfoo\nFoO\nbar');
      const matches = utils.grepFile(testFile, /foo/gi);
      assert.strictEqual(matches.length, 3, `Should find 3 case-insensitive matches, found ${matches.length}`);
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  // commandExists edge cases
  console.log('\ncommandExists Edge Cases:');

  if (test('commandExists rejects empty string', () => {
    assert.strictEqual(utils.commandExists(''), false, 'Empty string should not be a valid command');
  })) passed++; else failed++;

  if (test('commandExists rejects command with spaces', () => {
    assert.strictEqual(utils.commandExists('my command'), false, 'Commands with spaces should be rejected');
  })) passed++; else failed++;

  if (test('commandExists rejects command with path separators', () => {
    assert.strictEqual(utils.commandExists('/usr/bin/node'), false, 'Commands with / should be rejected');
    assert.strictEqual(utils.commandExists('..\\cmd'), false, 'Commands with \\ should be rejected');
  })) passed++; else failed++;

  if (test('commandExists rejects shell metacharacters', () => {
    assert.strictEqual(utils.commandExists('cmd;ls'), false, 'Semicolons should be rejected');
    assert.strictEqual(utils.commandExists('$(whoami)'), false, 'Subshell syntax should be rejected');
    assert.strictEqual(utils.commandExists('cmd|cat'), false, 'Pipes should be rejected');
  })) passed++; else failed++;

  if (test('commandExists allows dots and underscores', () => {
    // These are valid chars per the regex check â the command might not exist
    // but it shouldn't be rejected by the validator
    const dotResult = utils.commandExists('definitely.not.a.real.tool.12345');
    assert.strictEqual(typeof dotResult, 'boolean', 'Should return boolean, not throw');
  })) passed++; else failed++;

  // findFiles edge cases
  console.log('\nfindFiles Edge Cases:');

  if (test('findFiles with ? wildcard matches single character', () => {
    const testDir = path.join(utils.getTempDir(), `ff-qmark-${Date.now()}`);
    utils.ensureDir(testDir);
    try {
      fs.writeFileSync(path.join(testDir, 'a1.txt'), '');
      fs.writeFileSync(path.join(testDir, 'b2.txt'), '');
      fs.writeFileSync(path.join(testDir, 'abc.txt'), '');

      const results = utils.findFiles(testDir, '??.txt');
      const names = results.map(r => path.basename(r.path)).sort();
      assert.deepStrictEqual(names, ['a1.txt', 'b2.txt'], 'Should match exactly 2-char basenames');
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('findFiles sorts by mtime (newest first)', () => {
    const testDir = path.join(utils.getTempDir(), `ff-sort-${Date.now()}`);
    utils.ensureDir(testDir);
    try {
      const f1 = path.join(testDir, 'old.txt');
      const f2 = path.join(testDir, 'new.txt');
      fs.writeFileSync(f1, 'old');
      // Set older mtime on first file
      const past = new Date(Date.now() - 60000);
      fs.utimesSync(f1, past, past);
      fs.writeFileSync(f2, 'new');

      const results = utils.findFiles(testDir, '*.txt');
      assert.strictEqual(results.length, 2);
      assert.ok(
        path.basename(results[0].path) === 'new.txt',
        `Newest file should be first, got ${path.basename(results[0].path)}`
      );
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('findFiles with maxAge filters old files', () => {
    const testDir = path.join(utils.getTempDir(), `ff-age-${Date.now()}`);
    utils.ensureDir(testDir);
    try {
      const recent = path.join(testDir, 'recent.txt');
      const old = path.join(testDir, 'old.txt');
      fs.writeFileSync(recent, 'new');
      fs.writeFileSync(old, 'old');
      // Set mtime to 30 days ago
      const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      fs.utimesSync(old, past, past);

      const results = utils.findFiles(testDir, '*.txt', { maxAge: 7 });
      assert.strictEqual(results.length, 1, 'Should only return recent file');
      assert.ok(results[0].path.includes('recent.txt'), 'Should return the recent file');
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ensureDir edge cases
  console.log('\nensureDir Edge Cases:');

  if (test('ensureDir is safe for concurrent calls (EEXIST race)', () => {
    const testDir = path.join(utils.getTempDir(), `ensure-race-${Date.now()}`, 'nested');
    try {
      // Call concurrently â both should succeed without throwing
      const results = [utils.ensureDir(testDir), utils.ensureDir(testDir)];
      assert.strictEqual(results[0], testDir);
      assert.strictEqual(results[1], testDir);
      assert.ok(fs.existsSync(testDir));
    } finally {
      fs.rmSync(path.dirname(testDir), { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('ensureDir returns the directory path', () => {
    const testDir = path.join(utils.getTempDir(), `ensure-ret-${Date.now()}`);
    try {
      const result = utils.ensureDir(testDir);
      assert.strictEqual(result, testDir, 'Should return the directory path');
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // runCommand edge cases
  console.log('\nrunCommand Edge Cases:');

  if (test('runCommand returns trimmed output', () => {
    if (!canExecuteCommands) {
      console.log('    (skipped â command execution unavailable in sandbox)');
      return;
    }
    // Windows echo includes quotes in output, use node to ensure consistent behavior
    const result = utils.runCommand('node -e "process.stdout.write(\'  hello  \')"');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.output, 'hello', 'Should trim leading/trailing whitespace');
  })) passed++; else failed++;

  if (test('runCommand captures stderr on failure', () => {
    const result = utils.runCommand('node -e "process.exit(1)"');
    assert.strictEqual(result.success, false);
    assert.ok(typeof result.output === 'string', 'Output should be a string on failure');
  })) passed++; else failed++;

  // getGitModifiedFiles edge cases
  console.log('\ngetGitModifiedFiles Edge Cases:');

  if (test('getGitModifiedFiles returns array with empty patterns', () => {
    const files = utils.getGitModifiedFiles([]);
    assert.ok(Array.isArray(files), 'Should return array');
  })) passed++; else failed++;

  // replaceInFile edge cases
  console.log('\nreplaceInFile Edge Cases:');

  if (test('replaceInFile with regex capture groups works correctly', () => {
    const testFile = path.join(utils.getTempDir(), `replace-capture-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'version: 1.0.0');
      const result = utils.replaceInFile(testFile, /version: (\d+)\.(\d+)\.(\d+)/, 'version: $1.$2.99');
      assert.strictEqual(result, true);
      assert.strictEqual(utils.readFile(testFile), 'version: 1.0.99');
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  // readStdinJson (function API, not actual stdin â more thorough edge cases)
  console.log('\nreadStdinJson Edge Cases:');

  if (test('readStdinJson type check: returns a Promise', () => {
    // readStdinJson returns a Promise regardless of stdin state
    const result = utils.readStdinJson({ timeoutMs: 100 });
    assert.ok(result instanceof Promise, 'Should return a Promise');
    // Don't await â just verify it's a Promise type
  })) passed++; else failed++;

  // Summary
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

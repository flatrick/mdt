/**
 * Tests for scripts/lib/utils.js
 *
 * Run with: node tests/lib/utils-rounds.test.js
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
  console.log('\n=== Testing utils.js (Round Cases) ===\n');

  let passed = 0;
  let failed = 0;
  const canExecuteCommands = utils.runCommand(utils.isWindows ? 'where node' : 'which node').success;

  // ââ Round 28: parseJsonObject whitespace/BOM handling ââ
  console.log('\nparseJsonObject edge cases:');

  if (test('parseJsonObject returns {} for whitespace-only input', () => {
    const parsed = utils.parseJsonObject('   \n  \t  ');
    assert.deepStrictEqual(parsed, {});
  })) passed++; else failed++;

  if (test('parseJsonObject handles JSON with trailing whitespace/newlines', () => {
    const parsed = utils.parseJsonObject('{"a":1}  \n\n');
    assert.deepStrictEqual(parsed, { a: 1 });
  })) passed++; else failed++;

  if (test('parseJsonObject handles JSON with BOM prefix', () => {
    const parsed = utils.parseJsonObject('\uFEFF{"a":1}');
    assert.deepStrictEqual(parsed, { a: 1 });
  })) passed++; else failed++;

  // ââ Round 31: ensureDir error propagation ââ
  console.log('\nensureDir Error Propagation (Round 31):');

  if (test('ensureDir wraps non-EEXIST errors with descriptive message', () => {
    // Attempting to create a dir under a file should fail with ENOTDIR, not EEXIST
    const testFile = path.join(utils.getTempDir(), `ensure-err-${Date.now()}.txt`);
    try {
      fs.writeFileSync(testFile, 'blocking file');
      const badPath = path.join(testFile, 'subdir');
      assert.throws(
        () => utils.ensureDir(badPath),
        (err) => err.message.includes('Failed to create directory'),
        'Should throw with descriptive "Failed to create directory" message'
      );
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  if (test('ensureDir error includes the directory path', () => {
    const testFile = path.join(utils.getTempDir(), `ensure-err2-${Date.now()}.txt`);
    try {
      fs.writeFileSync(testFile, 'blocker');
      const badPath = path.join(testFile, 'nested', 'dir');
      try {
        utils.ensureDir(badPath);
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err.message.includes(badPath), 'Error should include the target path');
      }
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  // ââ Round 31: runCommand stderr preference on failure ââ
  console.log('\nrunCommand failure output (Round 31):');

  if (test('runCommand returns stderr content on failure when stderr exists', () => {
    if (!canExecuteCommands) {
      console.log('    (skipped â command execution unavailable in sandbox)');
      return;
    }
    const result = utils.runCommand('node -e "process.stderr.write(\'custom error\'); process.exit(1)"');
    assert.strictEqual(result.success, false);
    assert.ok(result.output.includes('custom error'), 'Should include stderr output');
  })) passed++; else failed++;

  if (test('runCommand falls back to err.message when no stderr', () => {
    // An invalid command that won't produce stderr through child process
    const result = utils.runCommand('nonexistent_cmd_xyz_12345');
    assert.strictEqual(result.success, false);
    assert.ok(result.output.length > 0, 'Should have some error output');
  })) passed++; else failed++;

  // ââ Round 31: getGitModifiedFiles with empty patterns ââ
  console.log('\ngetGitModifiedFiles empty patterns (Round 31):');

  if (test('getGitModifiedFiles with empty array returns all modified files', () => {
    // With an empty patterns array, every file should match (no filter applied)
    const withEmpty = utils.getGitModifiedFiles([]);
    const withNone = utils.getGitModifiedFiles();
    // Both should return the same list (no filtering)
    assert.deepStrictEqual(withEmpty, withNone,
      'Empty patterns array should behave same as no patterns');
  })) passed++; else failed++;

  // ââ Round 33: parseJsonObject non-object input guards ââ
  console.log('\nparseJsonObject input guards (Round 33):');

  if (test('parseJsonObject returns {} for primitive JSON values', () => {
    assert.deepStrictEqual(utils.parseJsonObject('"hello"'), {});
    assert.deepStrictEqual(utils.parseJsonObject('42'), {});
    assert.deepStrictEqual(utils.parseJsonObject('true'), {});
    assert.deepStrictEqual(utils.parseJsonObject('null'), {});
  })) passed++; else failed++;

  // replaceInFile returns false when write fails (e.g., read-only file)
  if (test('replaceInFile returns false on write failure (read-only file)', () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) {
      console.log('    (skipped â chmod ineffective on Windows/root)');
      return;
    }
    const testDir = path.join(utils.getTempDir(), `utils-test-readonly-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    const filePath = path.join(testDir, 'readonly.txt');
    try {
      fs.writeFileSync(filePath, 'hello world', 'utf8');
      fs.chmodSync(filePath, 0o444);
      const result = utils.replaceInFile(filePath, 'hello', 'goodbye');
      assert.strictEqual(result, false, 'Should return false when file is read-only');
      // Verify content unchanged
      const content = fs.readFileSync(filePath, 'utf8');
      assert.strictEqual(content, 'hello world', 'Original content should be preserved');
    } finally {
      fs.chmodSync(filePath, 0o644);
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 69: getGitModifiedFiles with ALL invalid patterns ââ
  console.log('\ngetGitModifiedFiles all-invalid patterns (Round 69):');

  if (test('getGitModifiedFiles with all-invalid patterns skips filtering (returns all files)', () => {
    // When every pattern is invalid regex, compiled.length === 0 at line 386,
    // so the filtering is skipped entirely and all modified files are returned.
    // This differs from the mixed-valid test where at least one pattern compiles.
    const allInvalid = utils.getGitModifiedFiles(['(unclosed', '[bad', '**invalid']);
    const unfiltered = utils.getGitModifiedFiles();
    // Both should return the same list â all-invalid patterns = no filtering
    assert.deepStrictEqual(allInvalid, unfiltered,
      'All-invalid patterns should return same result as no patterns (no filtering)');
  })) passed++; else failed++;

  // ââ Round 71: findFiles recursive scan skips unreadable subdirectory ââ
  console.log('\nRound 71: findFiles (unreadable subdirectory in recursive scan):');

  if (test('findFiles recursive scan skips unreadable subdirectory silently', () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) {
      console.log('    (skipped â chmod ineffective on Windows/root)');
      return;
    }
    const tmpDir = path.join(utils.getTempDir(), `MDT-findfiles-r71-${Date.now()}`);
    const readableSubdir = path.join(tmpDir, 'readable');
    const unreadableSubdir = path.join(tmpDir, 'unreadable');
    fs.mkdirSync(readableSubdir, { recursive: true });
    fs.mkdirSync(unreadableSubdir, { recursive: true });

    // Create files in both subdirectories
    fs.writeFileSync(path.join(readableSubdir, 'found.txt'), 'data');
    fs.writeFileSync(path.join(unreadableSubdir, 'hidden.txt'), 'data');

    // Make the subdirectory unreadable â readdirSync will throw EACCES
    fs.chmodSync(unreadableSubdir, 0o000);

    try {
      const results = utils.findFiles(tmpDir, '*.txt', { recursive: true });
      // Should find the readable file but silently skip the unreadable dir
      assert.ok(results.length >= 1, 'Should find at least the readable file');
      const paths = results.map(r => r.path);
      assert.ok(paths.some(p => p.includes('found.txt')), 'Should find readable/found.txt');
      assert.ok(!paths.some(p => p.includes('hidden.txt')), 'Should not find unreadable/hidden.txt');
    } finally {
      fs.chmodSync(unreadableSubdir, 0o755);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 79: countInFile with valid string pattern ââ
  console.log('\nRound 79: countInFile (valid string pattern):');

  if (test('countInFile counts occurrences using a plain string pattern', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-count-str-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'apple banana apple cherry apple');
      // Pass a plain string (not RegExp) â exercises typeof pattern === 'string'
      // branch at utils.js:441-442 which creates new RegExp(pattern, 'g')
      const count = utils.countInFile(testFile, 'apple');
      assert.strictEqual(count, 3, 'String pattern should count all occurrences');
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  // ââ Round 79: grepFile with valid string pattern ââ
  console.log('\nRound 79: grepFile (valid string pattern):');

  if (test('grepFile finds matching lines using a plain string pattern', () => {
    const testFile = path.join(utils.getTempDir(), `utils-test-grep-str-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'line1 alpha\nline2 beta\nline3 alpha\nline4 gamma');
      // Pass a plain string (not RegExp) â exercises the else branch
      // at utils.js:468-469 which creates new RegExp(pattern)
      const matches = utils.grepFile(testFile, 'alpha');
      assert.strictEqual(matches.length, 2, 'String pattern should find 2 matching lines');
      assert.strictEqual(matches[0].lineNumber, 1, 'First match at line 1');
      assert.strictEqual(matches[1].lineNumber, 3, 'Second match at line 3');
      assert.ok(matches[0].content.includes('alpha'), 'Content should include pattern');
    } finally {
      fs.unlinkSync(testFile);
    }
  })) passed++; else failed++;

  // ââ Round 84: findFiles inner statSync catch (TOCTOU â broken symlink) ââ
  console.log('\nRound 84: findFiles (inner statSync catch â broken symlink):');

  if (test('findFiles skips broken symlinks that match the pattern', () => {
    // findFiles at utils.js:170-173: readdirSync returns entries including broken
    // symlinks (entry.isFile() returns false for broken symlinks, but the test also
    // verifies the overall robustness). On some systems, broken symlinks can be
    // returned by readdirSync and pass through isFile() depending on the driver.
    // More importantly: if statSync throws inside the inner loop, catch continues.
    //
    // To reliably trigger the statSync catch: create a real file, list it, then
    // simulate the race. Since we can't truly race, we use a broken symlink which
    // will at minimum verify the function doesn't crash on unusual dir entries.
    const tmpDir = path.join(utils.getTempDir(), `MDT-r84-findfiles-toctou-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    // Create a real file and a broken symlink, both matching *.txt
    const realFile = path.join(tmpDir, 'real.txt');
    fs.writeFileSync(realFile, 'content');
    const brokenLink = path.join(tmpDir, 'broken.txt');
    fs.symlinkSync('/nonexistent/path/does/not/exist', brokenLink);

    try {
      const results = utils.findFiles(tmpDir, '*.txt');
      // The real file should be found; the broken symlink should be skipped
      const paths = results.map(r => r.path);
      assert.ok(paths.some(p => p.includes('real.txt')), 'Should find the real file');
      assert.ok(!paths.some(p => p.includes('broken.txt')),
        'Should not include broken symlink in results');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 85: getSessionIdShort fallback parameter ââ
  console.log('\ngetSessionIdShort fallback (Round 85):');

  if (test('getSessionIdShort uses fallback when getProjectName returns null (CWD at root)', () => {
    if (process.platform === 'win32') {
      console.log('    (skipped â root CWD differs on Windows)');
      return;
    }
    const previousCwd = process.cwd();
    try {
      process.chdir('/');
      withEnv({ CLAUDE_SESSION_ID: '' }, () => {
        const result = utils.getSessionIdShort('my-custom-fallback');
        assert.strictEqual(result, 'my-custom-fallback',
          `At CWD=/ with no session ID, should use the fallback parameter. Got: "${result}"`);
      });
    } finally {
      process.chdir(previousCwd);
    }
  })) passed++; else failed++;

  // ââ Round 88: replaceInFile with empty replacement (deletion) ââ
  console.log('\nRound 88: replaceInFile with empty replacement string (deletion):');
  if (test('replaceInFile with empty string replacement deletes matched text', () => {
    const tmpDir = path.join(utils.getTempDir(), `MDT-r88-replace-empty-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, 'delete-test.txt');
    try {
      fs.writeFileSync(tmpFile, 'hello REMOVE_ME world');
      const result = utils.replaceInFile(tmpFile, 'REMOVE_ME ', '');
      assert.strictEqual(result, true, 'Should return true on successful replacement');
      const content = fs.readFileSync(tmpFile, 'utf8');
      assert.strictEqual(content, 'hello world',
        'Empty replacement should delete the matched text');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 88: countInFile with valid file but zero matches ââ
  console.log('\nRound 88: countInFile with existing file but non-matching pattern:');
  if (test('countInFile returns 0 for valid file with no pattern matches', () => {
    const tmpDir = path.join(utils.getTempDir(), `MDT-r88-count-zero-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, 'no-match.txt');
    try {
      fs.writeFileSync(tmpFile, 'apple banana cherry');
      const count = utils.countInFile(tmpFile, 'ZZZZNOTHERE');
      assert.strictEqual(count, 0,
        'Should return 0 when regex matches nothing in existing file');
      const countRegex = utils.countInFile(tmpFile, /ZZZZNOTHERE/g);
      assert.strictEqual(countRegex, 0,
        'Should return 0 for RegExp with no matches in existing file');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 92: countInFile with object pattern type ââ
  console.log('\nRound 92: countInFile (non-string non-RegExp pattern):');

  if (test('countInFile returns 0 for object pattern (neither string nor RegExp)', () => {
    // utils.js line 443-444: The else branch returns 0 when pattern is
    // not instanceof RegExp and typeof !== 'string'. An object like {invalid: true}
    // triggers this early return without throwing.
    const testFile = path.join(utils.getTempDir(), `utils-test-obj-pattern-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'some test content to match against');
      const count = utils.countInFile(testFile, { invalid: 'object' });
      assert.strictEqual(count, 0, 'Object pattern should return 0');
    } finally {
      try { fs.unlinkSync(testFile); } catch { /* best-effort */ }
    }
  })) passed++; else failed++;

  // ââ Round 93: countInFile with /pattern/i (g flag appended) ââ
  console.log('\nRound 93: countInFile (case-insensitive RegExp, g flag auto-appended):');

  if (test('countInFile with /pattern/i appends g flag and counts case-insensitively', () => {
    // utils.js line 440: pattern.flags = 'i', 'i'.includes('g') â false,
    // so new RegExp(source, 'i' + 'g') â /pattern/ig
    const testFile = path.join(utils.getTempDir(), `utils-test-ci-flag-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'Foo foo FOO fOo bar baz');
      const count = utils.countInFile(testFile, /foo/i);
      assert.strictEqual(count, 4,
        'Case-insensitive regex with auto-appended g should match all 4 occurrences');
    } finally {
      try { fs.unlinkSync(testFile); } catch { /* best-effort */ }
    }
  })) passed++; else failed++;

  // ââ Round 93: countInFile with /pattern/gi (g flag already present) ââ
  console.log('\nRound 93: countInFile (case-insensitive RegExp, g flag preserved):');

  if (test('countInFile with /pattern/gi preserves existing flags and counts correctly', () => {
    // utils.js line 440: pattern.flags = 'gi', 'gi'.includes('g') â true,
    // so new RegExp(source, 'gi') â flags preserved unchanged
    const testFile = path.join(utils.getTempDir(), `utils-test-gi-flag-${Date.now()}.txt`);
    try {
      utils.writeFile(testFile, 'Foo foo FOO fOo bar baz');
      const count = utils.countInFile(testFile, /foo/gi);
      assert.strictEqual(count, 4,
        'Case-insensitive regex with pre-existing g should match all 4 occurrences');
    } finally {
      try { fs.unlinkSync(testFile); } catch { /* best-effort */ }
    }
  })) passed++; else failed++;

  // ââ Round 95: countInFile with regex alternation (no g flag) ââ
  console.log('\nRound 95: countInFile (regex alternation without g flag):');

  if (test('countInFile with /apple|banana/ (alternation, no g) counts all matches', () => {
    const tmpDir = path.join(utils.getTempDir(), `MDT-r95-alternation-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const testFile = path.join(tmpDir, 'alternation.txt');
    try {
      utils.writeFile(testFile, 'apple banana apple cherry banana apple');
      // /apple|banana/ has alternation but no g flag â countInFile should auto-append g
      const count = utils.countInFile(testFile, /apple|banana/);
      assert.strictEqual(count, 5,
        'Should find 3 apples + 2 bananas = 5 total (g flag auto-appended to alternation regex)');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 97: getSessionIdShort with whitespace-only CLAUDE_SESSION_ID ââ
  console.log('\nRound 97: getSessionIdShort (whitespace-only session ID):');

  if (test('getSessionIdShort returns whitespace when CLAUDE_SESSION_ID is all spaces', () => {
    // utils.js line 116: if (sessionId && sessionId.length > 0) â '   ' is truthy
    // and has length > 0, so it passes the check instead of falling back.
    withEnv({ CLAUDE_SESSION_ID: '          ' }, () => {
      const result = utils.getSessionIdShort('fallback');
      // slice(-8) on 10 spaces returns 8 spaces â not the expected fallback
      assert.strictEqual(result, '        ',
        'Whitespace-only ID should return 8 trailing spaces (no trim check)');
      assert.strictEqual(result.trim().length, 0,
        'Result should be entirely whitespace (demonstrating the missing trim)');
    });
  })) passed++; else failed++;

  // ââ Round 97: countInFile with same RegExp object called twice (lastIndex reuse) ââ
  console.log('\nRound 97: countInFile (RegExp lastIndex reuse validation):');

  if (test('countInFile returns consistent count when same RegExp object is reused', () => {
    // utils.js lines 438-440: Always creates a new RegExp to prevent lastIndex
    // state bugs. Without this defense, a global regex's lastIndex would persist
    // between calls, causing alternating match/miss behavior.
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r97-lastindex-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      fs.writeFileSync(testFile, 'foo bar foo baz foo\nfoo again foo');
      const sharedRegex = /foo/g;
      // First call
      const count1 = utils.countInFile(testFile, sharedRegex);
      // Second call with SAME regex object â would fail without defensive new RegExp
      const count2 = utils.countInFile(testFile, sharedRegex);
      assert.strictEqual(count1, 5, 'First call should find 5 matches');
      assert.strictEqual(count2, 5,
        'Second call with same RegExp should also find 5 (lastIndex reset by defensive code)');
      assert.strictEqual(count1, count2,
        'Both calls must return identical counts (proves lastIndex is not shared)');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 98: findFiles with maxAge: -1 (negative boundary â excludes everything) ââ
  console.log('\nRound 98: findFiles (maxAge: -1 â negative boundary excludes all):');

  if (test('findFiles with maxAge: -1 excludes all files (ageInDays always >= 0)', () => {
    // utils.js line 176-178: `if (maxAge !== null) { ageInDays = ...; if (ageInDays <= maxAge) }`
    // With maxAge: -1, the condition requires ageInDays <= -1. Since ageInDays =
    // (Date.now() - mtimeMs) / 86400000 is always >= 0 for real files, nothing passes.
    // This negative boundary deterministically excludes everything.
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r98-maxage-neg-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'fresh.txt'), 'created just now');
      const results = utils.findFiles(tmpDir, '*.txt', { maxAge: -1 });
      assert.strictEqual(results.length, 0,
        'maxAge: -1 should exclude all files (ageInDays is always >= 0)');
      // Contrast: maxAge: null (default) should include the file
      const noMaxAge = utils.findFiles(tmpDir, '*.txt');
      assert.strictEqual(noMaxAge.length, 1,
        'No maxAge (null default) should include the file (proving it exists)');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 99: replaceInFile returns true even when pattern not found ââ
  console.log('\nRound 99: replaceInFile (no-match still returns true):');

  if (test('replaceInFile returns true and rewrites file even when search does not match', () => {
    // utils.js lines 405-417: replaceInFile reads content, calls content.replace(search, replace),
    // and writes back the result. When the search pattern doesn't match anything,
    // String.replace() returns the original string unchanged, but the function still
    // writes it back to disk (changing mtime) and returns true. This means callers
    // cannot distinguish "replacement made" from "no match found."
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r99-no-match-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      fs.writeFileSync(testFile, 'hello world');
      const result = utils.replaceInFile(testFile, 'NONEXISTENT_PATTERN', 'replacement');
      assert.strictEqual(result, true,
        'replaceInFile returns true even when pattern is not found (no match guard)');
      const content = fs.readFileSync(testFile, 'utf8');
      assert.strictEqual(content, 'hello world',
        'Content should be unchanged since pattern did not match');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 99: grepFile with CR-only line endings (\r without \n) ââ
  console.log('\nRound 99: grepFile (CR-only line endings â classic Mac format):');

  if (test('grepFile treats CR-only file as a single line (splits on \\n only)', () => {
    // utils.js line 474: `content.split('\\n')` splits only on \\n (LF).
    // A file using \\r (CR) line endings (classic Mac format) has no \\n characters,
    // so split('\\n') returns the entire content as a single element array.
    // This means grepFile reports everything on "line 1" regardless of \\r positions.
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r99-cr-only-'));
    const testFile = path.join(tmpDir, 'cr-only.txt');
    try {
      // Write file with CR-only line endings (no LF)
      fs.writeFileSync(testFile, 'alpha\rbeta\rgamma');
      const matches = utils.grepFile(testFile, 'beta');
      assert.strictEqual(matches.length, 1,
        'Should find exactly 1 match (entire file is one "line")');
      assert.strictEqual(matches[0].lineNumber, 1,
        'Match should be reported on line 1 (no \\n splitting occurred)');
      assert.ok(matches[0].content.includes('\r'),
        'Content should contain \\r characters (unsplit)');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 100: findFiles with both maxAge AND recursive (interaction test) ââ
  console.log('\nRound 100: findFiles (maxAge + recursive combined â untested interaction):');
  if (test('findFiles with maxAge AND recursive filters age across subdirectories', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r100-maxage-recur-'));
    const subDir = path.join(tmpDir, 'nested');
    try {
      fs.mkdirSync(subDir);
      // Create files: one in root, one in subdirectory
      const rootFile = path.join(tmpDir, 'root.txt');
      const nestedFile = path.join(subDir, 'nested.txt');
      fs.writeFileSync(rootFile, 'root file');
      fs.writeFileSync(nestedFile, 'nested file');

      // maxAge: 1 with recursive: true â both files are fresh (ageInDays â 0)
      const results = utils.findFiles(tmpDir, '*.txt', { maxAge: 1, recursive: true });
      assert.strictEqual(results.length, 2,
        'Both root and nested files should match (fresh, maxAge: 1, recursive: true)');

      // maxAge: -1 with recursive: true â no files should match (age always >= 0)
      const noResults = utils.findFiles(tmpDir, '*.txt', { maxAge: -1, recursive: true });
      assert.strictEqual(noResults.length, 0,
        'maxAge: -1 should exclude all files even in subdirectories');

      // maxAge: 1 with recursive: false â only root file
      const rootOnly = utils.findFiles(tmpDir, '*.txt', { maxAge: 1, recursive: false });
      assert.strictEqual(rootOnly.length, 1,
        'recursive: false should only find root-level file');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 101: output() with circular reference object throws (no try/catch around JSON.stringify) ââ
  console.log('\nRound 101: output() (circular reference â JSON.stringify crash):');
  if (test('output() throws TypeError on circular reference object (JSON.stringify has no try/catch)', () => {
    const circular = { a: 1 };
    circular.self = circular; // Creates circular reference

    assert.throws(
      () => utils.output(circular),
      { name: 'TypeError' },
      'JSON.stringify of circular object should throw TypeError (no try/catch in output())'
    );
  })) passed++; else failed++;

  // ââ Round 103: countInFile with boolean false pattern (non-string non-RegExp) ââ
  console.log('\nRound 103: countInFile (boolean false â explicit type guard returns 0):');
  if (test('countInFile returns 0 for boolean false pattern (else branch at line 443)', () => {
    // utils.js lines 438-444: countInFile checks `instanceof RegExp` then `typeof === "string"`.
    // Boolean `false` fails both checks and falls to the `else return 0` at line 443.
    // This is the correct rejection path for non-string non-RegExp patterns, but was
    // previously untested with boolean specifically (only null, undefined, object tested).
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r103-bool-pattern-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      fs.writeFileSync(testFile, 'false is here\nfalse again\ntrue as well');
      // Even though "false" appears in the content, boolean `false` is rejected by type guard
      const count = utils.countInFile(testFile, false);
      assert.strictEqual(count, 0,
        'Boolean false should return 0 (typeof false === "boolean", not "string")');
      // Contrast: string "false" should match normally
      const stringCount = utils.countInFile(testFile, 'false');
      assert.strictEqual(stringCount, 2,
        'String "false" should match 2 times (proving content exists but type guard blocked boolean)');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 103: grepFile with numeric 0 pattern (implicit RegExp coercion) ââ
  console.log('\nRound 103: grepFile (numeric 0 â implicit toString via RegExp constructor):');
  if (test('grepFile with numeric 0 implicitly coerces to /0/ via RegExp constructor', () => {
    // utils.js line 468: grepFile's non-RegExp path does `regex = new RegExp(pattern)`.
    // Unlike countInFile (which has explicit type guards), grepFile passes any value
    // to the RegExp constructor, which calls toString() on it.  So new RegExp(0)
    // becomes /0/, and grepFile actually searches for lines containing "0".
    // This contrasts with countInFile(file, 0) which returns 0 (type-rejected).
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r103-grep-numeric-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      fs.writeFileSync(testFile, 'line with 0 zero\nno digit here\n100 bottles');
      const matches = utils.grepFile(testFile, 0);
      assert.strictEqual(matches.length, 2,
        'grepFile(file, 0) should find 2 lines containing "0" (RegExp(0) â /0/)');
      assert.strictEqual(matches[0].lineNumber, 1,
        'First match on line 1 ("line with 0 zero")');
      assert.strictEqual(matches[1].lineNumber, 3,
        'Second match on line 3 ("100 bottles")');
      // Contrast: countInFile with numeric 0 returns 0 (type-rejected)
      const count = utils.countInFile(testFile, 0);
      assert.strictEqual(count, 0,
        'countInFile(file, 0) returns 0 â API inconsistency with grepFile');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 105: grepFile with sticky (y) flag â not stripped, causes stateful .test() ââ
  console.log('\nRound 105: grepFile (sticky y flag â not stripped like g, stateful .test() bug):');

  if (test('grepFile with /pattern/y sticky flag misses lines due to lastIndex state', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r105-grep-sticky-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      fs.writeFileSync(testFile, 'hello world\nhello again\nhello third');
      // grepFile line 466: `pattern.flags.replace('g', '')` strips g but not y.
      // With /hello/y (sticky), .test() advances lastIndex after each successful
      // match. On the next line, .test() starts at lastIndex (not 0), so it fails
      // unless the match happens at that exact position.
      const stickyResults = utils.grepFile(testFile, /hello/y);
      // Without the bug, all 3 lines should match. With sticky flag preserved,
      // line 1 matches (lastIndex advances to 5), line 2 fails (no 'hello' at
      // position 5 of "hello again"), line 3 also likely fails.
      // The g-flag version (properly stripped) should find all 3:
      const globalResults = utils.grepFile(testFile, /hello/g);
      assert.strictEqual(globalResults.length, 3,
        'g-flag regex should find all 3 lines (g is stripped, stateless)');
      // Sticky flag causes fewer matches â demonstrating the bug
      assert.ok(stickyResults.length < 3,
        `Sticky y flag causes stateful .test() â found ${stickyResults.length}/3 lines ` +
        '(y flag not stripped like g, so lastIndex advances between lines)');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 107: grepFile with ^$ pattern â empty line matching after split ââ
  console.log('\nRound 107: grepFile (empty line matching â ^$ on split lines, trailing \\n creates extra empty element):');
  if (test('grepFile matches empty lines with ^$ pattern including trailing newline phantom line', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r107-grep-empty-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      // 'line1\n\nline3\n\n'.split('\n') â ['line1','','line3','',''] (5 elements, 3 empty)
      fs.writeFileSync(testFile, 'line1\n\nline3\n\n');
      const results = utils.grepFile(testFile, /^$/);
      assert.strictEqual(results.length, 3,
        'Should match 3 empty lines: line 2, line 4, and trailing phantom line 5');
      assert.strictEqual(results[0].lineNumber, 2, 'First empty line at position 2');
      assert.strictEqual(results[1].lineNumber, 4, 'Second empty line at position 4');
      assert.strictEqual(results[2].lineNumber, 5, 'Third empty line is the trailing phantom from split');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 107: replaceInFile where replacement re-introduces search pattern (single-pass) ââ
  console.log('\nRound 107: replaceInFile (replacement contains search pattern â String.replace is single-pass):');
  if (test('replaceInFile does not re-scan replacement text (single-pass, no infinite loop)', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r107-replace-reintr-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      fs.writeFileSync(testFile, 'foo bar baz');
      // Replace "foo" with "foo extra foo" â should only replace the first occurrence
      const result = utils.replaceInFile(testFile, 'foo', 'foo extra foo');
      assert.strictEqual(result, true, 'replaceInFile should return true');
      const content = utils.readFile(testFile);
      assert.strictEqual(content, 'foo extra foo bar baz',
        'Only the original "foo" is replaced â replacement text is not re-scanned');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 106: countInFile with named capture groups â match(g) ignores group details ââ
  console.log('\nRound 106: countInFile (named capture groups â String.match(g) returns full matches only):');
  if (test('countInFile with named capture groups counts matches not groups', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r106-count-named-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      fs.writeFileSync(testFile, 'foo bar baz\nfoo qux\nbar foo end');
      // Named capture group â should still count 3 matches for "foo"
      const count = utils.countInFile(testFile, /(?<word>foo)/);
      assert.strictEqual(count, 3,
        'Named capture group should not inflate count â match(g) returns full matches only');
      // Compare with plain pattern
      const plainCount = utils.countInFile(testFile, /foo/);
      assert.strictEqual(plainCount, 3, 'Plain regex should also find 3 matches');
      assert.strictEqual(count, plainCount,
        'Named group pattern and plain pattern should return identical counts');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 106: grepFile with multiline (m) flag â preserved, unlike g which is stripped ââ
  console.log('\nRound 106: grepFile (multiline m flag â preserved in regex, unlike g which is stripped):');
  if (test('grepFile preserves multiline (m) flag and anchors work on split lines', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r106-grep-multiline-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      fs.writeFileSync(testFile, 'hello\nworld hello\nhello world');
      // With m flag + anchors: ^hello$ should match only exact "hello" line
      const mResults = utils.grepFile(testFile, /^hello$/m);
      assert.strictEqual(mResults.length, 1,
        'With m flag, ^hello$ should match only line 1 (exact "hello")');
      assert.strictEqual(mResults[0].lineNumber, 1);
      // Without m flag: same behavior since grepFile splits lines individually
      const noMResults = utils.grepFile(testFile, /^hello$/);
      assert.strictEqual(noMResults.length, 1,
        'Without m flag, same result â grepFile splits lines so anchors are per-line already');
      assert.strictEqual(mResults.length, noMResults.length,
        'm flag is preserved but irrelevant â line splitting makes anchors per-line already');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // Summary
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

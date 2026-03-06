/**
 * Tests for scripts/lib/utils.js
 *
 * Run with: node tests/lib/utils-rounds-2.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Import the module
const utils = require('../../scripts/lib/utils');

// Test helper
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

// Test suite
function runTests() {
  console.log('\n=== Testing utils.js (Round Cases) ===\n');

  let passed = 0;
  let failed = 0;

  // ── Round 109: appendFile creating new file in non-existent directory (ensureDir + appendFileSync) ──
  console.log('\nRound 109: appendFile (new file creation — ensureDir creates parent, appendFileSync creates file):');
  if (test('appendFile creates parent directory and new file when neither exist', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r109-append-new-'));
    const nestedPath = path.join(tmpDir, 'deep', 'nested', 'dir', 'newfile.txt');
    try {
      // Parent directory 'deep/nested/dir' does not exist yet
      assert.ok(!fs.existsSync(path.join(tmpDir, 'deep')),
        'Parent "deep" should not exist before appendFile');
      utils.appendFile(nestedPath, 'first line\n');
      assert.ok(fs.existsSync(nestedPath),
        'File should be created by appendFile');
      assert.strictEqual(utils.readFile(nestedPath), 'first line\n',
        'Content should match what was appended');
      // Append again to verify it adds to existing file
      utils.appendFile(nestedPath, 'second line\n');
      assert.strictEqual(utils.readFile(nestedPath), 'first line\nsecond line\n',
        'Second append should add to existing file');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 108: grepFile with Unicode/emoji content — UTF-16 string matching on split lines ──
  console.log('\nRound 108: grepFile (Unicode/emoji — regex matching on UTF-16 split lines):');
  if (test('grepFile finds Unicode emoji patterns across lines', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r108-grep-unicode-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      fs.writeFileSync(testFile, '🎉 celebration\nnormal line\n🎉 party\n日本語テスト');
      const emojiResults = utils.grepFile(testFile, /🎉/);
      assert.strictEqual(emojiResults.length, 2,
        'Should find emoji on 2 lines (lines 1 and 3)');
      assert.strictEqual(emojiResults[0].lineNumber, 1);
      assert.strictEqual(emojiResults[1].lineNumber, 3);
      const cjkResults = utils.grepFile(testFile, /日本語/);
      assert.strictEqual(cjkResults.length, 1,
        'Should find CJK characters on line 4');
      assert.strictEqual(cjkResults[0].lineNumber, 4);
      assert.ok(cjkResults[0].content.includes('日本語テスト'),
        'Matched line should contain full CJK text');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 110: findFiles root directory unreadable — silent empty return (not throw) ──
  console.log('\nRound 110: findFiles (root directory unreadable — EACCES on readdirSync caught silently):');
  if (test('findFiles returns empty array when root directory exists but is unreadable', () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) {
      console.log('    (skipped — chmod ineffective on Windows/root)');
      return true;
    }
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r110-unreadable-root-'));
    const unreadableDir = path.join(tmpDir, 'no-read');
    fs.mkdirSync(unreadableDir);
    fs.writeFileSync(path.join(unreadableDir, 'secret.txt'), 'hidden');
    try {
      fs.chmodSync(unreadableDir, 0o000);
      // Verify dir exists but is unreadable
      assert.ok(fs.existsSync(unreadableDir), 'Directory should exist');
      // findFiles should NOT throw — catch block at line 188 handles EACCES
      const results = utils.findFiles(unreadableDir, '*');
      assert.ok(Array.isArray(results), 'Should return an array');
      assert.strictEqual(results.length, 0,
        'Should return empty array when root dir is unreadable (not throw)');
      // Also test with recursive flag
      const recursiveResults = utils.findFiles(unreadableDir, '*', { recursive: true });
      assert.strictEqual(recursiveResults.length, 0,
        'Recursive search on unreadable root should also return empty array');
    } finally {
      // Restore permissions before cleanup
      try { fs.chmodSync(unreadableDir, 0o755); } catch (_e) { /* ignore permission errors */ }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 113: replaceInFile with zero-width regex — inserts between every character ──
  console.log('\nRound 113: replaceInFile (zero-width regex /(?:)/g — matches every position):');
  if (test('replaceInFile with zero-width regex /(?:)/g inserts replacement at every position', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r113-zero-width-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      fs.writeFileSync(testFile, 'abc');
      // /(?:)/g matches at every position boundary: before 'a', between 'a'-'b', etc.
      // "abc".replace(/(?:)/g, 'X') → "XaXbXcX" (7 chars from 3)
      const result = utils.replaceInFile(testFile, /(?:)/g, 'X');
      assert.strictEqual(result, true, 'Should succeed (no error)');
      const content = utils.readFile(testFile);
      assert.strictEqual(content, 'XaXbXcX',
        'Zero-width regex inserts at every position boundary');

      // Also test with /^/gm (start of each line)
      fs.writeFileSync(testFile, 'line1\nline2\nline3');
      utils.replaceInFile(testFile, /^/gm, '> ');
      const prefixed = utils.readFile(testFile);
      assert.strictEqual(prefixed, '> line1\n> line2\n> line3',
        '/^/gm inserts at start of each line');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 114: replaceInFile options.all is silently ignored for RegExp search ──
  console.log('\nRound 114: replaceInFile (options.all silently ignored for RegExp search):');
  if (test('replaceInFile ignores options.all when search is a RegExp — falls through to .replace()', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r114-all-regex-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      // File with repeated pattern: "foo bar foo baz foo"
      fs.writeFileSync(testFile, 'foo bar foo baz foo');

      // With options.all=true and a non-global RegExp:
      // Line 411: (options.all && typeof search === 'string') → false (RegExp !== string)
      // Falls through to content.replace(regex, replace) — only replaces FIRST match
      const result = utils.replaceInFile(testFile, /foo/, 'QUX', { all: true });
      assert.strictEqual(result, true, 'Should succeed');
      const content = utils.readFile(testFile);
      assert.strictEqual(content, 'QUX bar foo baz foo',
        'Non-global RegExp with options.all=true should still only replace FIRST match');

      // Contrast: global RegExp replaces all regardless of options.all
      fs.writeFileSync(testFile, 'foo bar foo baz foo');
      utils.replaceInFile(testFile, /foo/g, 'QUX', { all: true });
      const globalContent = utils.readFile(testFile);
      assert.strictEqual(globalContent, 'QUX bar QUX baz QUX',
        'Global RegExp replaces all matches (options.all irrelevant for RegExp)');

      // String with options.all=true — uses replaceAll, replaces ALL occurrences
      fs.writeFileSync(testFile, 'foo bar foo baz foo');
      utils.replaceInFile(testFile, 'foo', 'QUX', { all: true });
      const allContent = utils.readFile(testFile);
      assert.strictEqual(allContent, 'QUX bar QUX baz QUX',
        'String with options.all=true uses replaceAll — replaces ALL occurrences');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 114: output with object containing BigInt — JSON.stringify throws ──
  console.log('\nRound 114: output (object containing BigInt — JSON.stringify throws):');
  if (test('output throws TypeError when object contains BigInt values (JSON.stringify cannot serialize)', () => {
    // Capture original console.log to prevent actual output during test
    const originalLog = console.log;

    try {
      // Plain BigInt — typeof is 'bigint', not 'object', so goes to else branch
      // console.log can handle BigInt directly (prints "42n")
      let captured = null;
      console.log = (val) => { captured = val; };
      utils.output(BigInt(42));
      // Node.js console.log prints BigInt as-is
      assert.strictEqual(captured, BigInt(42), 'Plain BigInt goes to else branch, logged directly');

      // Object containing BigInt — typeof is 'object', so JSON.stringify is called
      // JSON.stringify(BigInt) throws: "Do not know how to serialize a BigInt"
      console.log = originalLog; // restore before throw test
      assert.throws(
        () => utils.output({ value: BigInt(42) }),
        (err) => err instanceof TypeError && /BigInt/.test(err.message),
        'Object with BigInt should throw TypeError from JSON.stringify'
      );

      // Array containing BigInt — also typeof 'object'
      assert.throws(
        () => utils.output([BigInt(1), BigInt(2)]),
        (err) => err instanceof TypeError && /BigInt/.test(err.message),
        'Array with BigInt should also throw TypeError from JSON.stringify'
      );
    } finally {
      console.log = originalLog;
    }
  })) passed++; else failed++;

  // ── Round 115: countInFile with empty string pattern — matches at every position boundary ──
  console.log('\nRound 115: countInFile (empty string pattern — matches at every zero-width position):');
  if (test('countInFile with empty string pattern returns content.length + 1 (matches between every char)', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r115-empty-pattern-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      // "hello" is 5 chars → 6 zero-width positions: |h|e|l|l|o|
      fs.writeFileSync(testFile, 'hello');
      const count = utils.countInFile(testFile, '');
      assert.strictEqual(count, 6,
        'Empty string pattern creates /(?:)/g which matches at 6 position boundaries in "hello"');

      // Empty file → "" has 1 zero-width position (the empty string itself)
      fs.writeFileSync(testFile, '');
      const emptyCount = utils.countInFile(testFile, '');
      assert.strictEqual(emptyCount, 1,
        'Empty file still has 1 zero-width position boundary');

      // Single char → 2 positions: |a|
      fs.writeFileSync(testFile, 'a');
      const singleCount = utils.countInFile(testFile, '');
      assert.strictEqual(singleCount, 2,
        'Single character file has 2 position boundaries');

      // Newlines count as characters too
      fs.writeFileSync(testFile, 'a\nb');
      const newlineCount = utils.countInFile(testFile, '');
      assert.strictEqual(newlineCount, 4,
        '"a\\nb" is 3 chars → 4 position boundaries');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 117: grepFile with CRLF content — split('\n') leaves \r, anchored patterns fail ──
  console.log('\nRound 117: grepFile (CRLF content — trailing \\r breaks anchored regex patterns):');
  if (test('grepFile with CRLF content: unanchored patterns work but anchored $ fails due to trailing \\r', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r117-grep-crlf-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      // Write CRLF content
      fs.writeFileSync(testFile, 'hello\r\nworld\r\nfoo bar\r\n');

      // Unanchored pattern works — 'hello' matches in 'hello\r'
      const unanchored = utils.grepFile(testFile, 'hello');
      assert.strictEqual(unanchored.length, 1, 'Unanchored pattern should find 1 match');
      assert.strictEqual(unanchored[0].lineNumber, 1, 'Should be on line 1');
      assert.ok(unanchored[0].content.endsWith('\r'),
        'Line content should have trailing \\r from split("\\n") on CRLF');

      // Anchored pattern /^hello$/ does NOT match 'hello\r' because $ is before \r
      const anchored = utils.grepFile(testFile, /^hello$/);
      assert.strictEqual(anchored.length, 0,
        'Anchored /^hello$/ should NOT match "hello\\r" — $ fails before \\r');

      // But /^hello\r?$/ or /^hello/ work
      const withOptCr = utils.grepFile(testFile, /^hello\r?$/);
      assert.strictEqual(withOptCr.length, 1,
        '/^hello\\r?$/ matches "hello\\r" because \\r? consumes the trailing CR');

      // Contrast: LF-only content works with anchored patterns
      fs.writeFileSync(testFile, 'hello\nworld\nfoo bar\n');
      const lfAnchored = utils.grepFile(testFile, /^hello$/);
      assert.strictEqual(lfAnchored.length, 1,
        'LF-only content: anchored /^hello$/ matches normally');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 116: replaceInFile with null/undefined replacement — JS coerces to string ──
  console.log('\nRound 116: replaceInFile (null/undefined replacement — JS coerces to string "null"/"undefined"):');
  if (test('replaceInFile with null replacement coerces to string "null" via String.replace ToString', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r116-null-replace-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      // null replacement → String.replace coerces null to "null"
      fs.writeFileSync(testFile, 'hello world');
      const result = utils.replaceInFile(testFile, 'world', null);
      assert.strictEqual(result, true, 'Should succeed');
      const content = utils.readFile(testFile);
      assert.strictEqual(content, 'hello null',
        'null replacement is coerced to string "null" by String.replace');

      // undefined replacement → coerced to "undefined"
      fs.writeFileSync(testFile, 'hello world');
      utils.replaceInFile(testFile, 'world', undefined);
      const undefinedContent = utils.readFile(testFile);
      assert.strictEqual(undefinedContent, 'hello undefined',
        'undefined replacement is coerced to string "undefined" by String.replace');

      // Contrast: empty string replacement works as expected
      fs.writeFileSync(testFile, 'hello world');
      utils.replaceInFile(testFile, 'world', '');
      const emptyContent = utils.readFile(testFile);
      assert.strictEqual(emptyContent, 'hello ',
        'Empty string replacement correctly removes matched text');

      // options.all with null replacement
      fs.writeFileSync(testFile, 'foo bar foo baz foo');
      utils.replaceInFile(testFile, 'foo', null, { all: true });
      const allContent = utils.readFile(testFile);
      assert.strictEqual(allContent, 'null bar null baz null',
        'replaceAll also coerces null to "null" for every occurrence');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 116: ensureDir with null path — throws wrapped TypeError ──
  console.log('\nRound 116: ensureDir (null path — fs.existsSync(null) throws TypeError):');
  if (test('ensureDir with null path throws wrapped Error from TypeError (ERR_INVALID_ARG_TYPE)', () => {
    // fs.existsSync(null) throws TypeError in modern Node.js
    // Caught by ensureDir catch block, err.code !== 'EEXIST' → re-thrown as wrapped Error
    assert.throws(
      () => utils.ensureDir(null),
      (err) => {
        // Should be a wrapped Error (not raw TypeError)
        assert.ok(err instanceof Error, 'Should throw an Error');
        assert.ok(err.message.includes('Failed to create directory'),
          'Error message should include "Failed to create directory"');
        return true;
      },
      'ensureDir(null) should throw wrapped Error'
    );

    // undefined path — same behavior
    assert.throws(
      () => utils.ensureDir(undefined),
      (err) => err instanceof Error && err.message.includes('Failed to create directory'),
      'ensureDir(undefined) should also throw wrapped Error'
    );
  })) passed++; else failed++;

  // ── Round 118: writeFile with non-string content — TypeError propagates (no try/catch) ──
  console.log('\nRound 118: writeFile (non-string content — TypeError propagates uncaught):');
  if (test('writeFile with null/number content throws TypeError because fs.writeFileSync rejects non-string data', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r118-writefile-type-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      // null content → TypeError from fs.writeFileSync (data must be string/Buffer/etc.)
      assert.throws(
        () => utils.writeFile(testFile, null),
        (err) => err instanceof TypeError,
        'writeFile(path, null) should throw TypeError (no try/catch in writeFile)'
      );

      // undefined content → TypeError
      assert.throws(
        () => utils.writeFile(testFile, undefined),
        (err) => err instanceof TypeError,
        'writeFile(path, undefined) should throw TypeError'
      );

      // number content → TypeError (numbers not valid for fs.writeFileSync)
      assert.throws(
        () => utils.writeFile(testFile, 42),
        (err) => err instanceof TypeError,
        'writeFile(path, 42) should throw TypeError (number not a valid data type)'
      );

      // Contrast: string content works fine
      utils.writeFile(testFile, 'valid string content');
      assert.strictEqual(utils.readFile(testFile), 'valid string content',
        'String content should write and read back correctly');

      // Empty string is valid
      utils.writeFile(testFile, '');
      assert.strictEqual(utils.readFile(testFile), '',
        'Empty string should write correctly');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 119: appendFile with non-string content — TypeError propagates (no try/catch) ──
  console.log('\nRound 119: appendFile (non-string content — TypeError propagates like writeFile):');
  if (test('appendFile with null/number content throws TypeError (no try/catch wrapper)', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r119-appendfile-type-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      // Create file with initial content
      fs.writeFileSync(testFile, 'initial');

      // null content → TypeError from fs.appendFileSync
      assert.throws(
        () => utils.appendFile(testFile, null),
        (err) => err instanceof TypeError,
        'appendFile(path, null) should throw TypeError'
      );

      // undefined content → TypeError
      assert.throws(
        () => utils.appendFile(testFile, undefined),
        (err) => err instanceof TypeError,
        'appendFile(path, undefined) should throw TypeError'
      );

      // number content → TypeError
      assert.throws(
        () => utils.appendFile(testFile, 42),
        (err) => err instanceof TypeError,
        'appendFile(path, 42) should throw TypeError'
      );

      // Verify original content is unchanged after failed appends
      assert.strictEqual(utils.readFile(testFile), 'initial',
        'File content should be unchanged after failed appends');

      // Contrast: string append works
      utils.appendFile(testFile, ' appended');
      assert.strictEqual(utils.readFile(testFile), 'initial appended',
        'String append should work correctly');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 120: replaceInFile with empty string search — prepend vs insert-between-every-char ──
  console.log('\nRound 120: replaceInFile (empty string search — replace vs replaceAll dramatic difference):');
  if (test('replaceInFile with empty search: replace prepends at pos 0; replaceAll inserts between every char', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r120-empty-search-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      // Without options.all: .replace('', 'X') prepends at position 0
      fs.writeFileSync(testFile, 'hello');
      utils.replaceInFile(testFile, '', 'X');
      const prepended = utils.readFile(testFile);
      assert.strictEqual(prepended, 'Xhello',
        'replace("", "X") should prepend X at position 0 only');

      // With options.all: .replaceAll('', 'X') inserts between every character
      fs.writeFileSync(testFile, 'hello');
      utils.replaceInFile(testFile, '', 'X', { all: true });
      const insertedAll = utils.readFile(testFile);
      assert.strictEqual(insertedAll, 'XhXeXlXlXoX',
        'replaceAll("", "X") inserts X at every position boundary');

      // Empty file + empty search
      fs.writeFileSync(testFile, '');
      utils.replaceInFile(testFile, '', 'X');
      const emptyReplace = utils.readFile(testFile);
      assert.strictEqual(emptyReplace, 'X',
        'Empty content + empty search: single insertion at position 0');

      // Empty file + empty search + all
      fs.writeFileSync(testFile, '');
      utils.replaceInFile(testFile, '', 'X', { all: true });
      const emptyAll = utils.readFile(testFile);
      assert.strictEqual(emptyAll, 'X',
        'Empty content + replaceAll("", "X"): single position boundary → "X"');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 121: findFiles with ? glob pattern — single character wildcard ──
  console.log('\nRound 121: findFiles (? glob pattern — converted to . regex for single char match):');
  if (test('findFiles with ? glob matches single character only — test?.txt matches test1 but not test12', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r121-glob-question-'));
    try {
      // Create test files
      fs.writeFileSync(path.join(tmpDir, 'test1.txt'), 'a');
      fs.writeFileSync(path.join(tmpDir, 'testA.txt'), 'b');
      fs.writeFileSync(path.join(tmpDir, 'test12.txt'), 'c');
      fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'd');

      // ? matches exactly one character
      const results = utils.findFiles(tmpDir, 'test?.txt');
      const names = results.map(r => path.basename(r.path)).sort();
      assert.ok(names.includes('test1.txt'), 'Should match test1.txt (? = single digit)');
      assert.ok(names.includes('testA.txt'), 'Should match testA.txt (? = single letter)');
      assert.ok(!names.includes('test12.txt'), 'Should NOT match test12.txt (12 is two chars)');
      assert.ok(!names.includes('test.txt'), 'Should NOT match test.txt (no char for ?)');

      // Multiple ? marks
      fs.writeFileSync(path.join(tmpDir, 'ab.txt'), 'e');
      fs.writeFileSync(path.join(tmpDir, 'abc.txt'), 'f');
      const multiResults = utils.findFiles(tmpDir, '??.txt');
      const multiNames = multiResults.map(r => path.basename(r.path));
      assert.ok(multiNames.includes('ab.txt'), '?? should match 2-char filename');
      assert.ok(!multiNames.includes('abc.txt'), '?? should NOT match 3-char filename');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 122: findFiles dot extension escaping — *.txt must not match filetxt ──
  console.log('\nRound 122: findFiles (dot escaping — *.txt matches file.txt but not filetxt):');
  if (test('findFiles escapes dots in glob pattern so *.txt only matches literal .txt extension', () => {
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r122-dot-escape-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'a');
      fs.writeFileSync(path.join(tmpDir, 'filetxt'), 'b');
      fs.writeFileSync(path.join(tmpDir, 'file.txtx'), 'c');
      fs.writeFileSync(path.join(tmpDir, 'notes.txt'), 'd');

      const results = utils.findFiles(tmpDir, '*.txt');
      const names = results.map(r => path.basename(r.path)).sort();

      assert.ok(names.includes('file.txt'), 'Should match file.txt');
      assert.ok(names.includes('notes.txt'), 'Should match notes.txt');
      assert.ok(!names.includes('filetxt'),
        'Should NOT match filetxt (dot is escaped to literal, not wildcard)');
      assert.ok(!names.includes('file.txtx'),
        'Should NOT match file.txtx ($ anchor requires exact end)');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 123: countInFile with overlapping patterns — match(g) is non-overlapping ──
  console.log('\nRound 123: countInFile (overlapping patterns — String.match(/g/) is non-overlapping):');
  if (test('countInFile counts non-overlapping matches only — "aaa" with /aa/g returns 1 not 2', () => {
    // utils.js line 449: `content.match(regex)` with 'g' flag returns an array of
    // non-overlapping matches. After matching "aa" starting at index 0, the engine
    // advances to index 2, where only one "a" remains — no second match.
    // This is standard JS regex behavior but can surprise users expecting overlap.
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r123-overlap-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      // "aaa" — a human might count 2 occurrences of "aa" (at 0,1) but match(g) finds 1
      fs.writeFileSync(testFile, 'aaa');
      const count1 = utils.countInFile(testFile, 'aa');
      assert.strictEqual(count1, 1,
        '"aaa".match(/aa/g) returns ["aa"] — only 1 non-overlapping match');

      // "aaaa" — 2 non-overlapping matches (at 0,2), not 3 overlapping (at 0,1,2)
      fs.writeFileSync(testFile, 'aaaa');
      const count2 = utils.countInFile(testFile, 'aa');
      assert.strictEqual(count2, 2,
        '"aaaa".match(/aa/g) returns ["aa","aa"] — 2 non-overlapping, not 3 overlapping');

      // "abab" with /aba/g — only 1 match (at 0), not 2 (overlapping at 0,2)
      fs.writeFileSync(testFile, 'ababab');
      const count3 = utils.countInFile(testFile, 'aba');
      assert.strictEqual(count3, 1,
        '"ababab".match(/aba/g) returns 1 — after match at 0, next try starts at 3');

      // RegExp object behaves the same
      fs.writeFileSync(testFile, 'aaa');
      const count4 = utils.countInFile(testFile, /aa/);
      assert.strictEqual(count4, 1,
        'RegExp /aa/ also gives 1 non-overlapping match on "aaa" (g flag auto-added)');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 123: replaceInFile with $& and $$ substitution tokens in replacement string ──
  console.log('\nRound 123: replaceInFile ($& and $$ substitution tokens in replacement):');
  if (test('replaceInFile replacement string interprets $& as matched text and $$ as literal $', () => {
    // JS String.replace() interprets special patterns in the replacement string:
    //   $&  → inserts the entire matched substring
    //   $$  → inserts a literal "$" character
    //   $'  → inserts the portion after the matched substring
    //   $`  → inserts the portion before the matched substring
    // This is different from capture groups ($1, $2) already tested in Round 91.
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r123-dollar-'));
    const testFile = path.join(tmpDir, 'test.txt');
    try {
      // $& — inserts the matched text itself
      fs.writeFileSync(testFile, 'hello world');
      utils.replaceInFile(testFile, 'world', '[$&]');
      assert.strictEqual(utils.readFile(testFile), 'hello [world]',
        '$& in replacement inserts the matched text "world" → "[world]"');

      // $$ — inserts a literal $ sign
      fs.writeFileSync(testFile, 'price is 100');
      utils.replaceInFile(testFile, '100', '$$100');
      assert.strictEqual(utils.readFile(testFile), 'price is $100',
        '$$ becomes literal $ → "100" replaced with "$100"');

      // $& with options.all — applies to each match
      fs.writeFileSync(testFile, 'foo bar foo');
      utils.replaceInFile(testFile, 'foo', '($&)', { all: true });
      assert.strictEqual(utils.readFile(testFile), '(foo) bar (foo)',
        '$& in replaceAll inserts each respective matched text');

      // Combined $$ and $& in same replacement (3 $ + &)
      fs.writeFileSync(testFile, 'item costs 50');
      utils.replaceInFile(testFile, '50', '$$$&');
      // In replacement string: $$ → "$" then $& → "50" so result is "$50"
      assert.strictEqual(utils.readFile(testFile), 'item costs $50',
        '$$$& (3 dollars + ampersand) means literal $ followed by matched text → "$50"');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 124: findFiles matches dotfiles (unlike shell glob where * excludes hidden files) ──
  console.log('\nRound 124: findFiles (* glob matches dotfiles — unlike shell globbing):');
  if (test('findFiles with * pattern matches dotfiles because .* regex includes hidden files', () => {
    // In shell: `ls *` excludes .hidden files. In findFiles, `*` → `.*` regex which
    // matches ANY filename including those starting with `.`. This is a behavioral
    // difference from shell globbing that could surprise users.
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r124-dotfiles-'));
    try {
      // Create normal and hidden files
      fs.writeFileSync(path.join(tmpDir, 'normal.txt'), 'visible');
      fs.writeFileSync(path.join(tmpDir, '.hidden'), 'hidden');
      fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'ignore');
      fs.writeFileSync(path.join(tmpDir, 'README.md'), 'readme');

      // * matches ALL files including dotfiles
      const allResults = utils.findFiles(tmpDir, '*');
      const names = allResults.map(r => path.basename(r.path)).sort();
      assert.ok(names.includes('.hidden'),
        '* should match .hidden (unlike shell glob)');
      assert.ok(names.includes('.gitignore'),
        '* should match .gitignore');
      assert.ok(names.includes('normal.txt'),
        '* should match normal.txt');
      assert.strictEqual(names.length, 4,
        'Should find all 4 files including 2 dotfiles');

      // *.txt does NOT match dotfiles (because they don't end with .txt)
      const txtResults = utils.findFiles(tmpDir, '*.txt');
      assert.strictEqual(txtResults.length, 1,
        '*.txt should only match normal.txt, not dotfiles');

      // .* pattern specifically matches only dotfiles
      const dotResults = utils.findFiles(tmpDir, '.*');
      const dotNames = dotResults.map(r => path.basename(r.path)).sort();
      assert.ok(dotNames.includes('.hidden'), '.* matches .hidden');
      assert.ok(dotNames.includes('.gitignore'), '.* matches .gitignore');
      assert.ok(!dotNames.includes('normal.txt'),
        '.* should NOT match normal.txt (needs leading dot)');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 125: readFile with binary content — returns garbled UTF-8, not null ──
  console.log('\nRound 125: readFile (binary/non-UTF8 content — garbled, not null):');
  if (test('readFile with binary content returns garbled string (not null) because UTF-8 decode does not throw', () => {
    // utils.js line 285: fs.readFileSync(filePath, 'utf8') — binary data gets UTF-8 decoded.
    // Invalid byte sequences become U+FFFD replacement characters. The function does
    // NOT return null for binary files (only returns null on ENOENT/permission errors).
    // This means grepFile/countInFile would operate on corrupted content silently.
    const tmpDir = fs.mkdtempSync(path.join(utils.getTempDir(), 'r125-binary-'));
    const testFile = path.join(tmpDir, 'binary.dat');
    try {
      // Write raw binary data (invalid UTF-8 sequences)
      const binaryData = Buffer.from([0x00, 0x80, 0xFF, 0xFE, 0x48, 0x65, 0x6C, 0x6C, 0x6F]);
      fs.writeFileSync(testFile, binaryData);

      const content = utils.readFile(testFile);
      assert.ok(content !== null,
        'readFile should NOT return null for binary files');
      assert.ok(typeof content === 'string',
        'readFile always returns a string (or null for missing files)');
      // The string contains "Hello" (bytes 0x48-0x6F) somewhere in the garbled output
      assert.ok(content.includes('Hello'),
        'ASCII subset of binary data should survive UTF-8 decode');
      // Content length may differ from byte length due to multi-byte replacement chars
      assert.ok(content.length > 0, 'Non-empty content from binary file');

      // grepFile on binary file — still works but on garbled content
      const matches = utils.grepFile(testFile, 'Hello');
      assert.strictEqual(matches.length, 1,
        'grepFile finds "Hello" even in binary file (ASCII bytes survive)');

      // Non-existent file — returns null (contrast with binary)
      const missing = utils.readFile(path.join(tmpDir, 'no-such-file.txt'));
      assert.strictEqual(missing, null,
        'Missing file returns null (not garbled content)');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ── Round 125: output() with undefined, NaN, Infinity — non-object primitives logged directly ──
  console.log('\nRound 125: output() (undefined/NaN/Infinity — typeof checks and JSON.stringify):');
  if (test('output() handles undefined, NaN, Infinity as non-objects — logs directly', () => {
    // utils.js line 273: `if (typeof data === 'object')` — undefined/NaN/Infinity are NOT objects.
    // typeof undefined → "undefined", typeof NaN → "number", typeof Infinity → "number"
    // All three bypass JSON.stringify and go to console.log(data) directly.
    const origLog = console.log;
    const logged = [];
    console.log = (...args) => logged.push(args);
    try {
      // undefined — typeof "undefined", logged directly
      utils.output(undefined);
      assert.strictEqual(logged[0][0], undefined,
        'output(undefined) logs undefined (not "undefined" string)');

      // NaN — typeof "number", logged directly
      utils.output(NaN);
      assert.ok(Number.isNaN(logged[1][0]),
        'output(NaN) logs NaN directly (typeof "number", not "object")');

      // Infinity — typeof "number", logged directly
      utils.output(Infinity);
      assert.strictEqual(logged[2][0], Infinity,
        'output(Infinity) logs Infinity directly');

      // Object containing NaN — JSON.stringify converts NaN to null
      utils.output({ value: NaN, count: Infinity });
      const parsed = JSON.parse(logged[3][0]);
      assert.strictEqual(parsed.value, null,
        'JSON.stringify converts NaN to null inside objects');
      assert.strictEqual(parsed.count, null,
        'JSON.stringify converts Infinity to null inside objects');
    } finally {
      console.log = origLog;
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


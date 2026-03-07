/**
 * Tests for scripts/lib/session-manager.js
 *
 * Run with: node tests/lib/session-manager-rounds-2.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { test } = require('../helpers/test-runner');
const { clearSessionManagerCache, createTempSessionDir, cleanup } = require('../helpers/session-manager-test-utils');
const { withEnv } = require('../helpers/env-test-utils');

let sessionManager = require('../../scripts/lib/session-manager');

function runTests() {
  console.log('\n=== Testing session-manager.js (Round Cases) ===\n');

  let passed = 0;
  let failed = 0;

  // -- Round 109: getAllSessions skips .tmp files that don't match session filename format --
  console.log('\nRound 109: getAllSessions (non-session .tmp files ï¿½ parseSessionFilename returns null ? skip):');
  if (test('getAllSessions ignores .tmp files with non-matching filenames', () => {
    const isoHome = path.join(os.tmpdir(), `ecc-r109-nonsession-${Date.now()}`);
    try {
      withEnv({ HOME: isoHome, USERPROFILE: isoHome }, () => {
        clearSessionManagerCache();
        const freshUtils = require('../../scripts/lib/utils');
        const isoSessionsDir = freshUtils.getSessionsDir();
        fs.mkdirSync(isoSessionsDir, { recursive: true });
        const validName = '2026-03-01-abcd1234-session.tmp';
        fs.writeFileSync(path.join(isoSessionsDir, validName), '# Valid Session');
        fs.writeFileSync(path.join(isoSessionsDir, 'notes.tmp'), 'personal notes');
        fs.writeFileSync(path.join(isoSessionsDir, 'scratch.tmp'), 'scratch data');
        fs.writeFileSync(path.join(isoSessionsDir, 'backup-2026.tmp'), 'backup');
        const freshManager = require('../../scripts/lib/session-manager');
        const result = freshManager.getAllSessions({ limit: 100 });
        assert.strictEqual(result.total, 1,
          'Should find only 1 valid session (non-matching .tmp files skipped via !metadata continue)');
        assert.strictEqual(result.sessions[0].shortId, 'abcd1234',
          'The one valid session should have correct shortId');
      });
    } finally {
      clearSessionManagerCache();
      sessionManager = require('../../scripts/lib/session-manager');
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // -- Round 108: getSessionSize exact boundary at 1024 bytes ï¿½ B?KB transition --
  console.log('\nRound 108: getSessionSize (exact 1024-byte boundary ï¿½ < means 1024 is KB, 1023 is B):');
  if (test('getSessionSize returns KB at exactly 1024 bytes and B at 1023', () => {
    const dir = createTempSessionDir();
    try {
      // Exactly 1024 bytes ? size < 1024 is FALSE ? goes to KB branch
      const atBoundary = path.join(dir, 'exact-1024.tmp');
      fs.writeFileSync(atBoundary, 'x'.repeat(1024));
      const sizeAt = sessionManager.getSessionSize(atBoundary);
      assert.strictEqual(sizeAt, '1.0 KB',
        'Exactly 1024 bytes should return "1.0 KB" (not "1024 B")');

      // 1023 bytes ? size < 1024 is TRUE ? stays in B branch
      const belowBoundary = path.join(dir, 'below-1024.tmp');
      fs.writeFileSync(belowBoundary, 'x'.repeat(1023));
      const sizeBelow = sessionManager.getSessionSize(belowBoundary);
      assert.strictEqual(sizeBelow, '1023 B',
        '1023 bytes should return "1023 B" (still in bytes range)');

      // Exactly 1MB boundary ? 1048576 bytes
      const atMB = path.join(dir, 'exact-1mb.tmp');
      fs.writeFileSync(atMB, 'x'.repeat(1024 * 1024));
      const sizeMB = sessionManager.getSessionSize(atMB);
      assert.strictEqual(sizeMB, '1.0 MB',
        'Exactly 1MB should return "1.0 MB" (not "1024.0 KB")');
    } finally {
      cleanup(dir);
    }
  })) passed++; else failed++;

  // -- Round 110: parseSessionFilename year 0000 ï¿½ JS Date maps year 0 to 1900 --
  console.log('\nRound 110: parseSessionFilename (year 0000 ï¿½ Date constructor maps 0?1900):');
  if (test('parseSessionFilename with year 0000 produces datetime in 1900 due to JS Date legacy mapping', () => {
    // JavaScript's multi-arg Date constructor treats years 0-99 as 1900-1999
    // So new Date(0, 0, 1) ? January 1, 1900 (not year 0000)
    const result = sessionManager.parseSessionFilename('0000-01-01-abcd1234-session.tmp');
    assert.notStrictEqual(result, null, 'Should parse successfully (regex \\d{4} matches 0000)');
    assert.strictEqual(result.date, '0000-01-01', 'Date string should be "0000-01-01"');
    assert.strictEqual(result.shortId, 'abcd1234');
    // The key quirk: datetime is year 1900, not 0000
    assert.strictEqual(result.datetime.getFullYear(), 1900,
      'JS Date maps year 0 to 1900 in multi-arg constructor');
    // Year 99 maps to 1999
    const result99 = sessionManager.parseSessionFilename('0099-06-15-testid01-session.tmp');
    assert.notStrictEqual(result99, null, 'Year 0099 should also parse');
    assert.strictEqual(result99.datetime.getFullYear(), 1999,
      'JS Date maps year 99 to 1999');
    // Year 100 does NOT get the 1900 mapping ï¿½ it stays as year 100
    const result100 = sessionManager.parseSessionFilename('0100-03-10-validid1-session.tmp');
    assert.notStrictEqual(result100, null, 'Year 0100 should also parse');
    assert.strictEqual(result100.datetime.getFullYear(), 100,
      'Year 100+ is not affected by the 0-99 ? 1900-1999 mapping');
  })) passed++; else failed++;

  // -- Round 110: parseSessionFilename rejects uppercase IDs (regex is [a-z0-9]) --
  console.log('\nRound 110: parseSessionFilename (uppercase ID ï¿½ regex [a-z0-9]{8,} rejects [A-Z]):');
  if (test('parseSessionFilename rejects filenames with uppercase characters in short ID', () => {
    // SESSION_FILENAME_REGEX uses [a-z0-9]{8,} ï¿½ strictly lowercase
    const upperResult = sessionManager.parseSessionFilename('2026-01-15-ABCD1234-session.tmp');
    assert.strictEqual(upperResult, null,
      'All-uppercase ID should be rejected by [a-z0-9]{8,}');
    const mixedResult = sessionManager.parseSessionFilename('2026-01-15-AbCd1234-session.tmp');
    assert.strictEqual(mixedResult, null,
      'Mixed-case ID should be rejected by [a-z0-9]{8,}');
    // Confirm lowercase is accepted
    const lowerResult = sessionManager.parseSessionFilename('2026-01-15-abcd1234-session.tmp');
    assert.notStrictEqual(lowerResult, null,
      'All-lowercase ID should be accepted');
    assert.strictEqual(lowerResult.shortId, 'abcd1234');
  })) passed++; else failed++;

  // -- Round 111: parseSessionMetadata context with nested triple backticks ï¿½ lazy regex truncation --
  console.log('\nRound 111: parseSessionMetadata (nested ``` in context ï¿½ lazy \\S*? stops at first ```):");');
  if (test('parseSessionMetadata context capture truncated by nested triple backticks', () => {
    // The regex: /### Context to Load\s*\n```\n([\s\S]*?)```/
    // The lazy [\s\S]*? matches as few chars as possible, so it stops at the
    // FIRST ``` it encounters ï¿½ even if that's inside the code block content.
    const content = [
      '# Session',
      '',
      '### Context to Load',
      '```',
      'const x = 1;',
      '```nested code block```',  // Inner ``` causes premature match end
      'const y = 2;',
      '```'
    ].join('\n');
    const meta = sessionManager.parseSessionMetadata(content);
    // Lazy regex stops at the inner ```, so context only captures "const x = 1;\n"
    assert.ok(meta.context.includes('const x = 1'),
      'Context should contain text before the inner backticks');
    assert.ok(!meta.context.includes('const y = 2'),
      'Context should NOT contain text after inner ``` (lazy regex stops early)');
    // Without nested backticks, full content is captured
    const cleanContent = [
      '# Session',
      '',
      '### Context to Load',
      '```',
      'const x = 1;',
      'const y = 2;',
      '```'
    ].join('\n');
    const cleanMeta = sessionManager.parseSessionMetadata(cleanContent);
    assert.ok(cleanMeta.context.includes('const x = 1'),
      'Clean context should have first line');
    assert.ok(cleanMeta.context.includes('const y = 2'),
      'Clean context should have second line');
  })) passed++; else failed++;

  // -- Round 112: getSessionStats with newline-containing absolute path ï¿½ treated as content --
  console.log('\nRound 112: getSessionStats (newline-in-path heuristic):');
  if (test('getSessionStats treats absolute .tmp path containing newline as content, not a file path', () => {
    // The looksLikePath heuristic at line 163-166 checks:
    //   !sessionPathOrContent.includes('\n')
    // A string with embedded newline fails this check and is treated as content
    const pathWithNewline = '/tmp/sessions/2026-01-15\n-abcd1234-session.tmp';

    // This should NOT throw (it's treated as content, not a path that doesn't exist)
    const stats = sessionManager.getSessionStats(pathWithNewline);
    assert.ok(stats, 'Should return stats object (treating input as content)');
    // The "content" has 2 lines (split by the embedded \n)
    assert.strictEqual(stats.lineCount, 2,
      'Should count 2 lines in the "content" (split at \\n)');
    // No markdown headings = no completed/in-progress items
    assert.strictEqual(stats.totalItems, 0,
      'Should find 0 items in non-markdown content');

    // Contrast: a real absolute path without newlines IS treated as a path
    const realPath = '/tmp/nonexistent-session.tmp';
    const realStats = sessionManager.getSessionStats(realPath);
    // getSessionContent returns '' for non-existent files, so lineCount = 1 (empty string split)
    assert.ok(realStats, 'Should return stats even for nonexistent path');
    assert.strictEqual(realStats.lineCount, 0,
      'Non-existent file returns empty content with 0 lines');
  })) passed++; else failed++;

  // -- Round 112: appendSessionContent with read-only file ï¿½ returns false --
  console.log('\nRound 112: appendSessionContent (read-only file):');
  if (test('appendSessionContent returns false when fs.appendFileSync throws EACCES', () => {
    const originalAppendFileSync = fs.appendFileSync;

    try {
      fs.appendFileSync = () => {
        const error = new Error('permission denied');
        error.code = 'EACCES';
        throw error;
      };

      const result = sessionManager.appendSessionContent('/tmp/mock-session.tmp', '\\nAppended data');
      assert.strictEqual(result, false,
        'Should return false when fs.appendFileSync throws EACCES');
    } finally {
      fs.appendFileSync = originalAppendFileSync;
    }
  })) passed++; else failed++;

  // -- Round 113: parseSessionFilename century leap year validation (1900, 2100 not leap; 2000 is) --
  console.log('\nRound 113: parseSessionFilename (century leap year ï¿½ 100/400 rules):');
  if (test('parseSessionFilename rejects Feb 29 in century non-leap years (1900, 2100) but accepts 2000', () => {
    // Gregorian rule: divisible by 100 ? NOT leap, UNLESS also divisible by 400
    // 1900: divisible by 100 but NOT by 400 ? NOT leap ? Feb 29 invalid
    const result1900 = sessionManager.parseSessionFilename('1900-02-29-abcd1234-session.tmp');
    assert.strictEqual(result1900, null,
      '1900 is NOT a leap year (div by 100 but not 400) ï¿½ Feb 29 should be rejected');

    // 2100: same rule ï¿½ NOT leap
    const result2100 = sessionManager.parseSessionFilename('2100-02-29-test1234-session.tmp');
    assert.strictEqual(result2100, null,
      '2100 is NOT a leap year ï¿½ Feb 29 should be rejected');

    // 2000: divisible by 400 ? IS leap ? Feb 29 valid
    const result2000 = sessionManager.parseSessionFilename('2000-02-29-leap2000-session.tmp');
    assert.notStrictEqual(result2000, null,
      '2000 IS a leap year (div by 400) ï¿½ Feb 29 should be accepted');
    assert.strictEqual(result2000.date, '2000-02-29');

    // 2400: also divisible by 400 ? IS leap
    const result2400 = sessionManager.parseSessionFilename('2400-02-29-test2400-session.tmp');
    assert.notStrictEqual(result2400, null,
      '2400 IS a leap year (div by 400) ï¿½ Feb 29 should be accepted');

    // Verify Feb 28 always works in non-leap century years
    const result1900Feb28 = sessionManager.parseSessionFilename('1900-02-28-abcd1234-session.tmp');
    assert.notStrictEqual(result1900Feb28, null,
      'Feb 28 should always be valid even in non-leap years');
  })) passed++; else failed++;

  // -- Round 113: parseSessionMetadata title with markdown formatting ï¿½ raw markdown preserved --
  console.log('\nRound 113: parseSessionMetadata (title with markdown formatting ï¿½ raw markdown preserved):');
  if (test('parseSessionMetadata captures raw markdown formatting in title without stripping', () => {
    // The regex /^#\s+(.+)$/m captures everything after "# ", including markdown
    const boldContent = '# **Important Session**\n\nSome content';
    const boldMeta = sessionManager.parseSessionMetadata(boldContent);
    assert.strictEqual(boldMeta.title, '**Important Session**',
      'Bold markdown ** should be preserved in title (not stripped)');

    // Inline code in title
    const codeContent = '# `fix-bug` Session\n\nContent here';
    const codeMeta = sessionManager.parseSessionMetadata(codeContent);
    assert.strictEqual(codeMeta.title, '`fix-bug` Session',
      'Inline code backticks should be preserved in title');

    // Italic in title
    const italicContent = '# _Urgent_ Review\n\n**Date:** 2026-01-01';
    const italicMeta = sessionManager.parseSessionMetadata(italicContent);
    assert.strictEqual(italicMeta.title, '_Urgent_ Review',
      'Italic underscores should be preserved in title');

    // Mixed markdown in title
    const mixedContent = '# **Bold** and `code` and _italic_\n\nBody text';
    const mixedMeta = sessionManager.parseSessionMetadata(mixedContent);
    assert.strictEqual(mixedMeta.title, '**Bold** and `code` and _italic_',
      'Mixed markdown should all be preserved as raw text');

    // Title with trailing whitespace (trim should remove it)
    const trailingContent = '# Title with spaces   \n\nBody';
    const trailingMeta = sessionManager.parseSessionMetadata(trailingContent);
    assert.strictEqual(trailingMeta.title, 'Title with spaces',
      'Trailing whitespace should be trimmed');
  })) passed++; else failed++;

  // -- Round 115: parseSessionMetadata with CRLF line endings ï¿½ section boundaries differ --
  console.log('\nRound 115: parseSessionMetadata (CRLF line endings ï¿½ \\r\\n vs \\n in section regexes):');
  if (test('parseSessionMetadata handles CRLF content ï¿½ title trimmed, sections may over-capture', () => {
    // Title regex /^#\s+(.+)$/m: . matches \r, trim() removes it
    const crlfTitle = '# My Session\r\n\r\n**Date:** 2026-01-15';
    const titleMeta = sessionManager.parseSessionMetadata(crlfTitle);
    assert.strictEqual(titleMeta.title, 'My Session',
      'Title should be trimmed (\\r removed by .trim())');
    assert.strictEqual(titleMeta.date, '2026-01-15',
      'Date extraction unaffected by CRLF');

    // Completed section with CRLF: regex ### Completed\s*\n works because \s* matches \r
    // But the boundary (?=###|\n\n|$) ï¿½ \n\n won't match \r\n\r\n
    const crlfSections = [
      '# Session\r\n',
      '\r\n',
      '### Completed\r\n',
      '- [x] Task A\r\n',
      '- [x] Task B\r\n',
      '\r\n',
      '### In Progress\r\n',
      '- [ ] Task C\r\n'
    ].join('');

    const sectionMeta = sessionManager.parseSessionMetadata(crlfSections);

    // \s* in "### Completed\s*\n" matches the \r before \n, so section header matches
    assert.ok(sectionMeta.completed.length >= 2,
      'Should find at least 2 completed items (\\s* consumes \\r before \\n)');
    assert.ok(sectionMeta.completed.includes('Task A'), 'Should find Task A');
    assert.ok(sectionMeta.completed.includes('Task B'), 'Should find Task B');

    // In Progress section: \n\n boundary fails on \r\n\r\n, so the lazy [\s\S]*?
    // stops at ### instead ï¿½ this still works because ### is present
    assert.ok(sectionMeta.inProgress.length >= 1,
      'Should find at least 1 in-progress item');
    assert.ok(sectionMeta.inProgress.includes('Task C'), 'Should find Task C');

    // Edge case: CRLF content with NO section headers after Completed ï¿½
    // \n\n boundary fails, so [\s\S]*? falls through to $ (end of string)
    const crlfNoNextSection = [
      '# Session\r\n',
      '\r\n',
      '### Completed\r\n',
      '- [x] Only task\r\n',
      '\r\n',
      'Some trailing text\r\n'
    ].join('');

    const noNextMeta = sessionManager.parseSessionMetadata(crlfNoNextSection);
    // Without a ### boundary, the \n\n lookahead fails on \r\n\r\n,
    // so [\s\S]*? extends to $ and captures everything including trailing text
    assert.ok(noNextMeta.completed.length >= 1,
      'Should find at least 1 completed item in CRLF-only content');
  })) passed++; else failed++;

  // -- Round 117: getSessionSize boundary values ï¿½ B/KB/MB formatting thresholds --
  console.log('\nRound 117: getSessionSize (B/KB/MB formatting at exact boundary thresholds):');
  if (test('getSessionSize formats correctly at B?KB boundary (1023?"1023 B", 1024?"1.0 KB") and KB?MB', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'r117-size-boundary-'));
    try {
      // Zero-byte file
      const zeroFile = path.join(tmpDir, '2026-01-01-session.tmp');
      fs.writeFileSync(zeroFile, '');
      assert.strictEqual(sessionManager.getSessionSize(zeroFile), '0 B',
        'Empty file should be "0 B"');

      // 1 byte file
      const oneByteFile = path.join(tmpDir, '2026-01-02-session.tmp');
      fs.writeFileSync(oneByteFile, 'x');
      assert.strictEqual(sessionManager.getSessionSize(oneByteFile), '1 B',
        'Single byte file should be "1 B"');

      // 1023 bytes ï¿½ last value in B range (size < 1024)
      const file1023 = path.join(tmpDir, '2026-01-03-session.tmp');
      fs.writeFileSync(file1023, 'x'.repeat(1023));
      assert.strictEqual(sessionManager.getSessionSize(file1023), '1023 B',
        '1023 bytes is still in B range (< 1024)');

      // 1024 bytes ï¿½ first value in KB range (size >= 1024, < 1024*1024)
      const file1024 = path.join(tmpDir, '2026-01-04-session.tmp');
      fs.writeFileSync(file1024, 'x'.repeat(1024));
      assert.strictEqual(sessionManager.getSessionSize(file1024), '1.0 KB',
        '1024 bytes = exactly 1.0 KB');

      // 1025 bytes ï¿½ KB with decimal
      const file1025 = path.join(tmpDir, '2026-01-05-session.tmp');
      fs.writeFileSync(file1025, 'x'.repeat(1025));
      assert.strictEqual(sessionManager.getSessionSize(file1025), '1.0 KB',
        '1025 bytes rounds to 1.0 KB (1025/1024 = 1.000...)');

      // Non-existent file returns '0 B'
      assert.strictEqual(sessionManager.getSessionSize('/nonexistent/file.tmp'), '0 B',
        'Non-existent file should return "0 B"');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // -- Round 117: parseSessionFilename with uppercase short ID ï¿½ regex rejects [A-Z] --
  console.log('\nRound 117: parseSessionFilename (uppercase short ID ï¿½ regex [a-z0-9] rejects uppercase):');
  if (test('parseSessionFilename rejects uppercase short IDs because regex uses [a-z0-9] not [a-zA-Z0-9]', () => {
    // The regex: /^(\d{4}-\d{2}-\d{2})(?:-([a-z0-9]{8,}))?-session\.tmp$/
    // Note: [a-z0-9] ï¿½ lowercase only

    // All uppercase ï¿½ rejected
    const upper = sessionManager.parseSessionFilename('2026-01-15-ABCDEFGH-session.tmp');
    assert.strictEqual(upper, null,
      'All-uppercase ID should be rejected (regex uses [a-z0-9])');

    // Mixed case ï¿½ rejected
    const mixed = sessionManager.parseSessionFilename('2026-01-15-AbCdEfGh-session.tmp');
    assert.strictEqual(mixed, null,
      'Mixed-case ID should be rejected (uppercase chars not in [a-z0-9])');

    // All lowercase ï¿½ accepted
    const lower = sessionManager.parseSessionFilename('2026-01-15-abcdefgh-session.tmp');
    assert.notStrictEqual(lower, null, 'All-lowercase ID should be accepted');
    assert.strictEqual(lower.shortId, 'abcdefgh');

    // Uppercase hex-like (common in UUIDs) ï¿½ rejected
    const hexUpper = sessionManager.parseSessionFilename('2026-01-15-A1B2C3D4-session.tmp');
    assert.strictEqual(hexUpper, null,
      'Uppercase hex ID should be rejected');

    // Lowercase hex ï¿½ accepted
    const hexLower = sessionManager.parseSessionFilename('2026-01-15-a1b2c3d4-session.tmp');
    assert.notStrictEqual(hexLower, null, 'Lowercase hex ID should be accepted');
    assert.strictEqual(hexLower.shortId, 'a1b2c3d4');
  })) passed++; else failed++;

  // -- Round 119: parseSessionMetadata "Context to Load" code block extraction --
  console.log('\nRound 119: parseSessionMetadata ("Context to Load" ï¿½ code block extraction edge cases):');
  if (test('parseSessionMetadata extracts Context to Load from code block, handles missing/nested blocks', () => {
    // Valid context extraction
    const validContent = [
      '# Session\n\n',
      '### Context to Load\n',
      '```\n',
      'file1.js\n',
      'file2.ts\n',
      '```\n'
    ].join('');
    const validMeta = sessionManager.parseSessionMetadata(validContent);
    assert.strictEqual(validMeta.context, 'file1.js\nfile2.ts',
      'Should extract content between ``` markers and trim');

    // Missing closing backticks ï¿½ regex doesn't match, context stays empty
    const noClose = [
      '# Session\n\n',
      '### Context to Load\n',
      '```\n',
      'file1.js\n',
      'file2.ts\n'
    ].join('');
    const noCloseMeta = sessionManager.parseSessionMetadata(noClose);
    assert.strictEqual(noCloseMeta.context, '',
      'Missing closing ``` should result in empty context (regex no match)');

    // No code block after header ï¿½ just plain text
    const noBlock = [
      '# Session\n\n',
      '### Context to Load\n',
      'file1.js\n',
      'file2.ts\n'
    ].join('');
    const noBlockMeta = sessionManager.parseSessionMetadata(noBlock);
    assert.strictEqual(noBlockMeta.context, '',
      'Plain text without ``` should not be captured as context');

    // Nested code block ï¿½ lazy [\s\S]*? stops at first ```
    const nested = [
      '# Session\n\n',
      '### Context to Load\n',
      '```\n',
      'first block\n',
      '```\n',
      'second block\n',
      '```\n'
    ].join('');
    const nestedMeta = sessionManager.parseSessionMetadata(nested);
    assert.strictEqual(nestedMeta.context, 'first block',
      'Lazy quantifier should stop at first closing ``` (not greedy)');

    // Empty code block
    const emptyBlock = '# Session\n\n### Context to Load\n```\n```\n';
    const emptyMeta = sessionManager.parseSessionMetadata(emptyBlock);
    assert.strictEqual(emptyMeta.context, '',
      'Empty code block should result in empty context (trim of empty)');
  })) passed++; else failed++;

  // -- Round 120: parseSessionMetadata "Notes for Next Session" extraction edge cases --
  console.log('\nRound 120: parseSessionMetadata ("Notes for Next Session" ï¿½ extraction edge cases):');
  if (test('parseSessionMetadata extracts notes section ï¿½ last section, empty, followed by ###', () => {
    // Notes as the last section (no ### or \n\n after)
    const lastSection = '# Session\n\n### Notes for Next Session\nRemember to review PR #42\nAlso check CI status';
    const lastMeta = sessionManager.parseSessionMetadata(lastSection);
    assert.strictEqual(lastMeta.notes, 'Remember to review PR #42\nAlso check CI status',
      'Notes as last section should capture everything to end of string via $ anchor');
    assert.strictEqual(lastMeta.hasNotes, undefined,
      'hasNotes is not a direct property of parseSessionMetadata result');

    // Notes followed by another ### section
    const withNext = '# Session\n\n### Notes for Next Session\nImportant note\n### Context to Load\n```\nfiles\n```';
    const nextMeta = sessionManager.parseSessionMetadata(withNext);
    assert.strictEqual(nextMeta.notes, 'Important note',
      'Notes should stop at next ### header');

    // Notes followed by \n\n (double newline)
    const withDoubleNewline = '# Session\n\n### Notes for Next Session\nNote here\n\nSome other text';
    const dblMeta = sessionManager.parseSessionMetadata(withDoubleNewline);
    assert.strictEqual(dblMeta.notes, 'Note here',
      'Notes should stop at \\n\\n boundary');

    // Empty notes section (header only, followed by \n\n)
    const emptyNotes = '# Session\n\n### Notes for Next Session\n\n### Other Section';
    const emptyMeta = sessionManager.parseSessionMetadata(emptyNotes);
    assert.strictEqual(emptyMeta.notes, '',
      'Empty notes section should result in empty string after trim');

    // Notes with markdown formatting
    const markdownNotes = '# Session\n\n### Notes for Next Session\n- [ ] Review **important** PR\n- [x] Check `config.js`\n\n### Done';
    const mdMeta = sessionManager.parseSessionMetadata(markdownNotes);
    assert.ok(mdMeta.notes.includes('**important**'),
      'Markdown bold should be preserved in notes');
    assert.ok(mdMeta.notes.includes('`config.js`'),
      'Markdown code should be preserved in notes');
  })) passed++; else failed++;

  // -- Round 121: parseSessionMetadata Started/Last Updated time extraction --
  console.log('\nRound 121: parseSessionMetadata (Started/Last Updated time extraction):');
  if (test('parseSessionMetadata extracts Started and Last Updated times from markdown', () => {
    // Standard format
    const standard = '# Session\n\n**Date:** 2026-01-15\n**Started:** 14:30\n**Last Updated:** 16:45';
    const stdMeta = sessionManager.parseSessionMetadata(standard);
    assert.strictEqual(stdMeta.started, '14:30', 'Should extract started time');
    assert.strictEqual(stdMeta.lastUpdated, '16:45', 'Should extract last updated time');

    // With seconds in time
    const withSec = '# Session\n\n**Started:** 14:30:00\n**Last Updated:** 16:45:59';
    const secMeta = sessionManager.parseSessionMetadata(withSec);
    assert.strictEqual(secMeta.started, '14:30:00', 'Should capture seconds too ([\\d:]+)');
    assert.strictEqual(secMeta.lastUpdated, '16:45:59');

    // Missing Started but has Last Updated
    const noStarted = '# Session\n\n**Last Updated:** 09:00';
    const noStartMeta = sessionManager.parseSessionMetadata(noStarted);
    assert.strictEqual(noStartMeta.started, null, 'Missing Started should be null');
    assert.strictEqual(noStartMeta.lastUpdated, '09:00', 'Last Updated should still be extracted');

    // Missing Last Updated but has Started
    const noUpdated = '# Session\n\n**Started:** 08:15';
    const noUpdMeta = sessionManager.parseSessionMetadata(noUpdated);
    assert.strictEqual(noUpdMeta.started, '08:15', 'Started should be extracted');
    assert.strictEqual(noUpdMeta.lastUpdated, null, 'Missing Last Updated should be null');

    // Neither present
    const neither = '# Session\n\nJust some text';
    const neitherMeta = sessionManager.parseSessionMetadata(neither);
    assert.strictEqual(neitherMeta.started, null, 'No Started in content ? null');
    assert.strictEqual(neitherMeta.lastUpdated, null, 'No Last Updated in content ? null');

    // Loose regex: edge case with extra colons ([\d:]+ matches any digit-colon combo)
    const loose = '# Session\n\n**Started:** 1:2:3:4';
    const looseMeta = sessionManager.parseSessionMetadata(loose);
    assert.strictEqual(looseMeta.started, '1:2:3:4',
      'Loose [\\d:]+ regex captures any digits-and-colons combination');
  })) passed++; else failed++;

  // -- Round 122: getSessionById old format (no-id) ï¿½ noIdMatch path --
  console.log('\nRound 122: getSessionById (old format no-id ï¿½ date-only filename match):');
  if (test('getSessionById matches old format YYYY-MM-DD-session.tmp via noIdMatch path', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'r122-old-format-'));
    try {
      withEnv({ HOME: tmpDir, USERPROFILE: tmpDir, CLAUDE_DIR: undefined }, () => {
        clearSessionManagerCache();
        const freshUtils = require('../../scripts/lib/utils');
        const sessionsDir = freshUtils.getSessionsDir();
        fs.mkdirSync(sessionsDir, { recursive: true });

        const oldFile = path.join(sessionsDir, '2026-01-15-session.tmp');
        fs.writeFileSync(oldFile, '# Old Format Session\n\n**Date:** 2026-01-15\n');

        const freshSM = require('../../scripts/lib/session-manager');

        // Search by date ï¿½ triggers noIdMatch path
        const result = freshSM.getSessionById('2026-01-15');
        assert.ok(result, 'Should find old-format session by date string');
        assert.strictEqual(result.shortId, 'no-id',
          'Old format should have shortId "no-id"');
        assert.strictEqual(result.date, '2026-01-15');
        assert.strictEqual(result.filename, '2026-01-15-session.tmp');

        // Search by non-matching date ï¿½ should not find
        const noResult = freshSM.getSessionById('2026-01-16');
        assert.strictEqual(noResult, null,
          'Non-matching date should return null');
      });
    } finally {
      clearSessionManagerCache();
      sessionManager = require('../../scripts/lib/session-manager');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // -- Round 123: parseSessionMetadata with CRLF line endings ï¿½ section boundaries break --
  console.log('\nRound 123: parseSessionMetadata (CRLF section boundaries ï¿½ \\n\\n fails to match \\r\\n\\r\\n):');
  if (test('parseSessionMetadata CRLF content: \\n\\n boundary fails, lazy match bleeds across sections', () => {
    // session-manager.js lines 119-134: regex uses (?=###|\n\n|$) to delimit sections.
    // On CRLF content, a blank line is \r\n\r\n, NOT \n\n. The \n\n alternation
    // won't match, so the lazy [\s\S]*? extends past the blank line until it hits
    // ### or $. This means completed items may bleed into following sections.
    //
    // However, \s* in /### Completed\s*\n/ DOES match \r\n (since \r is whitespace),
    // so section headers still match ï¿½ only blank-line boundaries fail.

    // Test 1: CRLF with ### delimiter ï¿½ works because ### is an alternation
    const crlfWithHash = [
      '# Session Title\r\n',
      '\r\n',
      '### Completed\r\n',
      '- [x] Task A\r\n',
      '### In Progress\r\n',
      '- [ ] Task B\r\n'
    ].join('');
    const meta1 = sessionManager.parseSessionMetadata(crlfWithHash);
    // ### delimiter still works ï¿½ lazy match stops at ### In Progress
    assert.ok(meta1.completed.length >= 1,
      'Completed section should find at least 1 item with ### boundary on CRLF');
    // Check that Task A is found (may include \r in the trimmed text)
    const taskA = meta1.completed[0];
    assert.ok(taskA.includes('Task A'),
      'Should extract Task A from completed section');

    // Test 2: CRLF with \n\n (blank line) delimiter ï¿½ this is where it breaks
    const crlfBlankLine = [
      '# Session\r\n',
      '\r\n',
      '### Completed\r\n',
      '- [x] First task\r\n',
      '\r\n',         // Blank line = \r\n\r\n ï¿½ won't match \n\n
      'Some other text\r\n'
    ].join('');
    const meta2 = sessionManager.parseSessionMetadata(crlfBlankLine);
    // On LF, blank line stops the lazy match. On CRLF, it bleeds through.
    // The lazy [\s\S]*? stops at $ if no ### or \n\n matches,
    // so "Some other text" may end up captured in the raw section text.
    // But the items regex /- \[x\]\s*(.+)/g only captures checkbox lines,
    // so the count stays correct despite the bleed.
    assert.strictEqual(meta2.completed.length, 1,
      'Even with CRLF bleed, checkbox regex only matches "- [x]" lines');

    // Test 3: LF version of same content ï¿½ proves \n\n works normally
    const lfBlankLine = '# Session\n\n### Completed\n- [x] First task\n\nSome other text\n';
    const meta3 = sessionManager.parseSessionMetadata(lfBlankLine);
    assert.strictEqual(meta3.completed.length, 1,
      'LF version: blank line correctly delimits section');

    // Test 4: CRLF notes section ï¿½ lazy match goes to $ when \n\n fails
    const crlfNotes = [
      '# Session\r\n',
      '\r\n',
      '### Notes for Next Session\r\n',
      'Remember to review\r\n',
      '\r\n',
      'This should be separate\r\n'
    ].join('');
    const meta4 = sessionManager.parseSessionMetadata(crlfNotes);
    // On CRLF, \n\n fails ? lazy match extends to $ ? includes "This should be separate"
    // On LF, \n\n works ? notes = "Remember to review" only
    const lfNotes = '# Session\n\n### Notes for Next Session\nRemember to review\n\nThis should be separate\n';
    const meta5 = sessionManager.parseSessionMetadata(lfNotes);
    assert.strictEqual(meta5.notes, 'Remember to review',
      'LF: notes stop at blank line');
    // CRLF notes will be longer (bleed through blank line)
    assert.ok(meta4.notes.length >= meta5.notes.length,
      'CRLF notes >= LF notes length (CRLF may bleed past blank line)');
  })) passed++; else failed++;

  // -- Round 124: getAllSessions with invalid date format (strict equality, no normalization) --
  console.log('\nRound 124: getAllSessions (invalid date format ï¿½ strict !== comparison):');
  if (test('getAllSessions date filter uses strict equality so wrong format returns empty', () => {
    // session-manager.js line 228: `if (date && metadata.date !== date)` ï¿½ strict inequality.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'r124-date-format-'));
    const homeDir = path.join(tmpDir, 'home');

    try {
      withEnv({ HOME: homeDir, USERPROFILE: homeDir, CLAUDE_DIR: undefined }, () => {
        clearSessionManagerCache();
        const freshUtils = require('../../scripts/lib/utils');
        const sessionsDir = freshUtils.getSessionsDir();
        fs.mkdirSync(sessionsDir, { recursive: true });
        fs.writeFileSync(
          path.join(sessionsDir, '2026-01-15-abcd1234-session.tmp'),
          '# Test Session'
        );
        const freshSM = require('../../scripts/lib/session-manager');

        // Correct format ï¿½ should find 1 session
        const correct = freshSM.getAllSessions({ date: '2026-01-15' });
        assert.strictEqual(correct.sessions.length, 1,
          'Correct YYYY-MM-DD format should match');

        // Wrong separator ï¿½ strict !== means no match
        const wrongSep = freshSM.getAllSessions({ date: '2026/01/15' });
        assert.strictEqual(wrongSep.sessions.length, 0,
          'Slash-separated date does not match (strict string equality)');

        // US format ï¿½ no match
        const usFormat = freshSM.getAllSessions({ date: '01-15-2026' });
        assert.strictEqual(usFormat.sessions.length, 0,
          'MM-DD-YYYY format does not match YYYY-MM-DD');

        // Partial date ï¿½ no match
        const partial = freshSM.getAllSessions({ date: '2026-01' });
        assert.strictEqual(partial.sessions.length, 0,
          'Partial YYYY-MM does not match full YYYY-MM-DD');

        // null date ï¿½ skips filter, returns all
        const nullDate = freshSM.getAllSessions({ date: null });
        assert.strictEqual(nullDate.sessions.length, 1,
          'null date skips filter and returns all sessions');
      });
    } finally {
      clearSessionManagerCache();
      sessionManager = require('../../scripts/lib/session-manager');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // -- Round 124: parseSessionMetadata title edge cases (no space, wrong level, multiple, empty) --
  console.log('\nRound 124: parseSessionMetadata (title regex edge cases ï¿½ /^#\\s+(.+)$/m):');
  if (test('parseSessionMetadata title: no space after # fails, ## fails, multiple picks first, empty trims', () => {
    // session-manager.js line 95: /^#\s+(.+)$/m
    // \s+ requires at least one whitespace after #, (.+) captures rest of line

    // No space after # ï¿½ \s+ fails to match
    const noSpace = '#NoSpaceTitle\n\nSome content';
    const meta1 = sessionManager.parseSessionMetadata(noSpace);
    assert.strictEqual(meta1.title, null,
      '#NoSpaceTitle has no whitespace after # ? title is null');

    // ## (H2) heading ï¿½ ^ anchors to line start, but # matches first char only
    // /^#\s+/ matches the first # then \s+ would need whitespace, but ## has another #
    // Actually: /^#\s+(.+)$/ ? "##" ? # then \s+ ? # is not whitespace ? no match
    const h2 = '## Subtitle\n\nContent';
    const meta2 = sessionManager.parseSessionMetadata(h2);
    assert.strictEqual(meta2.title, null,
      '## heading does not match /^#\\s+/ because second # is not whitespace');

    // Multiple # headings ï¿½ first match wins (regex .match returns first)
    const multiple = '# First Title\n\n# Second Title\n\nContent';
    const meta3 = sessionManager.parseSessionMetadata(multiple);
    assert.strictEqual(meta3.title, 'First Title',
      'Multiple H1 headings: .match() returns first occurrence');

    // # followed by spaces then text ï¿½ leading spaces in capture are trimmed
    const padded = '#   Padded Title   \n\nContent';
    const meta4 = sessionManager.parseSessionMetadata(padded);
    assert.strictEqual(meta4.title, 'Padded Title',
      'Extra spaces: \\s+ matches multiple spaces, (.+) captures, .trim() cleans');

    // # followed by just spaces (no actual title text)
    // Surprising: \s+ is greedy and includes \n, so it matches "    \n\n" (spaces + newlines)
    // Then (.+) captures "Content" from the next non-empty line!
    const spacesOnly = '#    \n\nContent';
    const meta5 = sessionManager.parseSessionMetadata(spacesOnly);
    assert.strictEqual(meta5.title, 'Content',
      'Spaces-only after # ? \\s+ greedily matches spaces+newlines, (.+) captures next line text');

    // Tab after # ï¿½ \s includes tab
    const tabTitle = '#\tTab Title\n\nContent';
    const meta6 = sessionManager.parseSessionMetadata(tabTitle);
    assert.strictEqual(meta6.title, 'Tab Title',
      'Tab after # matches \\s+ (\\s includes \\t)');
  })) passed++; else failed++;

  // Summary
  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();


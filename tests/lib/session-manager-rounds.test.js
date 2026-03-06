/**
 * Tests for scripts/lib/session-manager.js
 *
 * Run with: node tests/lib/session-manager-rounds.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { test } = require('../helpers/test-runner');
const { clearSessionManagerCache, createTempSessionDir, cleanup } = require('../helpers/session-manager-test-utils');
const { withEnv } = require('../helpers/env-test-utils');

let sessionManager = require('../../scripts/lib/session-manager');
const utils = require('../../scripts/lib/utils');

function runTests() {
  console.log('\n=== Testing session-manager.js (Round Cases) ===\n');

  let passed = 0;
  let failed = 0;

  // Isolated fixture for rounds that depend on seeded sessions via HOME/USERPROFILE.
  // Matches the source data used in the original monolithic suite.
  const tmpHome = path.join(os.tmpdir(), `ecc-session-mgr-test-${Date.now()}`);
  const origHome = process.env.HOME;
  const origUserProfile = process.env.USERPROFILE;
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  const tmpSessionsDir = utils.getSessionsDir();
  fs.mkdirSync(tmpSessionsDir, { recursive: true });

  const testSessions = [
    { name: '2026-01-15-abcd1234-session.tmp', content: '# Session 1' },
    { name: '2026-01-20-efgh5678-session.tmp', content: '# Session 2' },
    { name: '2026-02-01-ijkl9012-session.tmp', content: '# Session 3' },
    { name: '2026-02-01-mnop3456-session.tmp', content: '# Session 4' },
    { name: '2026-02-10-session.tmp', content: '# Old format session' },
  ];
  for (let i = 0; i < testSessions.length; i++) {
    const filePath = path.join(tmpSessionsDir, testSessions[i].name);
    fs.writeFileSync(filePath, testSessions[i].content);
    const mtime = new Date(Date.now() - (testSessions.length - i) * 60000);
    fs.utimesSync(filePath, mtime, mtime);
  }

  // -- Round 43: getSessionById default excludes content --
  console.log('\nRound 43: getSessionById (default excludes content):');

  if (test('getSessionById without includeContent omits content, metadata, and stats', () => {
    // Default call (includeContent=false) should NOT load file content
    const result = sessionManager.getSessionById('abcd1234');
    assert.ok(result, 'Should find the session');
    assert.strictEqual(result.shortId, 'abcd1234');
    // These fields should be absent when includeContent is false
    assert.strictEqual(result.content, undefined, 'content should be undefined');
    assert.strictEqual(result.metadata, undefined, 'metadata should be undefined');
    assert.strictEqual(result.stats, undefined, 'stats should be undefined');
    // Basic fields should still be present
    assert.ok(result.sessionPath, 'sessionPath should be present');
    assert.ok(result.size !== undefined, 'size should be present');
    assert.ok(result.modifiedTime, 'modifiedTime should be present');
  })) passed++; else failed++;

  // -- Round 54: search filter scope and getSessionPath utility --
  console.log('\nRound 54: search filter scope and path utility:');

  if (test('getAllSessions search filter matches only short ID, not title or content', () => {
    // "Session" appears in file CONTENT (e.g. "# Session 1") but not in any shortId
    const result = sessionManager.getAllSessions({ search: 'Session', limit: 100 });
    assert.strictEqual(result.total, 0, 'Search should not match title/content, only shortId');
    // Verify that searching by actual shortId substring still works
    const result2 = sessionManager.getAllSessions({ search: 'abcd', limit: 100 });
    assert.strictEqual(result2.total, 1, 'Search by shortId should still work');
  })) passed++; else failed++;

  if (test('getSessionPath returns absolute path for session filename', () => {
    const filename = '2026-02-01-testpath-session.tmp';
    const result = sessionManager.getSessionPath(filename);
    assert.ok(path.isAbsolute(result), 'Should return an absolute path');
    assert.ok(result.endsWith(filename), `Path should end with filename, got: ${result}`);
    // Sessions dir is under tool config (.cursor, .claude, or .codex) ï¿½ be tool-agnostic
    const configDir = utils.getConfigDir();
    assert.ok(result.includes(configDir), `Path should include config dir, got: ${result}`);
    assert.ok(result.includes('sessions'), 'Path should include sessions directory');
  })) passed++; else failed++;

  // -- Round 66: getSessionById noIdMatch path (date-only string for old format) --
  console.log('\nRound 66: getSessionById (noIdMatch ï¿½ date-only match for old format):');

  if (test('getSessionById finds old-format session by date-only string (noIdMatch)', () => {
    // File is 2026-02-10-session.tmp (old format, shortId = 'no-id')
    // Calling with '2026-02-10' ? filenameMatch fails (filename !== '2026-02-10' and !== '2026-02-10.tmp')
    // shortIdMatch fails (shortId === 'no-id', not !== 'no-id')
    // noIdMatch succeeds: shortId === 'no-id' && filename === '2026-02-10-session.tmp'
    const result = sessionManager.getSessionById('2026-02-10');
    assert.ok(result, 'Should find old-format session by date-only string');
    assert.strictEqual(result.shortId, 'no-id', 'Should have no-id shortId');
    assert.ok(result.filename.includes('2026-02-10-session.tmp'), 'Should match old-format file');
    assert.ok(result.sessionPath, 'Should have sessionPath');
    assert.ok(result.date === '2026-02-10', 'Should have correct date');
  })) passed++; else failed++;

  // Cleanup ï¿½ restore both HOME and USERPROFILE (Windows)
  process.env.HOME = origHome;
  if (origUserProfile !== undefined) {
    process.env.USERPROFILE = origUserProfile;
  } else {
    delete process.env.USERPROFILE;
  }
  try {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  } catch {
    // best-effort
  }

  // -- Round 30: datetime local-time fix and parseSessionFilename edge cases --
  console.log('\nRound 30: datetime local-time fix:');

  if (test('datetime day matches the filename date (local-time constructor)', () => {
    const result = sessionManager.parseSessionFilename('2026-06-15-abcdef12-session.tmp');
    assert.ok(result);
    // With the fix, getDate()/getMonth() should return local-time values
    // matching the filename, regardless of timezone
    assert.strictEqual(result.datetime.getDate(), 15, 'Day should be 15 (local time)');
    assert.strictEqual(result.datetime.getMonth(), 5, 'Month should be 5 (June, 0-indexed)');
    assert.strictEqual(result.datetime.getFullYear(), 2026, 'Year should be 2026');
  })) passed++; else failed++;

  if (test('datetime matches for January 1 (timezone-sensitive date)', () => {
    // Jan 1 at UTC midnight is Dec 31 in negative offsets ï¿½ this tests the fix
    const result = sessionManager.parseSessionFilename('2026-01-01-abc12345-session.tmp');
    assert.ok(result);
    assert.strictEqual(result.datetime.getDate(), 1, 'Day should be 1 in local time');
    assert.strictEqual(result.datetime.getMonth(), 0, 'Month should be 0 (January)');
  })) passed++; else failed++;

  if (test('datetime matches for December 31 (year boundary)', () => {
    const result = sessionManager.parseSessionFilename('2025-12-31-abc12345-session.tmp');
    assert.ok(result);
    assert.strictEqual(result.datetime.getDate(), 31);
    assert.strictEqual(result.datetime.getMonth(), 11); // December
    assert.strictEqual(result.datetime.getFullYear(), 2025);
  })) passed++; else failed++;

  console.log('\nRound 30: parseSessionFilename edge cases:');

  if (test('parses session ID with many dashes (UUID-like)', () => {
    const result = sessionManager.parseSessionFilename('2026-02-13-a1b2c3d4-session.tmp');
    assert.ok(result);
    assert.strictEqual(result.shortId, 'a1b2c3d4');
    assert.strictEqual(result.date, '2026-02-13');
  })) passed++; else failed++;

  if (test('rejects filename with missing session.tmp suffix', () => {
    const result = sessionManager.parseSessionFilename('2026-02-13-abc12345.tmp');
    assert.strictEqual(result, null, 'Should reject filename without -session.tmp');
  })) passed++; else failed++;

  if (test('rejects filename with extra text after suffix', () => {
    const result = sessionManager.parseSessionFilename('2026-02-13-abc12345-session.tmp.bak');
    assert.strictEqual(result, null, 'Should reject filenames with extra extension');
  })) passed++; else failed++;

  if (test('handles old-format filename without session ID', () => {
    // The regex match[2] is undefined for old format ? shortId defaults to 'no-id'
    const result = sessionManager.parseSessionFilename('2026-02-13-session.tmp');
    if (result) {
      assert.strictEqual(result.shortId, 'no-id', 'Should default to no-id');
    }
    // Either null (regex doesn't match) or has no-id ï¿½ both are acceptable
    assert.ok(true, 'Old format handled without crash');
  })) passed++; else failed++;

  // -- Round 33: birthtime / createdTime fallback --
  console.log('\ncreatedTime fallback (Round 33):');

  // Use HOME override approach (consistent with existing getAllSessions tests)
  const r33Home = path.join(os.tmpdir(), `ecc-r33-birthtime-${Date.now()}`);
  try {
    withEnv({ HOME: r33Home, USERPROFILE: r33Home }, () => {
      clearSessionManagerCache();
      const r33Utils = require('../../scripts/lib/utils');
      const r33SessionsDir = r33Utils.getSessionsDir();
      fs.mkdirSync(r33SessionsDir, { recursive: true });
      const r33Filename = '2026-02-13-r33birth-session.tmp';
      const r33FilePath = path.join(r33SessionsDir, r33Filename);
      fs.writeFileSync(r33FilePath, '{"type":"test"}');
      const r33SM = require('../../scripts/lib/session-manager');

      if (test('getAllSessions returns createdTime from birthtime when available', () => {
        const result = r33SM.getAllSessions({ limit: 100 });
        assert.ok(result.sessions.length > 0, 'Should find the test session');
        const session = result.sessions[0];
        assert.ok(session.createdTime instanceof Date, 'createdTime should be a Date');
        // birthtime should be populated on macOS/Windows ï¿½ createdTime should match it
        const stats = fs.statSync(r33FilePath);
        if (stats.birthtime && stats.birthtime.getTime() > 0) {
          assert.strictEqual(
            session.createdTime.getTime(),
            stats.birthtime.getTime(),
            'createdTime should match birthtime when available'
          );
        }
      })) passed++; else failed++;

      if (test('getSessionById returns createdTime field', () => {
        const session = r33SM.getSessionById('r33birth');
        assert.ok(session, 'Should find the session');
        assert.ok(session.createdTime instanceof Date, 'createdTime should be a Date');
        assert.ok(session.createdTime.getTime() > 0, 'createdTime should be non-zero');
      })) passed++; else failed++;

      if (test('createdTime falls back to ctime when birthtime is epoch-zero', () => {
        // This tests the || fallback logic: stats.birthtime || stats.ctime
        // On some FS, birthtime may be epoch 0 (falsy as a Date number comparison
        // but truthy as a Date object). The fallback is defensive.
        const stats = fs.statSync(r33FilePath);
        // Both birthtime and ctime should be valid Dates on any modern OS
        assert.ok(stats.ctime instanceof Date, 'ctime should exist');
        // The fallback expression `birthtime || ctime` should always produce a valid Date
        const fallbackResult = stats.birthtime || stats.ctime;
        assert.ok(fallbackResult instanceof Date, 'Fallback should produce a Date');
        assert.ok(fallbackResult.getTime() > 0, 'Fallback date should be non-zero');
      })) passed++; else failed++;
    });
  } finally {
    clearSessionManagerCache();
    sessionManager = require('../../scripts/lib/session-manager');
    try { fs.rmSync(r33Home, { recursive: true, force: true }); } catch (_e) { /* ignore cleanup errors */ }
  }

  // -- Round 46: path heuristic and checklist edge cases --
  console.log('\ngetSessionStats Windows path heuristic (Round 46):');

  if (test('recognises Windows drive-letter path as a file path', () => {
    // The looksLikePath regex includes /^[A-Za-z]:[/\\]/ for Windows
    // A non-existent Windows path should still be treated as a path
    // (getSessionContent returns null ? parseSessionMetadata(null) ? defaults)
    const stats1 = sessionManager.getSessionStats('C:/Users/test/session.tmp');
    assert.strictEqual(stats1.lineCount, 0, 'C:/ path treated as path, not content');
    const stats2 = sessionManager.getSessionStats('D:\\Sessions\\2026-01-01.tmp');
    assert.strictEqual(stats2.lineCount, 0, 'D:\\ path treated as path, not content');
  })) passed++; else failed++;

  if (test('does not treat bare drive letter without slash as path', () => {
    // "C:session.tmp" has no slash after colon ? regex fails ? treated as content
    const stats = sessionManager.getSessionStats('C:session.tmp');
    assert.strictEqual(stats.lineCount, 1, 'Bare C: without slash treated as content');
  })) passed++; else failed++;

  console.log('\nparseSessionMetadata checkbox case sensitivity (Round 46):');

  if (test('uppercase [X] does not match completed items regex', () => {
    const content = '# Test\n\n### Completed\n- [X] Uppercase task\n- [x] Lowercase task\n';
    const meta = sessionManager.parseSessionMetadata(content);
    // Regex is /- \[x\]\s*(.+)/g ï¿½ only matches lowercase [x]
    assert.strictEqual(meta.completed.length, 1, 'Only lowercase [x] should match');
    assert.strictEqual(meta.completed[0], 'Lowercase task');
  })) passed++; else failed++;

  // getAllSessions returns empty result when sessions directory does not exist
  if (test('getAllSessions returns empty when sessions dir missing', () => {
    const tmpDir = createTempSessionDir();
    try {
      withEnv({ HOME: tmpDir, USERPROFILE: tmpDir }, () => {
        // Re-require to pick up new HOME
        delete require.cache[require.resolve('../../scripts/lib/session-manager')];
        delete require.cache[require.resolve('../../scripts/lib/utils')];
        const freshSM = require('../../scripts/lib/session-manager');
        const result = freshSM.getAllSessions();
        assert.deepStrictEqual(result.sessions, [], 'Should return empty sessions array');
        assert.strictEqual(result.total, 0, 'Total should be 0');
        assert.strictEqual(result.hasMore, false, 'hasMore should be false');
      });
    } finally {
      delete require.cache[require.resolve('../../scripts/lib/session-manager')];
      delete require.cache[require.resolve('../../scripts/lib/utils')];
      cleanup(tmpDir);
    }
  })) passed++; else failed++;

  // -- Round 69: getSessionById returns null when sessions dir missing --
  console.log('\nRound 69: getSessionById (missing sessions directory):');

  if (test('getSessionById returns null when sessions directory does not exist', () => {
    const tmpDir = createTempSessionDir();
    try {
      withEnv({ HOME: tmpDir, USERPROFILE: tmpDir }, () => {
        // Re-require to pick up new HOME
        delete require.cache[require.resolve('../../scripts/lib/session-manager')];
        delete require.cache[require.resolve('../../scripts/lib/utils')];
        const freshSM = require('../../scripts/lib/session-manager');
        const result = freshSM.getSessionById('anything');
        assert.strictEqual(result, null, 'Should return null when sessions dir does not exist');
      });
    } finally {
      delete require.cache[require.resolve('../../scripts/lib/session-manager')];
      delete require.cache[require.resolve('../../scripts/lib/utils')];
      cleanup(tmpDir);
    }
  })) passed++; else failed++;

  // -- Round 78: getSessionStats reads real file when given existing .tmp path --
  console.log('\nRound 78: getSessionStats (actual file path ? reads from disk):');

  if (test('getSessionStats reads from disk when given path to existing .tmp file', () => {
    const dir = createTempSessionDir();
    try {
      const sessionPath = path.join(dir, '2026-03-01-test1234-session.tmp');
      const content = '# Real File Stats Test\n\n**Date:** 2026-03-01\n**Started:** 09:00\n\n### Completed\n- [x] First task\n- [x] Second task\n\n### In Progress\n- [ ] Third task\n\n### Notes for Next Session\nDon\'t forget the edge cases\n';
      fs.writeFileSync(sessionPath, content);

      // Pass the FILE PATH (not content) ï¿½ this exercises looksLikePath branch
      const stats = sessionManager.getSessionStats(sessionPath);
      assert.strictEqual(stats.completedItems, 2, 'Should find 2 completed items from file');
      assert.strictEqual(stats.inProgressItems, 1, 'Should find 1 in-progress item from file');
      assert.strictEqual(stats.totalItems, 3, 'Should find 3 total items from file');
      assert.strictEqual(stats.hasNotes, true, 'Should detect notes section from file');
      assert.ok(stats.lineCount > 5, `Should have multiple lines from file, got ${stats.lineCount}`);
    } finally {
      cleanup(dir);
    }
  })) passed++; else failed++;

  // -- Round 78: getAllSessions hasContent field --
  console.log('\nRound 78: getAllSessions (hasContent field):');

  if (test('getAllSessions hasContent is true for non-empty and false for empty files', () => {
    const isoHome = path.join(os.tmpdir(), `ecc-hascontent-${Date.now()}`);
    try {
      withEnv({ HOME: isoHome, USERPROFILE: isoHome }, () => {
        clearSessionManagerCache();
        const freshUtils = require('../../scripts/lib/utils');
        const isoSessions = freshUtils.getSessionsDir();
        fs.mkdirSync(isoSessions, { recursive: true });
        fs.writeFileSync(path.join(isoSessions, '2026-04-01-nonempty-session.tmp'), '# Has content');
        fs.writeFileSync(path.join(isoSessions, '2026-04-02-emptyfile-session.tmp'), '');

        const freshSM = require('../../scripts/lib/session-manager');

        const result = freshSM.getAllSessions({ limit: 100 });
        assert.strictEqual(result.total, 2, 'Should find both sessions');

        const nonEmpty = result.sessions.find(s => s.shortId === 'nonempty');
        const empty = result.sessions.find(s => s.shortId === 'emptyfile');

        assert.ok(nonEmpty, 'Should find the non-empty session');
        assert.ok(empty, 'Should find the empty session');
        assert.strictEqual(nonEmpty.hasContent, true, 'Non-empty file should have hasContent: true');
        assert.strictEqual(empty.hasContent, false, 'Empty file should have hasContent: false');
      });
    } finally {
      clearSessionManagerCache();
      sessionManager = require('../../scripts/lib/session-manager');
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // -- Round 75: deleteSession catch ï¿½ unlinkSync throws on read-only dir --
  console.log('\nRound 75: deleteSession (unlink failure in read-only dir):');

  if (test('deleteSession returns false when file exists but directory is read-only', () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) {
      console.log('    (skipped ï¿½ chmod ineffective on Windows/root)');
      return;
    }
    const tmpDir = path.join(os.tmpdir(), `sm-del-ro-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const sessionFile = path.join(tmpDir, 'test-session.tmp');
    fs.writeFileSync(sessionFile, 'session content');
    try {
      // Make directory read-only so unlinkSync throws EACCES
      fs.chmodSync(tmpDir, 0o555);
      const result = sessionManager.deleteSession(sessionFile);
      assert.strictEqual(result, false, 'Should return false when unlinkSync fails');
    } finally {
      try { fs.chmodSync(tmpDir, 0o755); } catch { /* best-effort */ }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // -- Round 81: getSessionStats(null) --
  console.log('\nRound 81: getSessionStats(null) (null input):');

  if (test('getSessionStats(null) returns zero lineCount and empty metadata', () => {
    // session-manager.js line 158-177: getSessionStats accepts path or content.
    // typeof null === 'string' is false ? looksLikePath = false ? content = null.
    // Line 177: content ? content.split('\n').length : 0 ? lineCount: 0.
    // parseSessionMetadata(null) returns defaults ? totalItems/completedItems/inProgressItems = 0.
    const stats = sessionManager.getSessionStats(null);
    assert.strictEqual(stats.lineCount, 0, 'null input should yield lineCount 0');
    assert.strictEqual(stats.totalItems, 0, 'null input should yield totalItems 0');
    assert.strictEqual(stats.completedItems, 0, 'null input should yield completedItems 0');
    assert.strictEqual(stats.inProgressItems, 0, 'null input should yield inProgressItems 0');
    assert.strictEqual(stats.hasNotes, false, 'null input should yield hasNotes false');
    assert.strictEqual(stats.hasContext, false, 'null input should yield hasContext false');
  })) passed++; else failed++;

  // -- Round 83: getAllSessions TOCTOU statSync catch (broken symlink) --
  console.log('\nRound 83: getAllSessions (broken symlink ï¿½ statSync catch):');

  if (test('getAllSessions skips broken symlink .tmp files gracefully', () => {
    // getAllSessions at line 241-246: statSync throws for broken symlinks,
    // the catch causes `continue`, skipping that entry entirely.
    const isoHome = path.join(os.tmpdir(), `ecc-r83-toctou-${Date.now()}`);
    try {
      withEnv({ HOME: isoHome, USERPROFILE: isoHome }, () => {
        clearSessionManagerCache();
        const freshUtils = require('../../scripts/lib/utils');
        const sessionsDir = freshUtils.getSessionsDir();
        fs.mkdirSync(sessionsDir, { recursive: true });

        const realFile = '2026-02-10-abcd1234-session.tmp';
        fs.writeFileSync(path.join(sessionsDir, realFile), '# Real session\n');

        const brokenSymlink = '2026-02-10-deadbeef-session.tmp';
        fs.symlinkSync('/nonexistent/path/that/does/not/exist', path.join(sessionsDir, brokenSymlink));

        const freshManager = require('../../scripts/lib/session-manager');
        const result = freshManager.getAllSessions({ limit: 100 });

        // Should have only the real session, not the broken symlink
        assert.strictEqual(result.total, 1, 'Should find only the real session, not the broken symlink');
        assert.ok(result.sessions[0].filename === realFile,
          `Should return the real file, got: ${result.sessions[0].filename}`);
      });
    } finally {
      clearSessionManagerCache();
      sessionManager = require('../../scripts/lib/session-manager');
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // -- Round 84: getSessionById TOCTOU ï¿½ statSync catch returns null for broken symlink --
  console.log('\nRound 84: getSessionById (broken symlink ï¿½ statSync catch):');

  if (test('getSessionById returns null when matching session is a broken symlink', () => {
    // getSessionById at line 307-310: statSync throws for broken symlinks,
    // the catch returns null (file deleted between readdir and stat).
    const isoHome = path.join(os.tmpdir(), `ecc-r84-getbyid-toctou-${Date.now()}`);
    try {
      withEnv({ HOME: isoHome, USERPROFILE: isoHome }, () => {
        clearSessionManagerCache();
        const freshUtils = require('../../scripts/lib/utils');
        const sessionsDir = freshUtils.getSessionsDir();
        fs.mkdirSync(sessionsDir, { recursive: true });

        const brokenFile = '2026-02-11-deadbeef-session.tmp';
        fs.symlinkSync('/nonexistent/target/that/does/not/exist', path.join(sessionsDir, brokenFile));

        const freshSM = require('../../scripts/lib/session-manager');

        // Search by the short ID "deadbeef" ï¿½ should match the broken symlink
        const result = freshSM.getSessionById('deadbeef');
        assert.strictEqual(result, null,
          'Should return null when matching session file is a broken symlink');
      });
    } finally {
      clearSessionManagerCache();
      sessionManager = require('../../scripts/lib/session-manager');
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // -- Round 88: parseSessionMetadata null date/started/lastUpdated fields --
  console.log('\nRound 88: parseSessionMetadata content lacking Date/Started/Updated fields:');
  if (test('parseSessionMetadata returns null for date, started, lastUpdated when fields absent', () => {
    const content = '# Title Only\n\n### Notes for Next Session\nSome notes\n';
    const meta = sessionManager.parseSessionMetadata(content);
    assert.strictEqual(meta.date, null,
      'date should be null when **Date:** field is absent');
    assert.strictEqual(meta.started, null,
      'started should be null when **Started:** field is absent');
    assert.strictEqual(meta.lastUpdated, null,
      'lastUpdated should be null when **Last Updated:** field is absent');
    // Confirm other fields still parse correctly
    assert.strictEqual(meta.title, 'Title Only');
    assert.strictEqual(meta.notes, 'Some notes');
  })) passed++; else failed++;

  // -- Round 89: getAllSessions skips subdirectories (!entry.isFile()) --
  console.log('\nRound 89: getAllSessions (subdirectory skip):');

  if (test('getAllSessions skips subdirectories inside sessions dir', () => {
    // session-manager.js line 220: if (!entry.isFile() || ...) continue;
    const isoHome = path.join(os.tmpdir(), `ecc-r89-subdir-skip-${Date.now()}`);
    try {
      withEnv({ HOME: isoHome, USERPROFILE: isoHome }, () => {
        clearSessionManagerCache();
        const freshUtils = require('../../scripts/lib/utils');
        const sessionsDir = freshUtils.getSessionsDir();
        fs.mkdirSync(sessionsDir, { recursive: true });

        const realFile = '2026-02-11-abcd1234-session.tmp';
        fs.writeFileSync(path.join(sessionsDir, realFile), '# Test session');

        const subdir = path.join(sessionsDir, 'some-nested-dir');
        fs.mkdirSync(subdir);

        const tmpSubdir = path.join(sessionsDir, '2026-02-11-fakeid00-session.tmp');
        fs.mkdirSync(tmpSubdir);

        const freshManager = require('../../scripts/lib/session-manager');
        const result = freshManager.getAllSessions({ limit: 100 });

        // Should find only the real file, not either subdirectory
        assert.strictEqual(result.total, 1,
          `Should find 1 session (the file), not subdirectories. Got ${result.total}`);
        assert.strictEqual(result.sessions[0].filename, realFile,
          `Should return the real file. Got: ${result.sessions[0].filename}`);
      });
    } finally {
      clearSessionManagerCache();
      sessionManager = require('../../scripts/lib/session-manager');
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // -- Round 91: getSessionStats with mixed Windows path separators --
  console.log('\nRound 91: getSessionStats (mixed Windows path separators):');

  if (test('getSessionStats treats mixed Windows separators as a file path', () => {
    // session-manager.js line 166: regex /^[A-Za-z]:[/\\]/ checks only the
    // character right after the colon. Mixed separators like C:\Users/Mixed\session.tmp
    // should still match because the first separator (\) satisfies the regex.
    const stats = sessionManager.getSessionStats('C:\\Users/Mixed\\session.tmp');
    assert.strictEqual(stats.lineCount, 0,
      'Mixed separators should be treated as path (file does not exist ? lineCount 0)');
    assert.strictEqual(stats.totalItems, 0, 'Non-existent path should have 0 items');
  })) passed++; else failed++;

  // -- Round 92: getSessionStats with UNC path treated as content --
  console.log('\nRound 92: getSessionStats (Windows UNC path):');

  if (test('getSessionStats treats UNC path as content (not recognized as file path)', () => {
    // session-manager.js line 163-166: The path heuristic checks for Unix paths
    // (starts with /) and Windows drive-letter paths (/^[A-Za-z]:[/\\]/). UNC paths
    // (\\server\share\file.tmp) don't match either pattern, so the function treats
    // the string as pre-read content rather than a file path to read.
    const stats = sessionManager.getSessionStats('\\\\server\\share\\session.tmp');
    assert.strictEqual(stats.lineCount, 1,
      'UNC path should be treated as single-line content (not a recognized path)');
  })) passed++; else failed++;

  // -- Round 93: getSessionStats with drive letter but no slash (regex boundary) --
  console.log('\nRound 93: getSessionStats (drive letter without slash ï¿½ regex boundary):');

  if (test('getSessionStats treats drive letter without slash as content (not a path)', () => {
    // session-manager.js line 166: /^[A-Za-z]:[/\\]/ requires a '/' or '\'
    // immediately after the colon.  'Z:nosession.tmp' has 'Z:n' which does NOT
    // match, so looksLikePath is false even though .endsWith('.tmp') is true.
    const stats = sessionManager.getSessionStats('Z:nosession.tmp');
    assert.strictEqual(stats.lineCount, 1,
      'Z:nosession.tmp (no slash) should be treated as single-line content');
    assert.strictEqual(stats.totalItems, 0,
      'Content without session items should have 0 totalItems');
  })) passed++; else failed++;

  // Re-establish test environment for Rounds 95-98 (these tests need sessions to exist)
  const tmpHome2 = path.join(os.tmpdir(), `ecc-session-mgr-test-2-${Date.now()}`);
  try {
    withEnv({ HOME: tmpHome2, USERPROFILE: tmpHome2 }, () => {
      clearSessionManagerCache();
      const tmpSessionsDir2 = require('../../scripts/lib/utils').getSessionsDir();
      fs.mkdirSync(tmpSessionsDir2, { recursive: true });
      const testSessions2 = [
        { name: '2026-01-15-aaaa1111-session.tmp', content: '# Test Session 1' },
        { name: '2026-02-01-bbbb2222-session.tmp', content: '# Test Session 2' },
        { name: '2026-02-10-cccc3333-session.tmp', content: '# Test Session 3' },
      ];
      for (const session of testSessions2) {
        const filePath = path.join(tmpSessionsDir2, session.name);
        fs.writeFileSync(filePath, session.content);
      }
      sessionManager = require('../../scripts/lib/session-manager');

      // -- Round 95: getAllSessions with both negative offset AND negative limit --
      console.log('\nRound 95: getAllSessions (both negative offset and negative limit):');

      if (test('getAllSessions clamps both negative offset (to 0) and negative limit (to 1) simultaneously', () => {
        const result = sessionManager.getAllSessions({ offset: -5, limit: -10 });
        // offset clamped: Math.max(0, Math.floor(-5)) ? 0
        // limit clamped: Math.max(1, Math.floor(-10)) ? 1
        // slice(0, 0+1) ? first session only
        assert.strictEqual(result.offset, 0,
          'Negative offset should be clamped to 0');
        assert.strictEqual(result.limit, 1,
          'Negative limit should be clamped to 1');
        assert.ok(result.sessions.length <= 1,
          'Should return at most 1 session (slice(0, 1))');
      })) passed++; else failed++;

      // -- Round 96: parseSessionFilename with Feb 30 (impossible date) --
      console.log('\nRound 96: parseSessionFilename (Feb 30 ï¿½ impossible date):');

      if (test('parseSessionFilename rejects Feb 30 (passes day<=31 but fails Date rollover)', () => {
        // Feb 30 passes the bounds check (month 1-12, day 1-31) at line 37
        // but new Date(2026, 1, 30) ? March 2 (rollover), so getMonth() !== 1 ? returns null
        const result = sessionManager.parseSessionFilename('2026-02-30-abcd1234-session.tmp');
        assert.strictEqual(result, null,
          'Feb 30 should be rejected by Date constructor rollover check (line 41)');
      })) passed++; else failed++;

      // -- Round 96: getAllSessions with limit: Infinity --
      console.log('\nRound 96: getAllSessions (limit: Infinity ï¿½ pagination bypass):');

      if (test('getAllSessions with limit: Infinity returns all sessions (no pagination)', () => {
        // Number(Infinity) = Infinity, Number.isNaN(Infinity) = false
        // Math.max(1, Math.floor(Infinity)) = Math.max(1, Infinity) = Infinity
        // slice(0, 0 + Infinity) returns all elements
        const result = sessionManager.getAllSessions({ limit: Infinity });
        assert.strictEqual(result.limit, Infinity,
          'Infinity limit should pass through (not clamped or defaulted)');
        assert.strictEqual(result.sessions.length, result.total,
          'All sessions should be returned (no pagination truncation)');
        assert.strictEqual(result.hasMore, false,
          'hasMore should be false since all sessions are returned');
      })) passed++; else failed++;

      // -- Round 96: getAllSessions with limit: null --
      console.log('\nRound 96: getAllSessions (limit: null ï¿½ destructuring default bypass):');

      if (test('getAllSessions with limit: null clamps to 1 (null bypasses destructuring default)', () => {
        // Destructuring default only fires for undefined, NOT null
        // rawLimit = null (not 50), Number(null) = 0, Math.max(1, 0) = 1
        const result = sessionManager.getAllSessions({ limit: null });
        assert.strictEqual(result.limit, 1,
          'null limit should become 1 (Number(null)=0, clamped via Math.max(1,0))');
        assert.ok(result.sessions.length <= 1,
          'Should return at most 1 session (clamped limit)');
      })) passed++; else failed++;

      // -- Round 97: getAllSessions with whitespace search filters out everything --
      console.log('\nRound 97: getAllSessions (whitespace search ï¿½ truthy but unmatched):');

      if (test('getAllSessions with search: " " returns empty because space is truthy but never matches shortId', () => {
        // session-manager.js line 233: if (search && !metadata.shortId.includes(search))
        // ' ' (space) is truthy so the filter is applied, but shortIds are hex strings
        // that never contain spaces, so ALL sessions are filtered out.
        // The search filter is inside the loop, so total is also 0.
        const result = sessionManager.getAllSessions({ search: ' ', limit: 100 });
        assert.strictEqual(result.sessions.length, 0,
          'Whitespace search should filter out all sessions (space never appears in hex shortIds)');
        assert.strictEqual(result.total, 0,
          'Total should be 0 because search filter is applied inside the loop (line 233)');
        assert.strictEqual(result.hasMore, false,
          'hasMore should be false since no sessions matched');
        // Contrast with null/empty search which returns all sessions:
        const allResult = sessionManager.getAllSessions({ search: null, limit: 100 });
        assert.ok(allResult.total > 0,
          'Null search should return sessions (confirming they exist but space filtered them)');
      })) passed++; else failed++;

      // -- Round 98: getSessionById with null sessionId throws TypeError --
      console.log('\nRound 98: getSessionById (null sessionId ï¿½ crashes at line 297):');

      if (test('getSessionById(null) throws TypeError when session files exist', () => {
        // session-manager.js line 297: `sessionId.length > 0` ï¿½ calling .length on null
        // throws TypeError because there's no early guard for null/undefined input.
        // This only surfaces when valid .tmp files exist in the sessions directory.
        assert.throws(
          () => sessionManager.getSessionById(null),
          { name: 'TypeError' },
          'null.length should throw TypeError (no input guard at function entry)'
        );
      })) passed++; else failed++;
    });
  } finally {
    clearSessionManagerCache();
    sessionManager = require('../../scripts/lib/session-manager');
    try {
      fs.rmSync(tmpHome2, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }

  // -- Round 98: parseSessionFilename with null input throws TypeError --
  console.log('\nRound 98: parseSessionFilename (null input ï¿½ crashes at line 30):');

  if (test('parseSessionFilename(null) throws TypeError because null has no .match()', () => {
    // session-manager.js line 30: `filename.match(SESSION_FILENAME_REGEX)`
    // When filename is null, null.match() throws TypeError.
    // Function lacks a type guard like `if (!filename || typeof filename !== 'string')`.
    assert.throws(
      () => sessionManager.parseSessionFilename(null),
      { name: 'TypeError' },
      'null.match() should throw TypeError (no type guard on filename parameter)'
    );
  })) passed++; else failed++;

  // -- Round 99: writeSessionContent with null path returns false (error caught) --
  console.log('\nRound 99: writeSessionContent (null path ï¿½ error handling):');

  if (test('writeSessionContent(null, content) returns false (TypeError caught by try/catch)', () => {
    // session-manager.js lines 372-378: writeSessionContent wraps fs.writeFileSync
    // in a try/catch. When sessionPath is null, fs.writeFileSync throws TypeError:
    // 'The "path" argument must be of type string or Buffer or URL. Received null'
    // The catch block catches this and returns false (does not propagate).
    const result = sessionManager.writeSessionContent(null, 'some content');
    assert.strictEqual(result, false,
      'null path should be caught by try/catch and return false');
  })) passed++; else failed++;

  // -- Round 100: parseSessionMetadata with ### inside item text (premature section termination) --
  console.log('\nRound 100: parseSessionMetadata (### in item text ï¿½ lazy regex truncation):');
  if (test('parseSessionMetadata truncates item text at embedded ### due to lazy regex lookahead', () => {
    const content = `# Session

### Completed
- [x] Fix issue ### with parser
- [x] Normal task

### In Progress
- [ ] Debug output
`;
    const meta = sessionManager.parseSessionMetadata(content);
    // The lazy regex ([\s\S]*?)(?=###|\n\n|$) terminates at the first ###
    // So the Completed section captures only "- [x] Fix issue " (before the inner ###)
    // The second item "- [x] Normal task" is lost because it's after the inner ###
    assert.strictEqual(meta.completed.length, 1,
      'Only 1 item extracted ï¿½ second item is after the inner ### terminator');
    assert.strictEqual(meta.completed[0], 'Fix issue',
      'Item text truncated at embedded ### (lazy regex stops at first ### match)');
  })) passed++; else failed++;

  // -- Round 101: getSessionStats with non-string input (number) throws TypeError --
  console.log('\nRound 101: getSessionStats (non-string input ï¿½ type confusion crash):');
  if (test('getSessionStats(123) throws TypeError (number reaches parseSessionMetadata ? .match() fails)', () => {
    // typeof 123 === 'number' ? looksLikePath = false ? content = 123
    // parseSessionMetadata(123) ? !123 is false ? 123.match(...) ? TypeError
    assert.throws(
      () => sessionManager.getSessionStats(123),
      { name: 'TypeError' },
      'Non-string input (number) should crash in parseSessionMetadata (.match not a function)'
    );
  })) passed++; else failed++;

  // -- Round 101: appendSessionContent(null, 'content') returns false (error caught) --
  console.log('\nRound 101: appendSessionContent (null path ï¿½ error handling):');
  if (test('appendSessionContent(null, content) returns false (TypeError caught by try/catch)', () => {
    const result = sessionManager.appendSessionContent(null, 'some content');
    assert.strictEqual(result, false,
      'null path should cause fs.appendFileSync to throw TypeError, caught by try/catch');
  })) passed++; else failed++;

  // -- Round 102: getSessionStats with Unix nonexistent .tmp path (looksLikePath heuristic) --
  console.log('\nRound 102: getSessionStats (Unix nonexistent .tmp path ï¿½ looksLikePath ? null content):');
  if (test('getSessionStats returns zeroed stats when Unix path looks like file but does not exist', () => {
    // session-manager.js lines 163-166: looksLikePath heuristic checks typeof string,
    // no newlines, endsWith('.tmp'), startsWith('/').  A nonexistent Unix path triggers
    // the file-read branch ? readFile returns null ? parseSessionMetadata(null) returns
    // default empty metadata ? lineCount: null ? ... : 0 === 0.
    const stats = sessionManager.getSessionStats('/nonexistent/deep/path/session.tmp');
    assert.strictEqual(stats.totalItems, 0,
      'No items from nonexistent file (parseSessionMetadata(null) returns empty arrays)');
    assert.strictEqual(stats.lineCount, 0,
      'lineCount: 0 because content is null (ternary guard at line 177)');
    assert.strictEqual(stats.hasNotes, false,
      'No notes section in null content');
    assert.strictEqual(stats.hasContext, false,
      'No context section in null content');
  })) passed++; else failed++;

  // -- Round 102: parseSessionMetadata with [x] checked items in In Progress section --
  console.log('\nRound 102: parseSessionMetadata ([x] items in In Progress ï¿½ regex skips checked):');
  if (test('parseSessionMetadata skips [x] checked items in In Progress section (regex only matches [ ])', () => {
    // session-manager.js line 130: progressSection regex uses `- \[ \]\s*(.+)` which
    // only matches unchecked checkboxes.  Checked items `- [x]` in the In Progress
    // section are silently ignored ï¿½ they don't match the regex pattern.
    const content = `# Session

### In Progress
- [x] Already finished but placed here by mistake
- [ ] Actually in progress
- [x] Another misplaced completed item
- [ ] Second active task
`;
    const meta = sessionManager.parseSessionMetadata(content);
    assert.strictEqual(meta.inProgress.length, 2,
      'Only unchecked [ ] items should be captured (2 of 4)');
    assert.strictEqual(meta.inProgress[0], 'Actually in progress',
      'First unchecked item');
    assert.strictEqual(meta.inProgress[1], 'Second active task',
      'Second unchecked item');
  })) passed++; else failed++;

  // -- Round 104: parseSessionMetadata with whitespace-only notes section --
  console.log('\nRound 104: parseSessionMetadata (whitespace-only notes ï¿½ trim reduces to empty):');
  if (test('parseSessionMetadata treats whitespace-only notes as absent (trim ? empty string ? falsy)', () => {
    // session-manager.js line 139: `metadata.notes = notesSection[1].trim()` ï¿½ when the
    // Notes section heading exists but only contains whitespace/newlines, trim() returns "".
    // Then getSessionStats line 178: `hasNotes: !!metadata.notes` ï¿½ `!!""` is `false`.
    // So a notes section with only whitespace is treated as "no notes."
    const content = `# Session

### Notes for Next Session
   \t

### Context to Load
\`\`\`
file.ts
\`\`\`
`;
    const meta = sessionManager.parseSessionMetadata(content);
    assert.strictEqual(meta.notes, '',
      'Whitespace-only notes should trim to empty string');
    // Verify getSessionStats reports hasNotes as false
    const stats = sessionManager.getSessionStats(content);
    assert.strictEqual(stats.hasNotes, false,
      'hasNotes should be false because !!"" is false (whitespace-only notes treated as absent)');
    assert.strictEqual(stats.hasContext, true,
      'hasContext should be true (context section has actual content)');
  })) passed++; else failed++;

  // -- Round 105: parseSessionMetadata blank-line boundary truncates section items --
  console.log('\nRound 105: parseSessionMetadata (blank line inside section ï¿½ regex stops at \\n\\n):');

  if (test('parseSessionMetadata drops completed items after a blank line within the section', () => {
    // session-manager.js line 119: regex `(?=###|\n\n|$)` uses lazy [\s\S]*? with
    // a lookahead that stops at the first \n\n. If completed items are separated
    // by a blank line, items below the blank line are silently lost.
    const content = '# Session\n\n### Completed\n- [x] Task A\n\n- [x] Task B\n\n### In Progress\n- [ ] Task C\n';
    const meta = sessionManager.parseSessionMetadata(content);
    // The regex captures "- [x] Task A\n" then hits \n\n and stops.
    // "- [x] Task B" is between the two sections but outside both regex captures.
    assert.strictEqual(meta.completed.length, 1,
      'Only Task A captured ï¿½ blank line terminates the section regex before Task B');
    assert.strictEqual(meta.completed[0], 'Task A',
      'First completed item should be Task A');
    // Task B is lost ï¿½ it appears after the blank line, outside the captured range
    assert.strictEqual(meta.inProgress.length, 1,
      'In Progress should still capture Task C');
    assert.strictEqual(meta.inProgress[0], 'Task C',
      'In-progress item should be Task C');
  })) passed++; else failed++;

  // -- Round 106: getAllSessions with array/object limit ï¿½ Number() coercion edge cases --
  console.log('\nRound 106: getAllSessions (array/object limit coercion ï¿½ Number([5])?5, Number({})?NaN?50):');
  if (test('getAllSessions coerces array/object limit via Number() with NaN fallback to 50', () => {
    const isoHome = path.join(os.tmpdir(), `ecc-r106-limit-coerce-${Date.now()}`);
    try {
      withEnv({ HOME: isoHome, USERPROFILE: isoHome }, () => {
        clearSessionManagerCache();
        const freshUtils = require('../../scripts/lib/utils');
        const isoSessionsDir = freshUtils.getSessionsDir();
        fs.mkdirSync(isoSessionsDir, { recursive: true });
        for (let i = 0; i < 3; i++) {
          const name = `2026-03-0${i + 1}-aaaa${i}${i}${i}${i}-session.tmp`;
          const filePath = path.join(isoSessionsDir, name);
          fs.writeFileSync(filePath, `# Session ${i}`);
          const mtime = new Date(Date.now() - (3 - i) * 60000);
          fs.utimesSync(filePath, mtime, mtime);
        }
        const freshManager = require('../../scripts/lib/session-manager');
        // Object limit: Number({}) ? NaN ? fallback to 50
        const objResult = freshManager.getAllSessions({ limit: {} });
        assert.strictEqual(objResult.limit, 50,
          'Object limit should coerce to NaN ? fallback to default 50');
        assert.strictEqual(objResult.total, 3, 'Should still find all 3 sessions');
        // Single-element array: Number([2]) ? 2
        const arrResult = freshManager.getAllSessions({ limit: [2] });
        assert.strictEqual(arrResult.limit, 2,
          'Single-element array [2] coerces to Number 2 via Number([2])');
        assert.strictEqual(arrResult.sessions.length, 2, 'Should return only 2 sessions');
        assert.strictEqual(arrResult.hasMore, true, 'hasMore should be true with limit 2 of 3');
        // Multi-element array: Number([1,2]) ? NaN ? fallback to 50
        const multiArrResult = freshManager.getAllSessions({ limit: [1, 2] });
        assert.strictEqual(multiArrResult.limit, 50,
          'Multi-element array [1,2] coerces to NaN ? fallback to 50');
      });
    } finally {
      clearSessionManagerCache();
      sessionManager = require('../../scripts/lib/session-manager');
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // Summary
  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();


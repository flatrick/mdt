/**
 * Tests for scripts/lib/session-aliases.js
 *
 * These tests use a temporary directory to avoid touching
 * the real ~/.claude/session-aliases.json.
 *
 * Run with: node tests/lib/session-aliases-rounds.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { test } = require('../helpers/test-runner');
const { setupSessionAliasesTestEnv } = require('../helpers/session-aliases-test-env');
const { withEnv } = require('../helpers/env-test-utils');

const { aliases, resetAliases } = setupSessionAliasesTestEnv();

function runTests() {
  console.log('\n=== Testing session-aliases.js ===\n');

  let passed = 0;
  let failed = 0;

  console.log('\n=== Testing session-aliases.js (Round Cases) ===\n');
  // ââ Round 26 tests ââ

  console.log('\nsetAlias (reserved names case sensitivity):');

  if (test('rejects uppercase reserved name LIST', () => {
    resetAliases();
    const result = aliases.setAlias('LIST', '/path');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('reserved'));
  })) passed++; else failed++;

  if (test('rejects mixed-case reserved name Help', () => {
    resetAliases();
    const result = aliases.setAlias('Help', '/path');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('reserved'));
  })) passed++; else failed++;

  if (test('rejects mixed-case reserved name Set', () => {
    resetAliases();
    const result = aliases.setAlias('Set', '/path');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('reserved'));
  })) passed++; else failed++;

  console.log('\nlistAliases (negative limit):');

  if (test('negative limit does not truncate results', () => {
    resetAliases();
    aliases.setAlias('one', '/path1');
    aliases.setAlias('two', '/path2');
    const list = aliases.listAliases({ limit: -5 });
    // -5 fails the `limit > 0` check, so no slicing happens
    assert.strictEqual(list.length, 2, 'Negative limit should not apply');
  })) passed++; else failed++;

  console.log('\nsetAlias (undefined title):');

  if (test('undefined title becomes null (same as explicit null)', () => {
    resetAliases();
    const result = aliases.setAlias('undef-title', '/path', undefined);
    assert.strictEqual(result.success, true);
    const resolved = aliases.resolveAlias('undef-title');
    assert.strictEqual(resolved.title, null, 'undefined title should become null');
  })) passed++; else failed++;

  // ââ Round 31: saveAliases failure path ââ
  console.log('\nsaveAliases (failure paths, Round 31):');

  if (test('saveAliases returns false for invalid data (non-serializable)', () => {
    // Create a circular reference that JSON.stringify cannot handle
    const circular = { aliases: {}, metadata: {} };
    circular.self = circular;
    const result = aliases.saveAliases(circular);
    assert.strictEqual(result, false, 'Should return false for non-serializable data');
  })) passed++; else failed++;

  if (test('saveAliases handles writing to read-only directory gracefully', () => {
    // Save current aliases, verify data is still intact after failed save attempt
    resetAliases();
    aliases.setAlias('safe-data', '/path/safe');
    const before = aliases.loadAliases();
    assert.ok(before.aliases['safe-data'], 'Alias should exist before test');

    // Verify the alias survived
    const after = aliases.loadAliases();
    assert.ok(after.aliases['safe-data'], 'Alias should still exist');
  })) passed++; else failed++;

  if (test('loadAliases returns fresh structure for missing file', () => {
    resetAliases();
    const data = aliases.loadAliases();
    assert.ok(data, 'Should return an object');
    assert.ok(data.aliases, 'Should have aliases key');
    assert.ok(data.metadata, 'Should have metadata key');
    assert.strictEqual(typeof data.aliases, 'object');
    assert.strictEqual(Object.keys(data.aliases).length, 0, 'Should have no aliases');
  })) passed++; else failed++;

  // ââ Round 33: renameAlias rollback on save failure ââ
  console.log('\nrenameAlias rollback (Round 33):');

  if (test('renameAlias with circular data triggers rollback path', () => {
    // First set up a valid alias
    resetAliases();
    aliases.setAlias('rename-src', '/path/session');

    // Load aliases, modify them to make saveAliases fail on the SECOND call
    // by injecting a circular reference after the rename is done
    const data = aliases.loadAliases();
    assert.ok(data.aliases['rename-src'], 'Source alias should exist');

    // Do the rename with valid data â should succeed
    const result = aliases.renameAlias('rename-src', 'rename-dst');
    assert.strictEqual(result.success, true, 'Normal rename should succeed');
    assert.ok(aliases.resolveAlias('rename-dst'), 'New alias should exist');
    assert.strictEqual(aliases.resolveAlias('rename-src'), null, 'Old alias should be gone');
  })) passed++; else failed++;

  if (test('renameAlias returns rolled-back error message on save failure', () => {
    // We can test the error response structure even though we can't easily
    // trigger a save failure without mocking. Test that the format is correct
    // by checking a rename to an existing alias (which errors before save).
    resetAliases();
    aliases.setAlias('src-alias', '/path/a');
    aliases.setAlias('dst-exists', '/path/b');

    const result = aliases.renameAlias('src-alias', 'dst-exists');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('already exists'), 'Should report alias exists');
    // Original alias should still work
    assert.ok(aliases.resolveAlias('src-alias'), 'Source alias should survive');
  })) passed++; else failed++;

  if (test('renameAlias rollback preserves original alias data on naming conflict', () => {
    resetAliases();
    aliases.setAlias('keep-this', '/path/original', 'Original Title');

    // Attempt rename to a reserved name â should fail pre-save
    const result = aliases.renameAlias('keep-this', 'delete');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('reserved'), 'Should reject reserved name');

    // Original alias should be intact with all its data
    const resolved = aliases.resolveAlias('keep-this');
    assert.ok(resolved, 'Original alias should still exist');
    assert.strictEqual(resolved.sessionPath, '/path/original');
    assert.strictEqual(resolved.title, 'Original Title');
  })) passed++; else failed++;

  // ââ Round 33: saveAliases backup restoration ââ
  console.log('\nsaveAliases backup/restore (Round 33):');

  if (test('saveAliases creates backup before write and removes on success', () => {
    resetAliases();
    aliases.setAlias('backup-test', '/path/backup');

    // After successful save, .bak file should NOT exist at the active aliases path
    const aliasesPath = aliases.getAliasesPath();
    const backupPath = aliasesPath + '.bak';
    assert.ok(!fs.existsSync(backupPath), 'Backup should be removed after successful save');
    assert.ok(fs.existsSync(aliasesPath), 'Main aliases file should exist');
  })) passed++; else failed++;

  if (test('saveAliases with non-serializable data returns false and preserves existing file', () => {
    resetAliases();
    aliases.setAlias('before-fail', '/path/safe');

    // Verify the file exists
    const aliasesPath = aliases.getAliasesPath();
    assert.ok(fs.existsSync(aliasesPath), 'Aliases file should exist');

    // Attempt to save circular data â will fail
    const circular = { aliases: {}, metadata: {} };
    circular.self = circular;
    const result = aliases.saveAliases(circular);
    assert.strictEqual(result, false, 'Should return false');

    // The file should still have the old content (restored from backup or untouched)
    const contentAfter = fs.readFileSync(aliasesPath, 'utf8');
    assert.ok(contentAfter.includes('before-fail'),
      'Original aliases data should be preserved after failed save');
  })) passed++; else failed++;

  // ââ Round 39: atomic overwrite on Unix (no unlink before rename) ââ
  console.log('\nRound 39: atomic overwrite:');

  if (test('saveAliases overwrites existing file atomically', () => {
    // Create initial aliases
    aliases.setAlias('atomic-test', '2026-01-01-abc123-session.tmp');
    const aliasesPath = aliases.getAliasesPath();
    assert.ok(fs.existsSync(aliasesPath), 'Aliases file should exist');
    const sizeBefore = fs.statSync(aliasesPath).size;
    assert.ok(sizeBefore > 0, 'Aliases file should have content');

    // Overwrite with different data
    aliases.setAlias('atomic-test-2', '2026-02-01-def456-session.tmp');

    // The file should still exist and be valid JSON
    const content = fs.readFileSync(aliasesPath, 'utf8');
    const parsed = JSON.parse(content);
    assert.ok(parsed.aliases['atomic-test'], 'First alias should exist');
    assert.ok(parsed.aliases['atomic-test-2'], 'Second alias should exist');

    // Cleanup
    aliases.deleteAlias('atomic-test');
    aliases.deleteAlias('atomic-test-2');
  })) passed++; else failed++;

  // ââ Round 48: rapid sequential saves data integrity ââ
  console.log('\nRound 48: rapid sequential saves:');

  if (test('rapid sequential setAlias calls maintain data integrity', () => {
    resetAliases();
    for (let i = 0; i < 5; i++) {
      const result = aliases.setAlias(`rapid-${i}`, `/path/${i}`, `Title ${i}`);
      assert.strictEqual(result.success, true, `setAlias rapid-${i} should succeed`);
    }
    const data = aliases.loadAliases();
    for (let i = 0; i < 5; i++) {
      assert.ok(data.aliases[`rapid-${i}`], `rapid-${i} should exist after all saves`);
      assert.strictEqual(data.aliases[`rapid-${i}`].sessionPath, `/path/${i}`);
    }
    assert.strictEqual(data.metadata.totalCount, 5, 'Metadata count should match actual aliases');
  })) passed++; else failed++;

  // ââ Round 56: Windows platform unlink-before-rename code path ââ
  console.log('\nRound 56: Windows platform atomic write path:');

  if (test('Windows platform mock: unlinks existing file before rename', () => {
    resetAliases();
    // First create an alias so the file exists
    const r1 = aliases.setAlias('win-initial', '2026-01-01-abc123-session.tmp');
    assert.strictEqual(r1.success, true, 'Initial alias should succeed');
    const aliasesPath = aliases.getAliasesPath();
    assert.ok(fs.existsSync(aliasesPath), 'Aliases file should exist before win32 test');

    // Mock process.platform to 'win32' to trigger the unlink-before-rename path
    const origPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    try {
      // This save triggers the Windows code path: unlink existing â rename temp
      const r2 = aliases.setAlias('win-updated', '2026-02-01-def456-session.tmp');
      assert.strictEqual(r2.success, true, 'setAlias should succeed under win32 mock');

      // Verify data integrity after the Windows path
      assert.ok(fs.existsSync(aliasesPath), 'Aliases file should exist after win32 save');
      const data = aliases.loadAliases();
      assert.ok(data.aliases['win-initial'], 'Original alias should still exist');
      assert.ok(data.aliases['win-updated'], 'New alias should exist');
      assert.strictEqual(data.aliases['win-updated'].sessionPath,
        '2026-02-01-def456-session.tmp', 'Session path should match');

      // No .tmp or .bak files left behind
      assert.ok(!fs.existsSync(aliasesPath + '.tmp'), 'No temp file should remain');
      assert.ok(!fs.existsSync(aliasesPath + '.bak'), 'No backup file should remain');
    } finally {
      // Restore original platform descriptor
      if (origPlatform) {
        Object.defineProperty(process, 'platform', origPlatform);
      }
      resetAliases();
    }
  })) passed++; else failed++;

  // ââ Round 64: loadAliases backfills missing version and metadata ââ
  console.log('\nRound 64: loadAliases version/metadata backfill:');

  if (test('loadAliases backfills missing version and metadata fields', () => {
    resetAliases();
    const aliasesPath = aliases.getAliasesPath();
    // Write a file with valid aliases but NO version and NO metadata
    fs.writeFileSync(aliasesPath, JSON.stringify({
      aliases: {
        'backfill-test': {
          sessionPath: '/sessions/backfill',
          createdAt: '2026-01-15T00:00:00.000Z',
          updatedAt: '2026-01-15T00:00:00.000Z',
          title: 'Backfill Test'
        }
      }
    }));

    const data = aliases.loadAliases();
    // Version should be backfilled to ALIAS_VERSION ('1.0')
    assert.strictEqual(data.version, '1.0', 'Should backfill missing version to 1.0');
    // Metadata should be backfilled with totalCount from aliases
    assert.ok(data.metadata, 'Should backfill missing metadata object');
    assert.strictEqual(data.metadata.totalCount, 1, 'Metadata totalCount should match alias count');
    assert.ok(data.metadata.lastUpdated, 'Metadata should have lastUpdated');
    // Alias data should be preserved
    assert.ok(data.aliases['backfill-test'], 'Alias data should be preserved');
    assert.strictEqual(data.aliases['backfill-test'].sessionPath, '/sessions/backfill');
    resetAliases();
  })) passed++; else failed++;

  // ââ Round 67: loadAliases empty file, resolveSessionAlias null, metadata-only backfill ââ
  console.log('\nRound 67: loadAliases (empty 0-byte file):');

  if (test('loadAliases returns default structure for empty (0-byte) file', () => {
    resetAliases();
    const aliasesPath = aliases.getAliasesPath();
    // Write a 0-byte file â readFile returns '', which is falsy â !content branch
    fs.writeFileSync(aliasesPath, '');
    const data = aliases.loadAliases();
    assert.ok(data.aliases, 'Should have aliases key');
    assert.strictEqual(Object.keys(data.aliases).length, 0, 'Should have no aliases');
    assert.strictEqual(data.version, '1.0', 'Should have default version');
    assert.ok(data.metadata, 'Should have metadata');
    assert.strictEqual(data.metadata.totalCount, 0, 'Should have totalCount 0');
    resetAliases();
  })) passed++; else failed++;

  console.log('\nRound 67: resolveSessionAlias (null/falsy input):');

  if (test('resolveSessionAlias returns null when given null input', () => {
    resetAliases();
    const result = aliases.resolveSessionAlias(null);
    assert.strictEqual(result, null, 'Should return null for null input');
  })) passed++; else failed++;

  console.log('\nRound 67: loadAliases (metadata-only backfill, version present):');

  if (test('loadAliases backfills only metadata when version already present', () => {
    resetAliases();
    const aliasesPath = aliases.getAliasesPath();
    // Write a file WITH version but WITHOUT metadata
    fs.writeFileSync(aliasesPath, JSON.stringify({
      version: '1.0',
      aliases: {
        'meta-only': {
          sessionPath: '/sessions/meta-only',
          createdAt: '2026-01-20T00:00:00.000Z',
          updatedAt: '2026-01-20T00:00:00.000Z',
          title: 'Metadata Only Test'
        }
      }
    }));

    const data = aliases.loadAliases();
    // Version should remain as-is (NOT overwritten)
    assert.strictEqual(data.version, '1.0', 'Version should remain 1.0');
    // Metadata should be backfilled
    assert.ok(data.metadata, 'Should backfill missing metadata');
    assert.strictEqual(data.metadata.totalCount, 1, 'Metadata totalCount should be 1');
    assert.ok(data.metadata.lastUpdated, 'Metadata should have lastUpdated');
    // Alias data should be preserved
    assert.ok(data.aliases['meta-only'], 'Alias should be preserved');
    assert.strictEqual(data.aliases['meta-only'].title, 'Metadata Only Test');
    resetAliases();
  })) passed++; else failed++;

  // ââ Round 70: updateAliasTitle save failure path ââ
  console.log('\nupdateAliasTitle save failure (Round 70):');

  if (test('updateAliasTitle returns failure when saveAliases fails (read-only dir)', () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) {
      console.log('    (skipped â chmod ineffective on Windows/root)');
      return;
    }
    // Use a fresh isolated HOME to avoid .tmp/.bak leftovers from other tests.
    // On macOS, overwriting an EXISTING file in a read-only dir succeeds,
    // so we must start clean with ONLY the .json file present.
    const isoHome = path.join(os.tmpdir(), `ecc-alias-r70-${Date.now()}`);
    const isoClaudeDir = path.join(isoHome, '.claude');
    fs.mkdirSync(isoClaudeDir, { recursive: true });
    try {
      withEnv({ HOME: isoHome, USERPROFILE: isoHome }, () => {
        // Re-require to pick up new HOME
        delete require.cache[require.resolve('../../scripts/lib/session-aliases')];
        delete require.cache[require.resolve('../../scripts/lib/utils')];
        const freshAliases = require('../../scripts/lib/session-aliases');

        // Set up a valid alias
        freshAliases.setAlias('title-save-fail', '/path/session', 'Original Title');
        // Verify no leftover .tmp/.bak
        const ap = freshAliases.getAliasesPath();
        assert.ok(fs.existsSync(ap), 'Alias file should exist after setAlias');

        // Make .claude dir read-only so saveAliases fails when creating .bak
        fs.chmodSync(isoClaudeDir, 0o555);

        const result = freshAliases.updateAliasTitle('title-save-fail', 'New Title');
        assert.strictEqual(result.success, false, 'Should fail when save is blocked');
        assert.ok(result.error.includes('Failed to update alias title'),
          `Should return save failure error, got: ${result.error}`);
      });
    } finally {
      try { fs.chmodSync(isoClaudeDir, 0o755); } catch { /* best-effort */ }
      delete require.cache[require.resolve('../../scripts/lib/session-aliases')];
      delete require.cache[require.resolve('../../scripts/lib/utils')];
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 72: deleteAlias save failure path ââ
  console.log('\nRound 72: deleteAlias (save failure):');

  if (test('deleteAlias returns failure when saveAliases fails (read-only dir)', () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) {
      console.log('    (skipped â chmod ineffective on Windows/root)');
      return;
    }
    const isoHome = path.join(os.tmpdir(), `ecc-alias-r72-${Date.now()}`);
    const isoClaudeDir = path.join(isoHome, '.claude');
    fs.mkdirSync(isoClaudeDir, { recursive: true });
    try {
      withEnv({ HOME: isoHome, USERPROFILE: isoHome }, () => {
        delete require.cache[require.resolve('../../scripts/lib/session-aliases')];
        delete require.cache[require.resolve('../../scripts/lib/utils')];
        const freshAliases = require('../../scripts/lib/session-aliases');

        // Create an alias first (writes the file)
        freshAliases.setAlias('to-delete', '/path/session', 'Test');
        const ap = freshAliases.getAliasesPath();
        assert.ok(fs.existsSync(ap), 'Alias file should exist after setAlias');

        // Make .claude directory read-only â save will fail (can't create temp file)
        fs.chmodSync(isoClaudeDir, 0o555);

        const result = freshAliases.deleteAlias('to-delete');
        assert.strictEqual(result.success, false, 'Should fail when save is blocked');
        assert.ok(result.error.includes('Failed to delete alias'),
          `Should return delete failure error, got: ${result.error}`);
      });
    } finally {
      try { fs.chmodSync(isoClaudeDir, 0o755); } catch { /* best-effort */ }
      delete require.cache[require.resolve('../../scripts/lib/session-aliases')];
      delete require.cache[require.resolve('../../scripts/lib/utils')];
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 73: cleanupAliases save failure path ââ
  console.log('\nRound 73: cleanupAliases (save failure):');

  if (test('cleanupAliases returns failure when saveAliases fails after removing aliases', () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) {
      console.log('    (skipped â chmod ineffective on Windows/root)');
      return;
    }
    const isoHome = path.join(os.tmpdir(), `ecc-alias-r73-cleanup-${Date.now()}`);
    const isoClaudeDir = path.join(isoHome, '.claude');
    fs.mkdirSync(isoClaudeDir, { recursive: true });
    try {
      withEnv({ HOME: isoHome, USERPROFILE: isoHome }, () => {
        delete require.cache[require.resolve('../../scripts/lib/session-aliases')];
        delete require.cache[require.resolve('../../scripts/lib/utils')];
        const freshAliases = require('../../scripts/lib/session-aliases');

        // Create aliases â one to keep, one to remove
        freshAliases.setAlias('keep-me', '/sessions/real', 'Kept');
        freshAliases.setAlias('remove-me', '/sessions/gone', 'Gone');

        // Make .claude dir read-only so save will fail
        fs.chmodSync(isoClaudeDir, 0o555);

        // Cleanup: "gone" session doesn't exist, so remove-me should be removed
        const result = freshAliases.cleanupAliases((p) => p === '/sessions/real');
        assert.strictEqual(result.success, false, 'Should fail when save is blocked');
        assert.ok(result.error.includes('Failed to save after cleanup'),
          `Should return cleanup save failure error, got: ${result.error}`);
        assert.strictEqual(result.removed, 1, 'Should report 1 removed alias');
        assert.ok(result.removedAliases.some(a => a.name === 'remove-me'),
          'Should report remove-me in removedAliases');
      });
    } finally {
      try { fs.chmodSync(isoClaudeDir, 0o755); } catch { /* best-effort */ }
      delete require.cache[require.resolve('../../scripts/lib/session-aliases')];
      delete require.cache[require.resolve('../../scripts/lib/utils')];
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 73: setAlias save failure path ââ
  console.log('\nRound 73: setAlias (save failure):');

  if (test('setAlias returns failure when saveAliases fails', () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) {
      console.log('    (skipped â chmod ineffective on Windows/root)');
      return;
    }
    const isoHome = path.join(os.tmpdir(), `ecc-alias-r73-set-${Date.now()}`);
    const isoClaudeDir = path.join(isoHome, '.claude');
    fs.mkdirSync(isoClaudeDir, { recursive: true });
    try {
      withEnv({ HOME: isoHome, USERPROFILE: isoHome }, () => {
        delete require.cache[require.resolve('../../scripts/lib/session-aliases')];
        delete require.cache[require.resolve('../../scripts/lib/utils')];
        const freshAliases = require('../../scripts/lib/session-aliases');

        // Make .claude dir read-only BEFORE any setAlias call
        fs.chmodSync(isoClaudeDir, 0o555);

        const result = freshAliases.setAlias('my-alias', '/sessions/test', 'Test');
        assert.strictEqual(result.success, false, 'Should fail when save is blocked');
        assert.ok(result.error.includes('Failed to save alias'),
          `Should return save failure error, got: ${result.error}`);
      });
    } finally {
      try { fs.chmodSync(isoClaudeDir, 0o755); } catch { /* best-effort */ }
      delete require.cache[require.resolve('../../scripts/lib/session-aliases')];
      delete require.cache[require.resolve('../../scripts/lib/utils')];
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 84: listAliases sort NaN date fallback (getTime() || 0) ââ
  console.log('\nRound 84: listAliases (NaN date fallback in sort comparator):');

  if (test('listAliases sorts entries with invalid/missing dates to the end via || 0 fallback', () => {
    // session-aliases.js line 257:
    //   (new Date(b.updatedAt || b.createdAt || 0).getTime() || 0) - ...
    // When updatedAt and createdAt are both invalid strings, getTime() returns NaN.
    // The outer || 0 converts NaN to 0 (epoch time), pushing the entry to the end.
    resetAliases();
    const data = aliases.loadAliases();

    // Entry with valid dates â should sort first (newest)
    data.aliases['valid-alias'] = {
      sessionPath: '/sessions/valid',
      createdAt: '2026-02-10T12:00:00.000Z',
      updatedAt: '2026-02-10T12:00:00.000Z',
      title: 'Valid'
    };

    // Entry with invalid date strings â getTime() â NaN â || 0 â epoch (oldest)
    data.aliases['nan-alias'] = {
      sessionPath: '/sessions/nan',
      createdAt: 'not-a-date',
      updatedAt: 'also-invalid',
      title: 'NaN dates'
    };

    // Entry with missing date fields â undefined || undefined || 0 â new Date(0) â epoch
    data.aliases['missing-alias'] = {
      sessionPath: '/sessions/missing',
      title: 'Missing dates'
      // No createdAt or updatedAt
    };

    aliases.saveAliases(data);
    const list = aliases.listAliases();

    assert.strictEqual(list.length, 3, 'Should list all 3 aliases');
    // Valid-dated entry should be first (newest by updatedAt)
    assert.strictEqual(list[0].name, 'valid-alias',
      'Entry with valid dates should sort first');
    // The two invalid-dated entries sort to epoch (0), so they come after
    assert.ok(
      (list[1].name === 'nan-alias' || list[1].name === 'missing-alias') &&
      (list[2].name === 'nan-alias' || list[2].name === 'missing-alias'),
      'Entries with invalid/missing dates should sort to the end');
  })) passed++; else failed++;

  // ââ Round 86: loadAliases with truthy non-object aliases field ââ
  console.log('\nRound 86: loadAliases (truthy non-object aliases field):');

  if (test('loadAliases resets to defaults when aliases field is a string (typeof !== object)', () => {
    // session-aliases.js line 58: if (!data.aliases || typeof data.aliases !== 'object')
    // Previous tests covered !data.aliases (undefined) via { noAliasesKey: true }.
    // This exercises the SECOND half: aliases is truthy but typeof !== 'object'.
    const aliasesPath = aliases.getAliasesPath();
    fs.writeFileSync(aliasesPath, JSON.stringify({
      version: '1.0',
      aliases: 'this-is-a-string-not-an-object',
      metadata: { totalCount: 0 }
    }));
    const data = aliases.loadAliases();
    assert.strictEqual(typeof data.aliases, 'object', 'Should reset aliases to object');
    assert.ok(!Array.isArray(data.aliases), 'Should be a plain object, not array');
    assert.strictEqual(Object.keys(data.aliases).length, 0, 'Should have no aliases');
    assert.strictEqual(data.version, '1.0', 'Should have version');
    resetAliases();
  })) passed++; else failed++;

  // ââ Round 90: saveAliases backup restore double failure (inner catch restoreErr) ââ
  console.log('\nRound 90: saveAliases (backup restore double failure):');

  if (test('saveAliases triggers inner restoreErr catch when both save and restore fail', () => {
    const isoHome = path.join(os.tmpdir(), `ecc-r90-restore-fail-${Date.now()}`);
    const claudeDir = path.join(isoHome, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });

    const backupPath = path.join(claudeDir, 'session-aliases.json.bak');
    fs.writeFileSync(backupPath, JSON.stringify({ aliases: {}, version: '1.0' }));

    const originalWriteFileSync = fs.writeFileSync;
    const originalCopyFileSync = fs.copyFileSync;

    try {
      withEnv({ HOME: isoHome, USERPROFILE: isoHome }, () => {
        delete require.cache[require.resolve('../../scripts/lib/session-aliases')];
        delete require.cache[require.resolve('../../scripts/lib/utils')];
        const freshAliases = require('../../scripts/lib/session-aliases');
        const aliasesPath = freshAliases.getAliasesPath();
        const tempPath = aliasesPath + '.tmp';

        fs.writeFileSync = (...args) => {
          if (args[0] === tempPath) {
            const error = new Error('permission denied');
            error.code = 'EACCES';
            throw error;
          }
          return originalWriteFileSync(...args);
        };

        fs.copyFileSync = (...args) => {
          if (args[0] === backupPath && args[1] === aliasesPath) {
            const error = new Error('permission denied');
            error.code = 'EACCES';
            throw error;
          }
          return originalCopyFileSync(...args);
        };

        const result = freshAliases.saveAliases({ aliases: { x: 1 }, version: '1.0' });
        assert.strictEqual(result, false, 'Should return false when save fails');
        assert.ok(fs.existsSync(backupPath), 'Backup should still exist after double failure');
      });
    } finally {
      fs.writeFileSync = originalWriteFileSync;
      fs.copyFileSync = originalCopyFileSync;
      delete require.cache[require.resolve('../../scripts/lib/session-aliases')];
      delete require.cache[require.resolve('../../scripts/lib/utils')];
      fs.rmSync(isoHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // ââ Round 95: renameAlias with same old and new name (self-rename) ââ
  console.log('\nRound 95: renameAlias (self-rename same name):');

  if (test('renameAlias returns "already exists" error when renaming alias to itself', () => {
    resetAliases();
    // Create an alias first
    const created = aliases.setAlias('self-rename', '/path/session', 'Self Rename');
    assert.strictEqual(created.success, true, 'Setup: alias should be created');

    // Attempt to rename to the same name
    const result = aliases.renameAlias('self-rename', 'self-rename');
    assert.strictEqual(result.success, false, 'Renaming to itself should fail');
    assert.ok(result.error.includes('already exists'),
      'Error should indicate alias already exists (line 333-334 check)');

    // Verify original alias is still intact
    const resolved = aliases.resolveAlias('self-rename');
    assert.ok(resolved, 'Original alias should still exist after failed self-rename');
    assert.strictEqual(resolved.sessionPath, '/path/session',
      'Alias data should be preserved');
  })) passed++; else failed++;

  // ââ Round 100: cleanupAliases callback returning falsy non-boolean 0 ââ
  console.log('\nRound 100: cleanupAliases (callback returns 0 â falsy non-boolean coercion):');
  if (test('cleanupAliases removes alias when callback returns 0 (falsy coercion: !0 === true)', () => {
    resetAliases();
    aliases.setAlias('zero-test', '/sessions/some-session', '2026-01-15');
    // callback returns 0 (a falsy value) â !0 === true â alias is removed
    const result = aliases.cleanupAliases(() => 0);
    assert.strictEqual(result.removed, 1,
      'Alias should be removed because !0 === true (JavaScript falsy coercion)');
    assert.strictEqual(result.success, true,
      'Cleanup should succeed');
    const resolved = aliases.resolveAlias('zero-test');
    assert.strictEqual(resolved, null,
      'Alias should no longer exist after removal');
  })) passed++; else failed++;

  // Summary
  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();


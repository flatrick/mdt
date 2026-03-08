/**
 * Tests for scripts/lib/session-aliases.js
 *
 * These tests use a temporary directory to avoid touching
 * the real active config dir's session-aliases.json.
 *
 * Run with: node tests/lib/session-aliases-rounds-2.test.js
 */

const assert = require('assert');
const fs = require('fs');
const { test } = require('../helpers/test-runner');
const { setupSessionAliasesTestEnv } = require('../helpers/session-aliases-test-env');

const { aliases, resetAliases } = setupSessionAliasesTestEnv();

function runTests() {
  console.log('\n=== Testing session-aliases.js ===\n');

  let passed = 0;
  let failed = 0;

  // ââ Round 102: setAlias with title=0 (falsy number coercion) ââ
  console.log('\nRound 102: setAlias (title=0 â falsy coercion silently converts to null):');
  if (test('setAlias with title=0 stores null (0 || null === null due to JavaScript falsy coercion)', () => {
    // session-aliases.js line 221: `title: title || null` â the value 0 is falsy
    // in JavaScript, so `0 || null` evaluates to `null`.  This means numeric
    // titles like 0 are silently discarded.
    resetAliases();
    const result = aliases.setAlias('zero-title', '/sessions/test', 0);
    assert.strictEqual(result.success, true,
      'setAlias should succeed (0 is valid as a truthy check bypass)');
    assert.strictEqual(result.title, null,
      'Title should be null because 0 || null === null (falsy coercion)');
    const resolved = aliases.resolveAlias('zero-title');
    assert.strictEqual(resolved.title, null,
      'Persisted title should be null after round-trip through saveAliases/loadAliases');
  })) passed++; else failed++;

  // ââ Round 103: loadAliases with array aliases in JSON should reset to default ââ
  console.log('\nRound 103: loadAliases (array aliases are rejected and reset):');
  if (test('loadAliases rejects array aliases and resets to default empty object map', () => {
    resetAliases();
    const aliasesPath = aliases.getAliasesPath();
    fs.writeFileSync(aliasesPath, JSON.stringify({
      version: '1.0',
      aliases: ['item0', 'item1', 'item2'],
      metadata: { totalCount: 3, lastUpdated: new Date().toISOString() }
    }));
    const data = aliases.loadAliases();
    assert.ok(!Array.isArray(data.aliases), 'aliases should be reset to object map');
    assert.deepStrictEqual(data.aliases, {}, 'aliases map should be reset to empty object');
  })) passed++; else failed++;

  // ââ Round 104: resolveSessionAlias with path-traversal input (now returns null instead of passthrough) ââ
  console.log('\nRound 104: resolveSessionAlias (path-traversal input â now rejected with null):');
  if (test('resolveSessionAlias returns null for path-traversal input when alias lookup fails', () => {
    // session-aliases.js lines 365-374 previously returned aliasOrId unchanged.
    // After hardening, path-traversal-looking inputs that are not aliases should
    // not be passed through; they should result in null so callers can handle safely.
    resetAliases();
    const traversal = '../etc/passwd';
    const result = aliases.resolveSessionAlias(traversal);
    assert.strictEqual(result, null,
      'Path-traversal input should now return null instead of being passed through');
    // Also test with another invalid alias pattern
    const dotSlash = './../../secrets';
    const result2 = aliases.resolveSessionAlias(dotSlash);
    assert.strictEqual(result2, null,
      'Another path-traversal pattern should also return null');
  })) passed++; else failed++;

  // ââ Round 107: setAlias with whitespace-only title (not trimmed unlike sessionPath) ââ
  console.log('\nRound 107: setAlias (whitespace-only title â truthy string stored as-is, unlike sessionPath which is trim-checked):');
  if (test('setAlias stores whitespace-only title as-is (no trim validation, unlike sessionPath)', () => {
    resetAliases();
    // sessionPath with whitespace is rejected (line 195: sessionPath.trim().length === 0)
    const pathResult = aliases.setAlias('ws-path', '   ');
    assert.strictEqual(pathResult.success, false,
      'Whitespace-only sessionPath is rejected by trim check');
    // But title with whitespace is stored as-is (line 221: title || null â whitespace is truthy)
    const titleResult = aliases.setAlias('ws-title', '/valid/path', '   ');
    assert.strictEqual(titleResult.success, true,
      'Whitespace-only title is accepted (no trim check on title)');
    assert.strictEqual(titleResult.title, '   ',
      'Title stored as whitespace string (truthy, so title || null returns the whitespace)');
    // Verify persisted correctly
    const loaded = aliases.loadAliases();
    assert.strictEqual(loaded.aliases['ws-title'].title, '   ',
      'Whitespace title persists in JSON as-is');
  })) passed++; else failed++;

  // ââ Round 111: setAlias with exactly 128-character alias â off-by-one boundary ââ
  console.log('\nRound 111: setAlias (128-char alias â exact boundary of > 128 check):');
  if (test('setAlias accepts alias of exactly 128 characters (128 is NOT > 128)', () => {
    // session-aliases.js line 199: if (alias.length > 128)
    // 128 is NOT > 128, so exactly 128 chars is ACCEPTED.
    // Existing test only checks 129 (rejected).
    resetAliases();
    const alias128 = 'a'.repeat(128);
    const result = aliases.setAlias(alias128, '/path/to/session');
    assert.strictEqual(result.success, true,
      '128-char alias should be accepted (128 is NOT > 128)');
    assert.strictEqual(result.isNew, true);
    // Verify it can be resolved
    const resolved = aliases.resolveAlias(alias128);
    assert.notStrictEqual(resolved, null, '128-char alias should be resolvable');
    assert.strictEqual(resolved.sessionPath, '/path/to/session');
    // Confirm 129 is rejected (boundary)
    const result129 = aliases.setAlias('b'.repeat(129), '/path');
    assert.strictEqual(result129.success, false, '129-char alias should be rejected');
    assert.ok(result129.error.includes('128'),
      'Error message should mention 128-char limit');
  })) passed++; else failed++;

  // ââ Round 112: resolveAlias rejects Unicode characters in alias name ââ
  console.log('\nRound 112: resolveAlias (Unicode rejection):');
  if (test('resolveAlias returns null for alias names containing Unicode characters', () => {
    resetAliases();
    // First create a valid alias to ensure the store works
    aliases.setAlias('valid-alias', '/path/to/session');
    const validResult = aliases.resolveAlias('valid-alias');
    assert.notStrictEqual(validResult, null, 'Valid ASCII alias should resolve');

    // Unicode accented characters â rejected by /^[a-zA-Z0-9_-]+$/
    const accentedResult = aliases.resolveAlias('cafÃ©-session');
    assert.strictEqual(accentedResult, null,
      'Accented character "Ã©" should be rejected by [a-zA-Z0-9_-]');

    const umlautResult = aliases.resolveAlias('Ã¼ber-test');
    assert.strictEqual(umlautResult, null,
      'Umlaut "Ã¼" should be rejected by [a-zA-Z0-9_-]');

    // CJK characters
    const cjkResult = aliases.resolveAlias('ä¼è­°-notes');
    assert.strictEqual(cjkResult, null,
      'CJK characters should be rejected');

    // Emoji
    const emojiResult = aliases.resolveAlias('rocket-ð');
    assert.strictEqual(emojiResult, null,
      'Emoji should be rejected by the ASCII-only regex');

    // Cyrillic characters that look like Latin (homoglyphs)
    const cyrillicResult = aliases.resolveAlias('tÐµst'); // 'Ðµ' is Cyrillic U+0435
    assert.strictEqual(cyrillicResult, null,
      'Cyrillic homoglyph "Ðµ" (U+0435) should be rejected even though it looks like "e"');
  })) passed++; else failed++;

  // ââ Round 114: listAliases with non-string search should not throw ââ
  console.log('\nRound 114: listAliases (non-string search â ignored without TypeError):');
  if (test('listAliases ignores non-string search values and does not throw', () => {
    resetAliases();

    // Set up some aliases to search through
    aliases.setAlias('alpha-session', '/path/to/alpha');
    aliases.setAlias('beta-session', '/path/to/beta');

    // String search works fine â baseline
    const stringResult = aliases.listAliases({ search: 'alpha' });
    assert.strictEqual(stringResult.length, 1, 'String search should find 1 match');
    assert.strictEqual(stringResult[0].name, 'alpha-session');

    const numericResult = aliases.listAliases({ search: 123 });
    assert.strictEqual(numericResult.length, 2, 'Numeric search should be ignored (no filtering)');

    const booleanResult = aliases.listAliases({ search: true });
    assert.strictEqual(booleanResult.length, 2, 'Boolean search should be ignored (no filtering)');
  })) passed++; else failed++;

  // ââ Round 115: updateAliasTitle with empty string â stored and returned as null ââ
  console.log('\nRound 115: updateAliasTitle (empty string title â stored null, returned null):');
  if (test('updateAliasTitle with empty string stores null and returns normalized null', () => {
    resetAliases();

    // Create alias with a title
    aliases.setAlias('r115-alias', '/path/to/session', 'Original Title');
    const before = aliases.resolveAlias('r115-alias');
    assert.strictEqual(before.title, 'Original Title', 'Baseline: title should be set');

    // Update title with empty string
    const result = aliases.updateAliasTitle('r115-alias', '');
    assert.strictEqual(result.success, true, 'Should succeed (empty string passes validation)');
    assert.strictEqual(result.title, null, 'Return value should be normalized to stored null');

    // But what's actually stored?
    const after = aliases.resolveAlias('r115-alias');
    assert.strictEqual(after.title, null,
      'Stored title should be null because "" || null evaluates to null');

    // Contrast: non-empty string is stored as-is
    aliases.updateAliasTitle('r115-alias', 'New Title');
    const withTitle = aliases.resolveAlias('r115-alias');
    assert.strictEqual(withTitle.title, 'New Title', 'Non-empty string stored as-is');

    // null explicitly clears title
    aliases.updateAliasTitle('r115-alias', null);
    const cleared = aliases.resolveAlias('r115-alias');
    assert.strictEqual(cleared.title, null, 'null clears title');
  })) passed++; else failed++;

  // ââ Round 116: loadAliases with extra unknown fields â silently preserved ââ
  console.log('\nRound 116: loadAliases (extra unknown JSON fields â preserved by loose validation):');
  if (test('loadAliases preserves extra unknown fields because only aliases key is validated', () => {
    resetAliases();

    // Manually write an aliases file with extra fields
    const aliasesPath = aliases.getAliasesPath();
    const customData = {
      version: '1.0',
      aliases: {
        'test-session': {
          sessionPath: '/path/to/session',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          title: 'Test'
        }
      },
      metadata: {
        totalCount: 1,
        lastUpdated: '2026-01-01T00:00:00.000Z'
      },
      customField: 'extra data',
      debugInfo: { level: 3, verbose: true },
      tags: ['important', 'test']
    };
    fs.writeFileSync(aliasesPath, JSON.stringify(customData, null, 2), 'utf8');

    // loadAliases only validates data.aliases â extra fields pass through
    const loaded = aliases.loadAliases();
    assert.ok(loaded.aliases['test-session'], 'Should load the valid alias');
    assert.strictEqual(loaded.aliases['test-session'].title, 'Test');
    assert.strictEqual(loaded.customField, 'extra data',
      'Extra string field should be preserved');
    assert.deepStrictEqual(loaded.debugInfo, { level: 3, verbose: true },
      'Extra object field should be preserved');
    assert.deepStrictEqual(loaded.tags, ['important', 'test'],
      'Extra array field should be preserved');

    // After saving, extra fields survive a round-trip (saveAliases only updates metadata)
    aliases.setAlias('new-alias', '/path/to/new');
    const reloaded = aliases.loadAliases();
    assert.ok(reloaded.aliases['new-alias'], 'New alias should be saved');
    assert.strictEqual(reloaded.customField, 'extra data',
      'Extra field should survive save/load round-trip');
  })) passed++; else failed++;

  // ââ Round 118: renameAlias to the same name â "already exists" because self-check ââ
  console.log('\nRound 118: renameAlias (same name â "already exists" because data.aliases[newAlias] is truthy):');
  if (test('renameAlias to the same name returns "already exists" error (no self-rename short-circuit)', () => {
    resetAliases();
    aliases.setAlias('same-name', '/path/to/session');

    // Rename 'same-name' â 'same-name'
    // Line 333: data.aliases[newAlias] â truthy (the alias exists under that name)
    // Returns error before checking if oldAlias === newAlias
    const result = aliases.renameAlias('same-name', 'same-name');
    assert.strictEqual(result.success, false, 'Should fail');
    assert.ok(result.error.includes('already exists'),
      'Error should say "already exists" (not "same name" or a no-op success)');

    // Verify alias is unchanged
    const resolved = aliases.resolveAlias('same-name');
    assert.ok(resolved, 'Original alias should still exist');
    assert.strictEqual(resolved.sessionPath, '/path/to/session');
  })) passed++; else failed++;

  // ââ Round 118: setAlias reserved names â case-insensitive rejection ââ
  console.log('\nRound 118: setAlias (reserved names â case-insensitive rejection):');
  if (test('setAlias rejects all reserved names case-insensitively (list, help, remove, delete, create, set)', () => {
    resetAliases();

    // All reserved names in lowercase
    const reserved = ['list', 'help', 'remove', 'delete', 'create', 'set'];
    for (const name of reserved) {
      const result = aliases.setAlias(name, '/path/to/session');
      assert.strictEqual(result.success, false,
        `'${name}' should be rejected as reserved`);
      assert.ok(result.error.includes('reserved'),
        `Error for '${name}' should mention "reserved"`);
    }

    // Case-insensitive: uppercase variants also rejected
    const upperResult = aliases.setAlias('LIST', '/path/to/session');
    assert.strictEqual(upperResult.success, false,
      '"LIST" (uppercase) should be rejected (toLowerCase check)');

    const mixedResult = aliases.setAlias('Help', '/path/to/session');
    assert.strictEqual(mixedResult.success, false,
      '"Help" (mixed case) should be rejected');

    const allCapsResult = aliases.setAlias('DELETE', '/path/to/session');
    assert.strictEqual(allCapsResult.success, false,
      '"DELETE" (all caps) should be rejected');

    // Non-reserved names work fine
    const validResult = aliases.setAlias('my-session', '/path/to/session');
    assert.strictEqual(validResult.success, true,
      'Non-reserved name should succeed');
  })) passed++; else failed++;

  // ââ Round 119: renameAlias with reserved newAlias name â parallel reserved check ââ
  console.log('\nRound 119: renameAlias (reserved newAlias name â parallel check to setAlias):');
  if (test('renameAlias rejects reserved names for newAlias (same reserved list as setAlias)', () => {
    resetAliases();
    aliases.setAlias('my-alias', '/path/to/session');

    // Rename to reserved name 'list' â should fail
    const listResult = aliases.renameAlias('my-alias', 'list');
    assert.strictEqual(listResult.success, false, '"list" should be rejected');
    assert.ok(listResult.error.includes('reserved'),
      'Error should mention "reserved"');

    // Rename to reserved name 'help' (uppercase) â should fail
    const helpResult = aliases.renameAlias('my-alias', 'Help');
    assert.strictEqual(helpResult.success, false, '"Help" should be rejected');

    // Rename to reserved name 'delete' â should fail
    const deleteResult = aliases.renameAlias('my-alias', 'DELETE');
    assert.strictEqual(deleteResult.success, false, '"DELETE" should be rejected');

    // Verify alias is unchanged
    const resolved = aliases.resolveAlias('my-alias');
    assert.ok(resolved, 'Original alias should still exist after failed renames');
    assert.strictEqual(resolved.sessionPath, '/path/to/session');

    // Valid rename works
    const validResult = aliases.renameAlias('my-alias', 'new-valid-name');
    assert.strictEqual(validResult.success, true, 'Non-reserved name should succeed');
  })) passed++; else failed++;

  // ââ Round 120: setAlias max length boundary â 128 accepted, 129 rejected ââ
  console.log('\nRound 120: setAlias (max alias length boundary â 128 ok, 129 rejected):');
  if (test('setAlias accepts exactly 128-char alias name but rejects 129 chars (> 128 boundary)', () => {
    resetAliases();

    // 128 characters â exactly at limit (alias.length > 128 is false)
    const name128 = 'a'.repeat(128);
    const result128 = aliases.setAlias(name128, '/path/to/session');
    assert.strictEqual(result128.success, true,
      '128-char alias should be accepted (128 > 128 is false)');

    // 129 characters â just over limit
    const name129 = 'a'.repeat(129);
    const result129 = aliases.setAlias(name129, '/path/to/session');
    assert.strictEqual(result129.success, false,
      '129-char alias should be rejected (129 > 128 is true)');
    assert.ok(result129.error.includes('128'),
      'Error should mention the 128 character limit');

    // 1 character â minimum valid
    const name1 = 'x';
    const result1 = aliases.setAlias(name1, '/path/to/session');
    assert.strictEqual(result1.success, true,
      'Single character alias should be accepted');

    // Verify the 128-char alias was actually stored
    const resolved = aliases.resolveAlias(name128);
    assert.ok(resolved, '128-char alias should be resolvable');
    assert.strictEqual(resolved.sessionPath, '/path/to/session');
  })) passed++; else failed++;

  // ââ Round 121: setAlias sessionPath validation â null, empty, whitespace, non-string ââ
  console.log('\nRound 121: setAlias (sessionPath validation â null, empty, whitespace, non-string):');
  if (test('setAlias rejects invalid sessionPath: null, empty, whitespace-only, and non-string types', () => {
    resetAliases();

    // null sessionPath â falsy â rejected
    const nullResult = aliases.setAlias('test-alias', null);
    assert.strictEqual(nullResult.success, false, 'null path should fail');
    assert.ok(nullResult.error.includes('empty'), 'Error should mention empty');

    // undefined sessionPath â falsy â rejected
    const undefResult = aliases.setAlias('test-alias', undefined);
    assert.strictEqual(undefResult.success, false, 'undefined path should fail');

    // empty string â falsy â rejected
    const emptyResult = aliases.setAlias('test-alias', '');
    assert.strictEqual(emptyResult.success, false, 'Empty string path should fail');

    // whitespace-only â passes falsy check but trim().length === 0 â rejected
    const wsResult = aliases.setAlias('test-alias', '   ');
    assert.strictEqual(wsResult.success, false, 'Whitespace-only path should fail');

    // number â typeof !== 'string' â rejected
    const numResult = aliases.setAlias('test-alias', 42);
    assert.strictEqual(numResult.success, false, 'Number path should fail');

    // boolean â typeof !== 'string' â rejected
    const boolResult = aliases.setAlias('test-alias', true);
    assert.strictEqual(boolResult.success, false, 'Boolean path should fail');

    // Valid path works
    const validResult = aliases.setAlias('test-alias', '/valid/path');
    assert.strictEqual(validResult.success, true, 'Valid string path should succeed');
  })) passed++; else failed++;

  // ââ Round 122: listAliases limit edge cases â limit=0, negative, NaN bypassed (JS falsy) ââ
  console.log('\nRound 122: listAliases (limit edge cases â 0/negative/NaN are falsy, return all):');
  if (test('listAliases limit=0 returns all aliases because 0 is falsy in JS (no slicing)', () => {
    resetAliases();
    aliases.setAlias('alias-a', '/path/a');
    aliases.setAlias('alias-b', '/path/b');
    aliases.setAlias('alias-c', '/path/c');

    // limit=0: 0 is falsy â `if (0 && 0 > 0)` short-circuits â no slicing â ALL returned
    const zeroResult = aliases.listAliases({ limit: 0 });
    assert.strictEqual(zeroResult.length, 3,
      'limit=0 should return ALL aliases (0 is falsy in JS)');

    // limit=-1: -1 is truthy but -1 > 0 is false â no slicing â ALL returned
    const negResult = aliases.listAliases({ limit: -1 });
    assert.strictEqual(negResult.length, 3,
      'limit=-1 should return ALL aliases (-1 > 0 is false)');

    // limit=NaN: NaN is falsy â no slicing â ALL returned
    const nanResult = aliases.listAliases({ limit: NaN });
    assert.strictEqual(nanResult.length, 3,
      'limit=NaN should return ALL aliases (NaN is falsy)');

    // limit=1: normal case â returns exactly 1
    const oneResult = aliases.listAliases({ limit: 1 });
    assert.strictEqual(oneResult.length, 1,
      'limit=1 should return exactly 1 alias');

    // limit=2: returns exactly 2
    const twoResult = aliases.listAliases({ limit: 2 });
    assert.strictEqual(twoResult.length, 2,
      'limit=2 should return exactly 2 aliases');

    // limit=100 (more than total): returns all 3
    const bigResult = aliases.listAliases({ limit: 100 });
    assert.strictEqual(bigResult.length, 3,
      'limit > total should return all aliases');
  })) passed++; else failed++;

  // ââ Round 125: loadAliases with __proto__ key in JSON â no prototype pollution ââ
  console.log('\nRound 125: loadAliases (__proto__ key in JSON â safe, no prototype pollution):');
  if (test('loadAliases with __proto__ alias key does not pollute Object prototype', () => {
    // JSON.parse('{"__proto__":...}') creates a normal property named "__proto__",
    // it does NOT modify Object.prototype. This is safe but worth documenting.
    // The alias would be accessible via data.aliases['__proto__'] and iterable
    // via Object.entries, but it won't affect other objects.
    resetAliases();

    // Write raw JSON string with __proto__ as an alias name.
    // IMPORTANT: Cannot use JSON.stringify(obj) because {'__proto__':...} in JS
    // sets the prototype rather than creating an own property, so stringify drops it.
    // Must write the JSON string directly to simulate a maliciously crafted file.
    const aliasesPath = aliases.getAliasesPath();
    const now = new Date().toISOString();
    const rawJson = `{
  "version": "1.0.0",
  "aliases": {
    "__proto__": {
      "sessionPath": "/evil/path",
      "createdAt": "${now}",
      "title": "Prototype Pollution Attempt"
    },
    "normal": {
      "sessionPath": "/normal/path",
      "createdAt": "${now}",
      "title": "Normal Alias"
    }
  },
  "metadata": { "totalCount": 2, "lastUpdated": "${now}" }
}`;
    fs.writeFileSync(aliasesPath, rawJson);

    // Load aliases â should NOT pollute prototype
    const data = aliases.loadAliases();

    // Verify __proto__ did NOT pollute Object.prototype
    const freshObj = {};
    assert.strictEqual(freshObj.sessionPath, undefined,
      'Object.prototype should NOT have sessionPath (no pollution)');
    assert.strictEqual(freshObj.title, undefined,
      'Object.prototype should NOT have title (no pollution)');

    // The __proto__ key IS accessible as a normal property
    assert.ok(data.aliases['__proto__'],
      '__proto__ key exists as normal property in parsed aliases');
    assert.strictEqual(data.aliases['__proto__'].sessionPath, '/evil/path',
      '__proto__ alias data is accessible normally');

    // Normal alias also works
    assert.ok(data.aliases['normal'],
      'Normal alias coexists with __proto__ key');

    // resolveAlias with '__proto__' â rejected by regex (underscores ok but __ prefix works)
    // Actually ^[a-zA-Z0-9_-]+$ would ACCEPT '__proto__' since _ is allowed
    const resolved = aliases.resolveAlias('__proto__');
    // If the regex accepts it, it should find the alias
    if (resolved) {
      assert.strictEqual(resolved.sessionPath, '/evil/path',
        'resolveAlias can access __proto__ alias (regex allows underscores)');
    }

    // Object.keys should enumerate __proto__ from JSON.parse
    const keys = Object.keys(data.aliases);
    assert.ok(keys.includes('__proto__'),
      'Object.keys includes __proto__ from JSON.parse (normal property)');
    assert.ok(keys.includes('normal'),
      'Object.keys includes normal alias');
  })) passed++; else failed++;

  // Summary
  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();


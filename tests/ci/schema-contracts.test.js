/**
 * Contract tests for local schema/reference files.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('../helpers/test-runner');

function readJson(...segments) {
  const filePath = path.join(__dirname, '..', '..', ...segments);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runTests() {
  console.log('\n=== Testing Schema Contracts ===\n');

  let passed = 0;
  let failed = 0;

  if (test('hooks schema enumerates all shipped Claude hook event names', () => {
    const schema = readJson('schemas', 'claude-hooks.schema.json');
    const hooksConfig = readJson('claude-template', 'hooks.json');

    const declaredEvents = schema.$defs.eventName.enum;
    for (const eventName of Object.keys(hooksConfig.hooks)) {
      assert.ok(
        declaredEvents.includes(eventName),
        `Schema event enum should include ${eventName}`
      );
    }
  })) passed++; else failed++;

  if (test('hooks schema models command hook entries instead of event-type hook items', () => {
    const schema = readJson('schemas', 'claude-hooks.schema.json');
    const hookCommand = schema.$defs.commandHook;

    assert.ok(hookCommand, 'Schema should define a commandHook shape');
    assert.strictEqual(hookCommand.properties.type.const, 'command', 'Hook item type should be command');
    assert.ok(hookCommand.required.includes('type'), 'commandHook should require type');
    assert.ok(hookCommand.required.includes('command'), 'commandHook should require command');
  })) passed++; else failed++;

  if (test('cursor hooks schema enumerates all shipped Cursor hook event names', () => {
    const schema = readJson('schemas', 'cursor-hooks.schema.json');
    const hooksConfig = readJson('hooks', 'cursor', 'hooks.json');

    const declaredEvents = schema.$defs.eventName.enum;
    for (const eventName of Object.keys(hooksConfig.hooks)) {
      assert.ok(
        declaredEvents.includes(eventName),
        `Cursor schema event enum should include ${eventName}`
      );
    }
  })) passed++; else failed++;

  if (test('cursor hooks schema models hook entries with command and event fields', () => {
    const schema = readJson('schemas', 'cursor-hooks.schema.json');
    const hookEntry = schema.$defs.hookEntry;

    assert.ok(hookEntry, 'Schema should define a hookEntry shape');
    assert.ok(hookEntry.required.includes('command'), 'hookEntry should require command');
    assert.ok(hookEntry.required.includes('event'), 'hookEntry should require event');
  })) passed++; else failed++;

  if (test('plugin schema requires version and documents reference-only status', () => {
    const schema = readJson('schemas', 'plugin.schema.json');

    assert.ok(schema.required.includes('name'), 'Schema should require name');
    assert.ok(schema.required.includes('version'), 'Schema should require version');
    assert.ok(
      /reference/i.test(schema.description),
      'Schema description should warn that this is a reference contract'
    );
  })) passed++; else failed++;

  if (test('plugin schema keeps manifest path collections as arrays of strings', () => {
    const schema = readJson('schemas', 'plugin.schema.json');
    const pathFields = ['skills', 'agents', 'commands', 'rules', 'hooks', 'mcp_configs'];

    for (const fieldName of pathFields) {
      assert.strictEqual(schema.properties[fieldName].type, 'array', `${fieldName} should be an array`);
      assert.strictEqual(schema.properties[fieldName].items.type, 'string', `${fieldName} items should be strings`);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

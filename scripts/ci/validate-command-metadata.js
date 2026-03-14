#!/usr/bin/env node
/**
 * Validate per-command install metadata and Cursor override invariants.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '../..');
const DEFAULT_COMMANDS_DIR = path.join(ROOT_DIR, 'commands');
const DEFAULT_CURSOR_COMMANDS_DIR = path.join(ROOT_DIR, 'cursor-template', 'commands');
const VALID_TOOLS = new Set(['claude', 'cursor']);

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listMarkdownFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath).filter((fileName) => fileName.endsWith('.md'));
}

function validateCommandMetaFile(commandFile, commandsDir, io) {
  const metaPath = path.join(commandsDir, commandFile.replace(/\.md$/, '.meta.json'));
  if (!fs.existsSync(metaPath)) {
    io.error(`ERROR: ${commandFile} - missing ${path.basename(metaPath)}`);
    return true;
  }

  let parsed;
  try {
    parsed = readJsonFile(metaPath);
  } catch (error) {
    io.error(`ERROR: ${path.basename(metaPath)} - Invalid JSON: ${error.message}`);
    return true;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    io.error(`ERROR: ${path.basename(metaPath)} - metadata must be an object`);
    return true;
  }

  if (!Array.isArray(parsed.tools) || parsed.tools.length === 0) {
    io.error(`ERROR: ${path.basename(metaPath)} - tools must be a non-empty array`);
    return true;
  }

  let hasErrors = false;
  for (const toolName of parsed.tools) {
    if (typeof toolName !== 'string' || !VALID_TOOLS.has(toolName)) {
      io.error(`ERROR: ${path.basename(metaPath)} - unsupported tool '${toolName}'`);
      hasErrors = true;
    }
  }

  return hasErrors;
}

function validateCursorOverrideFile(commandFile, commandsDir, cursorCommandsDir, io) {
  const sharedCommandPath = path.join(commandsDir, commandFile);
  const metaPath = path.join(commandsDir, commandFile.replace(/\.md$/, '.meta.json'));

  let hasErrors = false;
  if (!fs.existsSync(sharedCommandPath)) {
    io.error(`ERROR: cursor-template/commands/${commandFile} - missing shared command commands/${commandFile}`);
    hasErrors = true;
  }
  if (!fs.existsSync(metaPath)) {
    io.error(`ERROR: cursor-template/commands/${commandFile} - missing shared metadata commands/${path.basename(metaPath)}`);
    return true;
  }

  let parsed;
  try {
    parsed = readJsonFile(metaPath);
  } catch (error) {
    io.error(`ERROR: ${path.basename(metaPath)} - Invalid JSON: ${error.message}`);
    return true;
  }

  if (!Array.isArray(parsed.tools) || !parsed.tools.includes('cursor')) {
    io.error(`ERROR: cursor-template/commands/${commandFile} - shared metadata must include "cursor"`);
    hasErrors = true;
  }

  return hasErrors;
}

function validateCommandMetadata(options = {}) {
  const commandsDir = options.commandsDir || DEFAULT_COMMANDS_DIR;
  const cursorCommandsDir = options.cursorCommandsDir || DEFAULT_CURSOR_COMMANDS_DIR;
  const io = options.io || { log: console.log, error: console.error };

  if (!fs.existsSync(commandsDir)) {
    io.log('No commands directory found, skipping validation');
    return { exitCode: 0, validatedCount: 0, hasErrors: false };
  }

  const commandFiles = listMarkdownFiles(commandsDir);
  let hasErrors = false;

  for (const commandFile of commandFiles) {
    hasErrors = validateCommandMetaFile(commandFile, commandsDir, io) || hasErrors;
  }

  for (const cursorCommandFile of listMarkdownFiles(cursorCommandsDir)) {
    hasErrors = validateCursorOverrideFile(cursorCommandFile, commandsDir, cursorCommandsDir, io) || hasErrors;
  }

  if (hasErrors) {
    return { exitCode: 1, validatedCount: commandFiles.length, hasErrors: true };
  }

  io.log(`Validated ${commandFiles.length} command metadata files`);
  return { exitCode: 0, validatedCount: commandFiles.length, hasErrors: false };
}

if (require.main === module) {
  const result = validateCommandMetadata();
  process.exit(result.exitCode);
}

module.exports = {
  validateCommandMetadata
};

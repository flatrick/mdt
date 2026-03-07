#!/usr/bin/env node
/**
 * Validate agent markdown files have required frontmatter
 */

const fs = require('fs');
const path = require('path');
const { readMarkdownFile } = require('./markdown-utils');

const DEFAULT_AGENTS_DIR = path.join(__dirname, '../../agents');
const REQUIRED_FIELDS = ['model', 'tools'];
const VALID_MODELS = ['haiku', 'sonnet', 'opus'];
const DEFAULT_IO = { log: console.log, error: console.error };

function extractFrontmatter(content) {
  // Strip BOM if present (UTF-8 BOM: \uFEFF)
  const cleanContent = content.replace(/^\uFEFF/, '');
  // Support both LF and CRLF line endings
  const match = cleanContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const frontmatter = {};
  const lines = match[1].split(/\r?\n/);
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      frontmatter[key] = value;
    }
  }
  return frontmatter;
}

function validateAgents(options = {}) {
  const agentsDir = options.agentsDir || DEFAULT_AGENTS_DIR;
  const io = options.io || DEFAULT_IO;
  if (!fs.existsSync(agentsDir)) {
    io.log('No agents directory found, skipping validation');
    return { exitCode: 0, validatedCount: 0, hasErrors: false };
  }

  const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
  let hasErrors = false;

  for (const file of files) {
    if (validateAgentFile(agentsDir, file, io)) {
      hasErrors = true;
    }
  }

  if (hasErrors) {
    return { exitCode: 1, validatedCount: files.length, hasErrors: true };
  }

  io.log(`Validated ${files.length} agent files`);
  return { exitCode: 0, validatedCount: files.length, hasErrors: false };
}

function validateAgentFile(agentsDir, fileName, io) {
  const loaded = loadFrontmatterFromFile(agentsDir, fileName, io);
  if (!loaded.ok) {
    return true;
  }

  const frontmatter = loaded.frontmatter;
  let hasErrors = false;

  for (const field of REQUIRED_FIELDS) {
    if (isMissingField(frontmatter, field)) {
      io.error(`ERROR: ${fileName} - Missing required field: ${field}`);
      hasErrors = true;
    }
  }

  if (frontmatter.model && !VALID_MODELS.includes(frontmatter.model)) {
    io.error(`ERROR: ${fileName} - Invalid model '${frontmatter.model}'. Must be one of: ${VALID_MODELS.join(', ')}`);
    hasErrors = true;
  }

  return hasErrors;
}

function loadFrontmatterFromFile(agentsDir, fileName, io) {
  const filePath = path.join(agentsDir, fileName);

  let content;
  try {
    content = readMarkdownFile(filePath);
  } catch (readError) {
    io.error(`ERROR: ${fileName} - ${readError.message}`);
    return { ok: false, frontmatter: null };
  }

  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) {
    io.error(`ERROR: ${fileName} - Missing frontmatter`);
    return { ok: false, frontmatter: null };
  }

  return { ok: true, frontmatter };
}

function isMissingField(frontmatter, field) {
  return !frontmatter[field] || (typeof frontmatter[field] === 'string' && !frontmatter[field].trim());
}

if (require.main === module) {
  const result = validateAgents();
  process.exit(result.exitCode);
}

module.exports = {
  extractFrontmatter,
  validateAgents
};

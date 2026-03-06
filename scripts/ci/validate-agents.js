#!/usr/bin/env node
/**
 * Validate agent markdown files have required frontmatter
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_AGENTS_DIR = path.join(__dirname, '../../agents');
const REQUIRED_FIELDS = ['model', 'tools'];
const VALID_MODELS = ['haiku', 'sonnet', 'opus'];

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
  const io = options.io || { log: console.log, error: console.error };
  if (!fs.existsSync(agentsDir)) {
    io.log('No agents directory found, skipping validation');
    return { exitCode: 0, validatedCount: 0, hasErrors: false };
  }

  const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
  let hasErrors = false;

  for (const file of files) {
    const filePath = path.join(agentsDir, file);
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      io.error(`ERROR: ${file} - ${err.message}`);
      hasErrors = true;
      continue;
    }
    const frontmatter = extractFrontmatter(content);

    if (!frontmatter) {
      io.error(`ERROR: ${file} - Missing frontmatter`);
      hasErrors = true;
      continue;
    }

    for (const field of REQUIRED_FIELDS) {
      if (!frontmatter[field] || (typeof frontmatter[field] === 'string' && !frontmatter[field].trim())) {
        io.error(`ERROR: ${file} - Missing required field: ${field}`);
        hasErrors = true;
      }
    }

    // Validate model is a known value
    if (frontmatter.model && !VALID_MODELS.includes(frontmatter.model)) {
      io.error(`ERROR: ${file} - Invalid model '${frontmatter.model}'. Must be one of: ${VALID_MODELS.join(', ')}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    return { exitCode: 1, validatedCount: files.length, hasErrors: true };
  }

  io.log(`Validated ${files.length} agent files`);
  return { exitCode: 0, validatedCount: files.length, hasErrors: false };
}

if (require.main === module) {
  const result = validateAgents();
  process.exit(result.exitCode);
}

module.exports = {
  extractFrontmatter,
  validateAgents
};

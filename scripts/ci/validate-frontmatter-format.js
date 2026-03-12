#!/usr/bin/env node
/**
 * Validate repository markdown frontmatter spacing.
 *
 * Rule: if a markdown file has YAML frontmatter, there must be a blank line
 * between the last frontmatter field and the closing `---` delimiter.
 */

const fs = require('fs');
const path = require('path');
const { readMarkdownFile, hasNormalizedFrontmatterSpacing } = require('./markdown-utils');

const REPO_ROOT = path.join(__dirname, '../..');
const DEFAULT_IO = { log: console.log, error: console.error };
const SKIP_DIRS = new Set(['.git', 'node_modules']);

function collectMarkdownFiles(rootDir, relativeDir = '') {
  const currentDir = path.join(rootDir, relativeDir);
  const files = [];

  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }

    const nextRelative = path.join(relativeDir, entry.name);
    const fullPath = path.join(rootDir, nextRelative);

    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(rootDir, nextRelative));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function validateFrontmatterFormat(options = {}) {
  const repoRoot = options.repoRoot || REPO_ROOT;
  const io = options.io || DEFAULT_IO;
  const markdownFiles = options.markdownFiles || collectMarkdownFiles(repoRoot);

  let hasErrors = false;
  let validatedCount = 0;

  for (const filePath of markdownFiles) {
    const content = readMarkdownFile(filePath);
    if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
      continue;
    }

    validatedCount++;

    if (!hasNormalizedFrontmatterSpacing(content)) {
      const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
      io.error(`ERROR: ${relativePath} - Frontmatter must include a blank line before the closing --- delimiter`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    return { exitCode: 1, validatedCount, hasErrors: true };
  }

  io.log(`Validated frontmatter spacing in ${validatedCount} markdown files`);
  return { exitCode: 0, validatedCount, hasErrors: false };
}

if (require.main === module) {
  const result = validateFrontmatterFormat();
  process.exit(result.exitCode);
}

module.exports = {
  collectMarkdownFiles,
  validateFrontmatterFormat
};

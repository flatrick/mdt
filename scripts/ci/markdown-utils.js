#!/usr/bin/env node
/**
 * Shared markdown helpers for CI validators.
 */

const fs = require('fs');

function readMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.replace(/^\uFEFF/, '');
}

function hasMarkdownHeading(content) {
  return /^#{1,6}\s+\S/m.test(content);
}

function stripFrontmatter(content) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

function hasNormalizedFrontmatterSpacing(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return true;
  }

  return /\r?\n\s*$/.test(match[1]);
}

module.exports = {
  readMarkdownFile,
  hasMarkdownHeading,
  stripFrontmatter,
  hasNormalizedFrontmatterSpacing
};

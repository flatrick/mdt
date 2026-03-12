#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '../..');
const DEFAULT_IO = { log: console.log, error: console.error };
const MARKDOWN_EXT_RE = /\.md$/i;
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const TOOL_PATTERNS = {
  claude: /\bClaude Code\b|\bClaude\b/g,
  cursor: /\bCursor\b/g,
  codex: /\bCodex\b/g,
  gemini: /\bGemini\b/g
};
const ALLOWLIST = new Set();
const CODEX_CONTINUOUS_LEARNING_DOC =
  'codex-template/skills/continuous-learning-manual/SKILL.md';

function normalizeSlashes(value) {
  return value.replace(/\\/g, '/');
}

function collectTemplateMarkdownFiles(rootDir) {
  const files = [];

  function visit(dirPath) {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        visit(fullPath);
        continue;
      }
      if (!entry.isFile() || !MARKDOWN_EXT_RE.test(entry.name)) continue;
      const relativePath = normalizeSlashes(path.relative(rootDir, fullPath));
      if (!relativePath.includes('-template/')) continue;
      files.push(fullPath);
    }
  }

  visit(rootDir);
  return files;
}

function stripCodeBlocks(content) {
  return content.replace(/```[\s\S]*?```/g, '');
}

function getToolFromRelativePath(relativePath) {
  const [firstSegment] = relativePath.split('/');
  return firstSegment.replace(/-template$/, '');
}

function lineNumberForIndex(content, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

function validateTemplateDocBoundaries(options = {}) {
  const repoRoot = options.repoRoot || ROOT_DIR;
  const io = options.io || DEFAULT_IO;
  const markdownFiles = options.markdownFiles || collectTemplateMarkdownFiles(repoRoot);
  let hasErrors = false;
  let checkedFiles = 0;

  for (const filePath of markdownFiles) {
    const relativePath = normalizeSlashes(path.relative(repoRoot, filePath));
    if (ALLOWLIST.has(relativePath)) continue;

    const owningTool = getToolFromRelativePath(relativePath);
    const content = stripCodeBlocks(fs.readFileSync(filePath, 'utf8'));
    checkedFiles++;

    for (const [toolName, pattern] of Object.entries(TOOL_PATTERNS)) {
      if (toolName === owningTool) continue;

      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const line = lineNumberForIndex(content, match.index);
        io.error(
          `ERROR: ${relativePath}:${line} - ${owningTool}-template document references other tool "${match[0]}"`
        );
        hasErrors = true;
      }
    }

    if (relativePath === CODEX_CONTINUOUS_LEARNING_DOC) {
      const forbiddenPatterns = [
        { pattern: /<data>\/homunculus\//g, label: '<data>/homunculus/' },
        { pattern: /\$\{MDT_ROOT\}/g, label: '${MDT_ROOT}' }
      ];

      for (const { pattern, label } of forbiddenPatterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const line = lineNumberForIndex(content, match.index);
          io.error(
            `ERROR: ${relativePath}:${line} - codex-template continuous-learning-manual must use concrete Codex paths, not '${label}'`
          );
          hasErrors = true;
        }
      }
    }
  }

  if (hasErrors) {
    return { exitCode: 1, checkedFiles, hasErrors: true };
  }

  io.log(`Validated template-doc boundaries across ${checkedFiles} markdown files`);
  return { exitCode: 0, checkedFiles, hasErrors: false };
}

if (require.main === module) {
  const result = validateTemplateDocBoundaries();
  process.exit(result.exitCode);
}

module.exports = {
  validateTemplateDocBoundaries
};

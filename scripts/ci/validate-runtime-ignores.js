#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '../..');
const REQUIRED_RUNTIME_IGNORES = Object.freeze([
  '.claude/',
  '.cursor/',
  '.codex/*'
]);
const REQUIRED_RUNTIME_ALLOW_ENTRIES = Object.freeze({
  '.claude/': ['!.claude/rules/', '!.claude/skills/'],
  '.codex/': ['!.codex/AGENTS.md']
});

function parseIgnoreEntries(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function normalizePattern(pattern) {
  return pattern
    .replace(/^!/, '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

function isRootDirIgnore(pattern, dirName) {
  const normalized = normalizePattern(pattern);
  return normalized === dirName || normalized === `${dirName}/*` || normalized === `${dirName}/**`;
}

function isChildUnignore(pattern, dirName) {
  const normalized = normalizePattern(pattern);
  return normalized.startsWith(`${dirName}/`);
}

function evaluateRuntimeIgnore(lines, dirWithSlash, allowedChildUnignores = []) {
  const dirName = dirWithSlash.replace(/\/+$/, '');
  const allowed = new Set(allowedChildUnignores.map(normalizePattern));
  let ignored = false;
  let childUnignored = false;

  for (const line of lines) {
    const isNegated = line.startsWith('!');

    if (isRootDirIgnore(line, dirName)) {
      ignored = !isNegated;
      if (isNegated) {
        childUnignored = true;
      }
      continue;
    }

    if (ignored && isNegated && isChildUnignore(line, dirName)) {
      if (!allowed.has(normalizePattern(line))) {
        childUnignored = true;
      }
    }
  }

  return {
    ignored,
    childUnignored
  };
}

function checkRuntimeIgnores(gitignorePath) {
  if (!fs.existsSync(gitignorePath)) {
    return {
      ok: false,
      issues: [`Missing .gitignore file: ${gitignorePath}`]
    };
  }

  const entries = parseIgnoreEntries(fs.readFileSync(gitignorePath, 'utf8'));
  const issues = [];

  for (const requiredEntry of REQUIRED_RUNTIME_IGNORES) {
    const dirKey = requiredEntry.startsWith('.codex/') ? '.codex/' : requiredEntry;
    const allowedChildUnignores = REQUIRED_RUNTIME_ALLOW_ENTRIES[dirKey] || [];
    const evaluation = evaluateRuntimeIgnore(entries, dirKey, allowedChildUnignores);

    if (!evaluation.ignored) {
      issues.push(`Missing runtime ignore entry: ${requiredEntry}`);
      continue;
    }

    if (evaluation.childUnignored) {
      issues.push(`Runtime dir is partially unignored: ${dirKey}`);
    }

    for (const allowEntry of allowedChildUnignores) {
      if (!entries.includes(allowEntry) && !entries.includes(allowEntry.replace('!.', '!/.'))) {
        issues.push(`Missing runtime allow entry: ${allowEntry}`);
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
}

function validateRuntimeIgnores(options = {}) {
  const io = options.io || { log: console.log, error: console.error };
  const gitignorePath = options.gitignorePath || path.join(REPO_ROOT, '.gitignore');
  const result = checkRuntimeIgnores(gitignorePath);

  if (!result.ok) {
    for (const issue of result.issues) {
      io.error(issue);
    }
    return { exitCode: 1, errors: result.issues };
  }

  io.log(`Validated runtime-dir ignores (${REQUIRED_RUNTIME_IGNORES.length} required entries)`);
  return { exitCode: 0, errors: [] };
}

if (require.main === module) {
  const result = validateRuntimeIgnores();
  process.exit(result.exitCode);
}

module.exports = {
  REQUIRED_RUNTIME_IGNORES,
  REQUIRED_RUNTIME_ALLOW_ENTRIES,
  checkRuntimeIgnores,
  evaluateRuntimeIgnore,
  isChildUnignore,
  isRootDirIgnore,
  normalizePattern,
  parseIgnoreEntries,
  validateRuntimeIgnores
};
'use strict';

const fs = require('fs');
const path = require('path');

function hasStrongProjectMarker(dirPath) {
  return (
    fs.existsSync(path.join(dirPath, '.git')) ||
    fs.existsSync(path.join(dirPath, 'package.json'))
  );
}

function hasFallbackProjectMarker(dirPath) {
  return fs.existsSync(path.join(dirPath, 'AGENTS.md'));
}

function hasAnyProjectMarker(dirPath) {
  return hasStrongProjectMarker(dirPath) || hasFallbackProjectMarker(dirPath);
}

function detectProjectRoot(startDir = process.cwd(), options = {}) {
  const requiredRelativePath = options.requiredRelativePath || null;
  const defaultToStartDir = options.defaultToStartDir === true;
  const resolvedStartDir = path.resolve(startDir);
  let current = resolvedStartDir;
  let fallbackRoot = null;

  while (true) {
    const satisfiesRequiredPath = !requiredRelativePath ||
      fs.existsSync(path.join(current, requiredRelativePath));

    if (satisfiesRequiredPath && hasStrongProjectMarker(current)) {
      return current;
    }

    if (fallbackRoot === null && satisfiesRequiredPath && hasFallbackProjectMarker(current)) {
      fallbackRoot = current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return fallbackRoot || (defaultToStartDir ? resolvedStartDir : null);
    }
    current = parent;
  }
}

module.exports = {
  detectProjectRoot,
  hasAnyProjectMarker,
  hasFallbackProjectMarker,
  hasStrongProjectMarker
};

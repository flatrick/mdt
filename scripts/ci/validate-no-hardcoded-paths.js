#!/usr/bin/env node
/**
 * Enforce Node-only runtime: no .sh/.ps1 anywhere in repo, no hardcoded ~/.claude/ in JS.
 * Replaces the former validate-windows-parity check; MDT uses JavaScript/Node only.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '../..');

// Flag only hardcoded *home* .claude paths (not detect-env.js, not path.join(projectDir, '.claude'))
const HARDCODED_HOME_CLAUDE = /path\.join\s*\(\s*(?:homeDir|os\.homedir\(\)|process\.env\.HOME)[^)]*['"]\.claude/;

function isCommentOnly(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

function isExcluded(line) {
  const t = line.trim();
  return isCommentOnly(line) ||
    t.startsWith('console.') ||
    /\.includes\s*\(\s*['"]\.claude/.test(line) ||
    /message\s*\+=/.test(line) ||
    t.startsWith("message +=");
}

function checkNoHardcodedPaths(repoRoot = REPO_ROOT) {
  const errors = [];
  const jsDirs = [
    path.join(repoRoot, 'scripts'),
    path.join(repoRoot, 'skills')
  ];
  const selfRel = path.relative(repoRoot, path.join(__dirname, 'validate-no-hardcoded-paths.js'));
  const detectEnvRel = path.relative(repoRoot, path.join(repoRoot, 'scripts', 'lib', 'detect-env.js'));
  const installMdtRel = path.relative(repoRoot, path.join(repoRoot, 'scripts', 'install-mdt.js'));
  const excluded = new Set([selfRel, detectEnvRel, installMdtRel]);
  for (const dir of jsDirs) {
    if (!fs.existsSync(dir)) continue;
    const walk = (d) => {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(d, e.name);
        const rel = path.relative(repoRoot, full);
        if (e.isDirectory() && e.name !== 'node_modules') walk(full);
        else if (e.isFile() && e.name.endsWith('.js') && !excluded.has(rel)) {
          const content = fs.readFileSync(full, 'utf8');
          const lines = content.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (isCommentOnly(line) || isExcluded(line)) continue;
            if (HARDCODED_HOME_CLAUDE.test(line)) {
              errors.push(`${rel}:${i + 1}: hardcoded home .claude path (use detect-env): ${line.trim().slice(0, 60)}`);
            }
          }
        }
      }
    };
    walk(dir);
  }
  return errors;
}

function checkNoShellScriptsInRepo(repoRoot = REPO_ROOT) {
  const errors = [];
  const dirsToWalk = [repoRoot, path.join(repoRoot, 'scripts')];
  const seen = new Set();
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === 'node_modules') continue;
      const full = path.join(dir, e.name);
      const rel = path.relative(repoRoot, full);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && (e.name.endsWith('.sh') || e.name.endsWith('.ps1'))) {
        if (!seen.has(rel)) {
          seen.add(rel);
          errors.push(rel + ': MDT is Node-only; remove .sh/.ps1 scripts');
        }
      }
    }
  }
  dirsToWalk.forEach(walk);
  return errors;
}

function validateNoHardcodedPaths(options = {}) {
  const repoRoot = options.repoRoot || REPO_ROOT;
  const io = options.io || { log: console.log, error: console.error };
  const noShell = checkNoShellScriptsInRepo(repoRoot);
  const hardcoded = checkNoHardcodedPaths(repoRoot);
  const all = [...noShell, ...hardcoded];
  if (all.length > 0) {
    all.forEach(e => io.error(e));
    return { exitCode: 1, errors: all };
  }
  io.log('Validated Node-only runtime (no .sh/.ps1 in repo, no hardcoded ~/.claude/)');
  return { exitCode: 0, errors: [] };
}

if (require.main === module) {
  const result = validateNoHardcodedPaths();
  process.exit(result.exitCode);
}

module.exports = {
  checkNoHardcodedPaths,
  checkNoShellScriptsInRepo,
  validateNoHardcodedPaths
};

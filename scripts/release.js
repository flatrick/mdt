#!/usr/bin/env node
/**
 * Release script — bump plugin version and tag.
 * Usage: node scripts/release.js VERSION
 * Example: node scripts/release.js 1.5.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const VERSION = process.argv[2];

const FILES = [
  path.join(REPO_ROOT, 'package.json'),
  path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'),
  path.join(REPO_ROOT, '.claude-plugin', 'marketplace.json')
];

function usage() {
  console.error('Usage: node scripts/release.js VERSION');
  console.error('Example: node scripts/release.js 1.5.0');
  process.exit(1);
}

if (!VERSION) {
  console.error('Error: VERSION argument is required');
  usage();
}

if (!/^\d+\.\d+\.\d+$/.test(VERSION)) {
  console.error('Error: VERSION must be semver X.Y.Z (e.g. 1.5.0)');
  process.exit(1);
}

const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
if (branch !== 'main') {
  console.error('Error: Must be on main branch (currently on ' + branch + ')');
  process.exit(1);
}

try {
  execSync('git diff --quiet', { stdio: 'pipe' });
  execSync('git diff --cached --quiet', { stdio: 'pipe' });
} catch {
  console.error('Error: Working tree is not clean. Commit or stash changes first.');
  process.exit(1);
}

for (const file of FILES) {
  if (!fs.existsSync(file)) {
    console.error('Error: ' + path.relative(REPO_ROOT, file) + ' not found');
    process.exit(1);
  }
}

const pluginJson = path.join(REPO_ROOT, '.claude-plugin', 'plugin.json');
const pluginContent = fs.readFileSync(pluginJson, 'utf8');
const oldMatch = pluginContent.match(/"version"\s*:\s*"([^"]+)"/);
const OLD_VERSION = oldMatch ? oldMatch[1] : null;
if (!OLD_VERSION) {
  console.error('Error: Could not read current version from .claude-plugin/plugin.json');
  process.exit(1);
}
console.log('Bumping version: ' + OLD_VERSION + ' -> ' + VERSION);

for (const file of FILES) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/"version"\s*:\s*"[^"]*"/, '"version": "' + VERSION + '"');
  fs.writeFileSync(file, content, 'utf8');
}

execSync('git add ' + FILES.map(f => path.relative(REPO_ROOT, f)).join(' '), { cwd: REPO_ROOT });
execSync('git commit -m "chore: bump plugin version to ' + VERSION + '"', { cwd: REPO_ROOT });
execSync('git tag "v' + VERSION + '"', { cwd: REPO_ROOT });
execSync('git push origin main "v' + VERSION + '"', { cwd: REPO_ROOT });

console.log('Released v' + VERSION);

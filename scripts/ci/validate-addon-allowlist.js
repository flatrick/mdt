#!/usr/bin/env node
/**
 * Validate that template add-on directories (e.g. codex-template/skills/<name>/)
 * contain only allowlisted entries: metadata, docs, config, agents/, rules/.
 * No scripts/ or other runtime trees. See docs/install-addon-config-contracts.md.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');

const ALLOWED_FILES = new Set(['skill.meta.json', 'SKILL.md', 'STYLE_PRESETS.md', 'config.json']);
const ALLOWED_DIRS = new Set(['agents', 'rules']);

function validateAddonDir(dirPath, relativeLabel, errors) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const e of entries) {
    if (e.isFile()) {
      if (!ALLOWED_FILES.has(e.name)) {
        errors.push(`${relativeLabel}: disallowed file "${e.name}" (allowed: ${[...ALLOWED_FILES].join(', ')})`);
      }
    } else if (e.isDirectory()) {
      if (!ALLOWED_DIRS.has(e.name)) {
        errors.push(`${relativeLabel}: disallowed directory "${e.name}/" (allowed: ${[...ALLOWED_DIRS].join('/')})`);
      }
    }
  }
}

function validateAddonAllowlist(repoRoot = REPO_ROOT, io = { log: console.log, error: console.error }) {
  const errors = [];
  const templateDirs = [
    path.join(repoRoot, 'codex-template', 'skills'),
    path.join(repoRoot, 'cursor-template', 'skills')
  ];
  for (const templateDir of templateDirs) {
    if (!fs.existsSync(templateDir)) continue;
    const addonNames = fs.readdirSync(templateDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    for (const name of addonNames) {
      const addonPath = path.join(templateDir, name);
      const label = path.relative(repoRoot, addonPath);
      validateAddonDir(addonPath, label, errors);
    }
  }
  if (errors.length > 0) {
    for (const e of errors) io.error(`ERROR: ${e}`);
    return { exitCode: 1, errors };
  }
  io.log('Validated template add-on allowlist');
  return { exitCode: 0 };
}

function runCli(io = { log: console.log, error: console.error }) {
  return validateAddonAllowlist(REPO_ROOT, io);
}

if (require.main === module) {
  const result = runCli();
  process.exit(result.exitCode);
}

module.exports = { validateAddonAllowlist, runCli };

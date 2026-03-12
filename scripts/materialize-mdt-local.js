#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
  recordBridgeDecision,
  detectRepoRoot
} = require('./lib/mdt-state');

const REPO_ROOT = path.join(__dirname, '..');
const CURSOR_RULES_SRC = path.join(REPO_ROOT, 'cursor-template', 'rules');

function parseArgs(args) {
  let target = 'cursor';
  let surface = null;
  let repoDir = process.cwd();
  let overrideDir = null;
  const packageNames = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--target' && args[i + 1]) {
      target = args[++i];
    } else if (arg === '--surface' && args[i + 1]) {
      surface = args[++i];
    } else if (arg === '--repo' && args[i + 1]) {
      repoDir = path.resolve(args[++i]);
    } else if (arg === '--override' && args[i + 1]) {
      overrideDir = path.resolve(args[++i]);
    } else if (!arg.startsWith('-')) {
      packageNames.push(arg);
    }
  }

  return { target, surface, repoDir, overrideDir, packageNames };
}

function usage() {
  console.error('Usage: node scripts/materialize-mdt-local.js --target cursor --surface rules [--repo <path>] [--override <tool-config-dir>] [package ...]');
  console.error('');
  console.error('Purpose: materialize repo-local .cursor/rules/ files for Cursor IDE.');
  console.error('Use install-mdt.js --target cursor for the global ~/.cursor/ install used by cursor-agent.');
  console.error('If package names are omitted, the script copies the currently installed global Cursor rules from ~/.cursor/rules/ into the current repo.');
  process.exit(1);
}

function resolveCursorConfigDir(overrideDir, env = process.env) {
  if (overrideDir) {
    return path.resolve(overrideDir);
  }

  const configDir = (env.CONFIG_DIR || '').trim();
  if (configDir) {
    return path.resolve(configDir);
  }

  const homeDir = env.HOME || env.USERPROFILE || process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    throw new Error('Unable to resolve Cursor config dir: HOME/USERPROFILE is not set.');
  }

  return path.join(homeDir, '.cursor');
}

function copyInstalledCursorRules(repoDir, options = {}) {
  const resolvedRepoDir = detectRepoRoot(repoDir);
  const cursorConfigDir = resolveCursorConfigDir(options.overrideDir, options.env);
  const sourceDir = options.sourceDir
    ? path.resolve(options.sourceDir)
    : path.join(cursorConfigDir, 'rules');
  const destDir = path.join(resolvedRepoDir, '.cursor', 'rules');

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Cursor global rules directory does not exist: ${sourceDir}`);
  }

  const copied = [];
  fs.mkdirSync(destDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    if (!/\.(md|mdc)$/i.test(entry.name)) {
      continue;
    }

    const srcPath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    fs.copyFileSync(srcPath, destPath);
    copied.push(entry.name);
  }

  if (copied.length === 0) {
    throw new Error(`No Cursor rule files found in ${sourceDir}`);
  }

  return {
    mode: 'installed-global',
    repoDir: resolvedRepoDir,
    sourceDir,
    destDir,
    copied: copied.sort()
  };
}

function materializeCursorRules(repoDir, packageNames) {
  let resolveSelectedPackages;
  try {
    ({ resolveSelectedPackages } = require('./install-mdt'));
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        'Package-selection mode requires scripts/install-mdt.js. Use the no-package installed-global mode from ~/.cursor/rules/ when running from an installed Cursor bridge.'
      );
    }
    throw error;
  }

  const resolvedRepoDir = detectRepoRoot(repoDir);
  const destDir = path.join(resolvedRepoDir, '.cursor', 'rules');
  const selectedPackages = resolveSelectedPackages(packageNames);
  const copied = new Set();

  fs.mkdirSync(destDir, { recursive: true });

  for (const selectedPackage of selectedPackages) {
    const cursorRules = Array.isArray(selectedPackage.tools.cursor?.rules)
      ? selectedPackage.tools.cursor.rules
      : [];

    for (const ruleFile of cursorRules) {
      const srcPath = path.join(CURSOR_RULES_SRC, ruleFile);
      const destPath = path.join(destDir, ruleFile);
      if (!fs.existsSync(srcPath)) {
        console.error(`Warning: Cursor rule '${ruleFile}' for package '${selectedPackage.name}' does not exist, skipping.`);
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
      copied.add(ruleFile);
    }
  }

  return {
    mode: 'package-selection',
    repoDir: resolvedRepoDir,
    destDir,
    copied: [...copied].sort()
  };
}

function main() {
  const { target, surface, repoDir, overrideDir, packageNames } = parseArgs(process.argv.slice(2));
  if (!surface) {
    usage();
  }

  if (overrideDir) {
    fs.mkdirSync(overrideDir, { recursive: true });
    process.env.CONFIG_DIR = overrideDir;
  }

  if (target !== 'cursor' || surface !== 'rules') {
    console.error(`Error: unsupported bridge target '${target}' + surface '${surface}'.`);
    process.exit(1);
  }

  const result = packageNames.length > 0
    ? materializeCursorRules(repoDir, packageNames)
    : copyInstalledCursorRules(repoDir, { overrideDir });
  recordBridgeDecision({
    repoRoot: result.repoDir,
    surface: `${target}.${surface}`,
    decision: 'installed'
  });

  console.log(`Materialized ${target}.${surface} bridge into ${result.destDir}`);
  console.log('This bridge is for repo-local Cursor IDE rules, not the global cursor-agent install surface.');
  if (result.mode === 'installed-global') {
    console.log(`Copied currently installed global Cursor rules from ${result.sourceDir}`);
  }
  if (result.copied.length > 0) {
    console.log(`Copied ${result.copied.length} files: ${result.copied.join(', ')}`);
  } else {
    console.log('No bridge files were copied.');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  copyInstalledCursorRules,
  materializeCursorRules,
  resolveCursorConfigDir
};

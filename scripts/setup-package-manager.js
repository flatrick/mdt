#!/usr/bin/env node
/**
 * Package Manager Setup Script
 *
 * Can be executed as a CLI or imported for direct testing.
 */

const packageManagerLib = require('./lib/package-manager');

const HELP_TEXT = `
Package Manager Setup for MDT

Usage:
  node scripts/setup-package-manager.js [options] [package-manager]

Options:
  --detect        Detect and show current package manager
  --global <pm>   Set global preference (saves to your config dir/mdt/package-manager.json)
  --project <pm>  Set project preference (saves to .claude/package-manager.json)
  --list          List available package managers
  --help          Show this help message

Package Managers:
  npm             Node Package Manager (default with Node.js)
  pnpm            Fast, disk space efficient package manager
  yarn            Classic Yarn package manager
  bun             All-in-one JavaScript runtime & toolkit

Examples:
  # Detect current package manager
  node scripts/setup-package-manager.js --detect

  # Set pnpm as global preference
  node scripts/setup-package-manager.js --global pnpm

  # Set bun for current project
  node scripts/setup-package-manager.js --project bun

  # List available package managers
  node scripts/setup-package-manager.js --list
`;

function createIo(io = {}) {
  return {
    log: io.log || ((msg = '') => console.log(msg)),
    error: io.error || ((msg = '') => console.error(msg)),
    warn: io.warn || ((msg = '') => console.warn(msg))
  };
}

function withCwd(cwd, fn) {
  if (!cwd || cwd === process.cwd()) {
    return fn();
  }
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return fn();
  } finally {
    process.chdir(previous);
  }
}

function showHelp(io) {
  io.log(HELP_TEXT);
}

function detectAndShow(io, deps, env) {
  const pm = deps.getPackageManager();
  const available = deps.getAvailablePackageManagers();
  const fromLock = deps.detectFromLockFile();
  const fromPkg = deps.detectFromPackageJson();

  io.log('\n=== Package Manager Detection ===\n');
  io.log('Current selection:');
  io.log(`  Package Manager: ${pm.name}`);
  io.log(`  Source: ${pm.source}`);
  io.log('');
  io.log('Detection results:');
  io.log(`  From package.json: ${fromPkg || 'not specified'}`);
  io.log(`  From lock file: ${fromLock || 'not found'}`);
  io.log(`  Environment var: ${env.CLAUDE_PACKAGE_MANAGER || 'not set'}`);
  io.log('');
  io.log('Available package managers:');
  for (const pmName of Object.keys(deps.PACKAGE_MANAGERS)) {
    const installed = available.includes(pmName);
    const indicator = installed ? '✓' : '✗';
    const current = pmName === pm.name ? ' (current)' : '';
    io.log(`  ${indicator} ${pmName}${current}`);
  }
  io.log('');
  io.log('Commands:');
  io.log(`  Install: ${pm.config.installCmd}`);
  io.log(`  Run script: ${pm.config.runCmd} [script-name]`);
  io.log(`  Execute binary: ${pm.config.execCmd} [binary-name]`);
  io.log('');
}

function listAvailable(io, deps) {
  const available = deps.getAvailablePackageManagers();
  const pm = deps.getPackageManager();

  io.log('\nAvailable Package Managers:\n');
  for (const pmName of Object.keys(deps.PACKAGE_MANAGERS)) {
    const config = deps.PACKAGE_MANAGERS[pmName];
    const installed = available.includes(pmName);
    const current = pmName === pm.name ? ' (current)' : '';

    io.log(`${pmName}${current}`);
    io.log(`  Installed: ${installed ? 'Yes' : 'No'}`);
    io.log(`  Lock file: ${config.lockFile}`);
    io.log(`  Install: ${config.installCmd}`);
    io.log(`  Run: ${config.runCmd}`);
    io.log('');
  }
}

function setGlobal(pmName, io, deps) {
  if (!deps.PACKAGE_MANAGERS[pmName]) {
    io.error(`Error: Unknown package manager "${pmName}"`);
    io.error(`Available: ${Object.keys(deps.PACKAGE_MANAGERS).join(', ')}`);
    return 1;
  }

  const available = deps.getAvailablePackageManagers();
  if (!available.includes(pmName)) {
    io.warn(`Warning: ${pmName} is not installed on your system`);
  }

  try {
    deps.setPreferredPackageManager(pmName);
    io.log(`\n✓ Global preference set to: ${pmName}`);
    io.log('  Saved to: <config>/mdt/package-manager.json');
    io.log('');
    return 0;
  } catch (err) {
    io.error(`Error: ${err.message}`);
    return 1;
  }
}

function setProject(pmName, io, deps, cwd) {
  if (!deps.PACKAGE_MANAGERS[pmName]) {
    io.error(`Error: Unknown package manager "${pmName}"`);
    io.error(`Available: ${Object.keys(deps.PACKAGE_MANAGERS).join(', ')}`);
    return 1;
  }

  try {
    withCwd(cwd, () => deps.setProjectPackageManager(pmName));
    io.log(`\n✓ Project preference set to: ${pmName}`);
    io.log('  Saved to: .claude/package-manager.json');
    io.log('');
    return 0;
  } catch (err) {
    io.error(`Error: ${err.message}`);
    return 1;
  }
}

function getArgForFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1];
}

function runSimpleModes(args, io, deps, env) {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp(io);
    return 0;
  }
  if (args.includes('--detect')) {
    detectAndShow(io, deps, env);
    return 0;
  }
  if (args.includes('--list')) {
    listAvailable(io, deps);
    return 0;
  }
  return null;
}

function runScopedMode(args, io, deps, cwd) {
  const globalPm = getArgForFlag(args, '--global');
  if (globalPm !== null) {
    if (!globalPm || globalPm.startsWith('-')) {
      io.error('Error: --global requires a package manager name');
      return 1;
    }
    return setGlobal(globalPm, io, deps);
  }

  const projectPm = getArgForFlag(args, '--project');
  if (projectPm !== null) {
    if (!projectPm || projectPm.startsWith('-')) {
      io.error('Error: --project requires a package manager name');
      return 1;
    }
    return setProject(projectPm, io, deps, cwd);
  }

  return null;
}

function runDefaultMode(args, io, deps) {
  const pmName = args[0];
  if (deps.PACKAGE_MANAGERS[pmName]) {
    return setGlobal(pmName, io, deps);
  }
  io.error(`Error: Unknown option or package manager "${pmName}"`);
  showHelp(io);
  return 1;
}

function runSetupPackageManager(args = [], options = {}) {
  const deps = options.deps || packageManagerLib;
  const env = options.env || process.env;
  const cwd = options.cwd || process.cwd();
  const io = createIo(options.io);

  const simpleModeExitCode = runSimpleModes(args, io, deps, env);
  if (simpleModeExitCode !== null) return simpleModeExitCode;

  const scopedModeExitCode = runScopedMode(args, io, deps, cwd);
  if (scopedModeExitCode !== null) return scopedModeExitCode;

  return runDefaultMode(args, io, deps);
}

if (require.main === module) {
  const exitCode = runSetupPackageManager(process.argv.slice(2));
  process.exit(exitCode);
}

module.exports = {
  HELP_TEXT,
  runSetupPackageManager
};

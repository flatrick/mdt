/**
 * Package Manager Detection and Selection
 * Automatically detects the preferred package manager or lets user choose
 *
 * Supports: npm, pnpm, yarn, bun
 */

const fs = require('fs');
const path = require('path');
const { commandExists, getDataDir, readFile, writeFile } = require('./utils');

// Package manager definitions
const PACKAGE_MANAGERS = {
  npm: {
    name: 'npm',
    lockFile: 'package-lock.json',
    installCmd: 'npm install',
    runCmd: 'npm run',
    execCmd: 'npx',
    testCmd: 'npm test',
    buildCmd: 'npm run build',
    devCmd: 'npm run dev'
  },
  pnpm: {
    name: 'pnpm',
    lockFile: 'pnpm-lock.yaml',
    installCmd: 'pnpm install',
    runCmd: 'pnpm',
    execCmd: 'pnpm dlx',
    testCmd: 'pnpm test',
    buildCmd: 'pnpm build',
    devCmd: 'pnpm dev'
  },
  yarn: {
    name: 'yarn',
    lockFile: 'yarn.lock',
    installCmd: 'yarn',
    runCmd: 'yarn',
    execCmd: 'yarn dlx',
    testCmd: 'yarn test',
    buildCmd: 'yarn build',
    devCmd: 'yarn dev'
  },
  bun: {
    name: 'bun',
    lockFile: 'bun.lockb',
    installCmd: 'bun install',
    runCmd: 'bun run',
    execCmd: 'bunx',
    testCmd: 'bun test',
    buildCmd: 'bun run build',
    devCmd: 'bun run dev'
  }
};

// Priority order for detection
const DETECTION_PRIORITY = ['pnpm', 'bun', 'yarn', 'npm'];

// Config file path
function getConfigPath() {
  return path.join(getDataDir(), 'package-manager.json');
}

/**
 * Load saved package manager configuration
 */
function loadConfig() {
  const configPath = getConfigPath();
  const content = readFile(configPath);

  if (content) {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Save package manager configuration
 */
function saveConfig(config) {
  const configPath = getConfigPath();
  writeFile(configPath, JSON.stringify(config, null, 2));
}

/**
 * Detect package manager from lock file in project directory
 */
function detectFromLockFile(projectDir = process.cwd()) {
  for (const pmName of DETECTION_PRIORITY) {
    const pm = PACKAGE_MANAGERS[pmName];
    const lockFilePath = path.join(projectDir, pm.lockFile);

    if (fs.existsSync(lockFilePath)) {
      return pmName;
    }
  }
  return null;
}

/**
 * Detect package manager from package.json packageManager field
 */
function detectFromPackageJson(projectDir = process.cwd()) {
  const packageJsonPath = path.join(projectDir, 'package.json');
  const content = readFile(packageJsonPath);

  if (content) {
    try {
      const pkg = JSON.parse(content);
      if (pkg.packageManager) {
        // Format: "pnpm@8.6.0" or just "pnpm"
        const pmName = pkg.packageManager.split('@')[0];
        if (PACKAGE_MANAGERS[pmName]) {
          return pmName;
        }
      }
    } catch {
      // Invalid package.json
    }
  }
  return null;
}

/**
 * Get available package managers (installed on system)
 *
 * WARNING: This spawns child processes (where.exe on Windows, which on Unix)
 * for each package manager. Do NOT call this during session startup hooks —
 * it can exceed Bun's spawn limit on Windows and freeze the plugin.
 * Use detectFromLockFile() or detectFromPackageJson() for hot paths.
 */
function getAvailablePackageManagers() {
  const available = [];

  for (const pmName of Object.keys(PACKAGE_MANAGERS)) {
    if (commandExists(pmName)) {
      available.push(pmName);
    }
  }

  return available;
}

function toPackageManagerResult(name, source) {
  return {
    name,
    config: PACKAGE_MANAGERS[name],
    source
  };
}

function getConfiguredPackageManager(config) {
  if (!config || !config.packageManager) return null;
  if (!PACKAGE_MANAGERS[config.packageManager]) return null;
  return config.packageManager;
}

function readJsonConfig(configPath) {
  const content = readFile(configPath);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get the package manager to use for current project
 *
 * Detection priority:
 * 1. Environment variable CLAUDE_PACKAGE_MANAGER
 * 2. Project-specific config (in .claude/package-manager.json)
 * 3. package.json packageManager field
 * 4. Lock file detection
 * 5. Global user preference (in the active MDT data dir's package-manager.json, for example <config>/mdt/package-manager.json)
 * 6. Default to npm (no child processes spawned)
 *
 * @param {object} options - Options
 * @param {string} options.projectDir - Project directory to detect from (default: cwd)
 * @returns {object} - { name, config, source }
 */
function getPackageManager(options = {}) {
  const { projectDir = process.cwd() } = options;

  const envPm = process.env.CLAUDE_PACKAGE_MANAGER;
  if (envPm && PACKAGE_MANAGERS[envPm]) {
    return toPackageManagerResult(envPm, 'environment');
  }

  const projectConfigPath = path.join(projectDir, '.claude', 'package-manager.json');
  const projectPm = getConfiguredPackageManager(readJsonConfig(projectConfigPath));
  if (projectPm) {
    return toPackageManagerResult(projectPm, 'project-config');
  }

  const fromPackageJson = detectFromPackageJson(projectDir);
  if (fromPackageJson) {
    return toPackageManagerResult(fromPackageJson, 'package.json');
  }

  const fromLockFile = detectFromLockFile(projectDir);
  if (fromLockFile) {
    return toPackageManagerResult(fromLockFile, 'lock-file');
  }

  const globalPm = getConfiguredPackageManager(loadConfig());
  if (globalPm) {
    return toPackageManagerResult(globalPm, 'global-config');
  }

  return toPackageManagerResult('npm', 'default');
}

/**
 * Set user's preferred package manager (global)
 */
function setPreferredPackageManager(pmName) {
  if (!PACKAGE_MANAGERS[pmName]) {
    throw new Error(`Unknown package manager: ${pmName}`);
  }

  const config = loadConfig() || {};
  config.packageManager = pmName;
  config.setAt = new Date().toISOString();

  try {
    saveConfig(config);
  } catch (err) {
    throw new Error(`Failed to save package manager preference: ${err.message}`);
  }

  return config;
}

/**
 * Set project's preferred package manager
 */
function setProjectPackageManager(pmName, projectDir = process.cwd()) {
  if (!PACKAGE_MANAGERS[pmName]) {
    throw new Error(`Unknown package manager: ${pmName}`);
  }

  const configDir = path.join(projectDir, '.claude');
  const configPath = path.join(configDir, 'package-manager.json');

  const config = {
    packageManager: pmName,
    setAt: new Date().toISOString()
  };

  try {
    writeFile(configPath, JSON.stringify(config, null, 2));
  } catch (err) {
    throw new Error(`Failed to save package manager config to ${configPath}: ${err.message}`);
  }
  return config;
}

// Allowed characters in script/binary names: alphanumeric, dash, underscore, dot, slash, @
// This prevents shell metacharacter injection while allowing scoped packages (e.g., @scope/pkg)
const SAFE_NAME_REGEX = /^[@a-zA-Z0-9_./-]+$/;

function isSafeName(name) {
  if (!SAFE_NAME_REGEX.test(name)) {
    return false;
  }
  if (/\.\./.test(name) || name.startsWith('/')) {
    return false;
  }
  return true;
}

/**
 * Get the command to run a script
 * @param {string} script - Script name (e.g., "dev", "build", "test")
 * @param {object} options - { projectDir }
 * @throws {Error} If script name contains unsafe characters
 */
function getRunCommand(script, options = {}) {
  if (!script || typeof script !== 'string') {
    throw new Error('Script name must be a non-empty string');
  }
  if (!isSafeName(script)) {
    throw new Error(`Script name contains unsafe characters: ${script}`);
  }

  const pm = getPackageManager(options);

  switch (script) {
    case 'install':
      return pm.config.installCmd;
    case 'test':
      return pm.config.testCmd;
    case 'build':
      return pm.config.buildCmd;
    case 'dev':
      return pm.config.devCmd;
    default:
      return `${pm.config.runCmd} ${script}`;
  }
}

// Allowed characters in arguments: alphanumeric, space/tab, dashes, dots, slashes,
// equals, colons, commas, quotes, @. Rejects shell metacharacters like ; | & ` $ ( ) { } < > !
const SAFE_ARGS_REGEX = /^[@a-zA-Z0-9 \t_./:=,'"*+-]+$/;

/**
 * Get the command to execute a package binary
 * @param {string} binary - Binary name (e.g., "prettier", "eslint")
 * @param {string} args - Arguments to pass
 * @throws {Error} If binary name or args contain unsafe characters
 */
function getExecCommand(binary, args = '', options = {}) {
  if (!binary || typeof binary !== 'string') {
    throw new Error('Binary name must be a non-empty string');
  }
  if (!isSafeName(binary)) {
    throw new Error(`Binary name contains unsafe characters: ${binary}`);
  }
  if (args && typeof args !== 'string') {
    throw new Error('args must be a string');
  }
  if (args && !SAFE_ARGS_REGEX.test(args)) {
    throw new Error(`Arguments contain unsafe characters: ${args}`);
  }

  const pm = getPackageManager(options);
  return `${pm.config.execCmd} ${binary}${args ? ' ' + args : ''}`;
}

/**
 * Interactive prompt for package manager selection
 * Returns a message for Claude to show to user
 *
 * NOTE: Does NOT spawn child processes to check availability.
 * Lists all supported PMs and shows how to configure preference.
 */
function getSelectionPrompt() {
  let message = '[PackageManager] No package manager preference detected.\n';
  message += 'Supported package managers: ' + Object.keys(PACKAGE_MANAGERS).join(', ') + '\n';
  message += '\nTo set your preferred package manager:\n';
  message += '  - Global: Set CLAUDE_PACKAGE_MANAGER environment variable\n';
  message += '  - Or add to your config dir/mdt/package-manager.json (for example <config>/mdt/package-manager.json)\n';
  message += '  - Or add to package.json: {"packageManager": "pnpm@8"}\n';
  message += '  - Or add a lock file to your project (e.g., pnpm-lock.yaml)\n';

  return message;
}

// Escape regex metacharacters in a string before interpolating into a pattern
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate a regex pattern that matches commands for all package managers
 * @param {string} action - Action pattern (e.g., "run dev", "install", "test")
 */
function getCommandPattern(action) {
  const patterns = [];

  // Trim spaces from action to handle leading/trailing whitespace gracefully
  const trimmedAction = action.trim();

  if (trimmedAction === 'dev') {
    patterns.push(
      'npm run dev',
      'pnpm( run)? dev',
      'yarn dev',
      'bun run dev'
    );
  } else if (trimmedAction === 'install') {
    patterns.push(
      'npm install',
      'pnpm install',
      'yarn( install)?',
      'bun install'
    );
  } else if (trimmedAction === 'test') {
    patterns.push(
      'npm test',
      'pnpm test',
      'yarn test',
      'bun test'
    );
  } else if (trimmedAction === 'build') {
    patterns.push(
      'npm run build',
      'pnpm( run)? build',
      'yarn build',
      'bun run build'
    );
  } else {
    // Generic run command — escape regex metacharacters in action
    const escaped = escapeRegex(trimmedAction);
    patterns.push(
      `npm run ${escaped}`,
      `pnpm( run)? ${escaped}`,
      `yarn ${escaped}`,
      `bun run ${escaped}`
    );
  }

  return `(${patterns.join('|')})`;
}

module.exports = {
  PACKAGE_MANAGERS,
  DETECTION_PRIORITY,
  getPackageManager,
  setPreferredPackageManager,
  setProjectPackageManager,
  getAvailablePackageManagers,
  detectFromLockFile,
  detectFromPackageJson,
  getRunCommand,
  getExecCommand,
  getSelectionPrompt,
  getCommandPattern
};

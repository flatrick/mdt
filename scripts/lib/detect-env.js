/**
 * Environment detection and path resolution for ModelDev Toolkit.
 *
 * Responsibilities:
 * - Detect running tool (Cursor, Claude Code, unknown)
 * - Resolve config and data directories with sensible fallbacks
 * - Detect platform (Windows, WSL, Linux, macOS)
 * - Provide derived paths (skills, hooks, homunculus)
 * - Resolve a stable session ID for logging/observations
 *
 * Design notes:
 * - No side effects on require: no directories created, no files written,
 *   no environment variables modified.
 * - All filesystem access is read-only (existsSync / readFileSync).
 * - Detection is cached per-instance so repeated calls are cheap.
 * - A factory is exposed so tests can inject env, homedir, and fs helpers.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Create a detect-env instance with optional overrides for testing.
 *
 * @param {object} overrides
 * @param {NodeJS.ProcessEnv} [overrides.env] - Environment variables
 * @param {string} [overrides.platform] - process.platform override
 * @param {() => string} [overrides.homedir] - os.homedir override
 * @param {(p: string) => boolean} [overrides.existsSync] - fs.existsSync override
 * @param {(p: string, enc: string) => string} [overrides.readFileSync] - fs.readFileSync override
 * @param {(msg: string) => void} [overrides.logWarn] - warning logger (defaults to console.error)
 * @returns {object} detect-env API
 */
function createDetectEnv(overrides = {}) {
  const env = overrides.env || process.env;
  const platform = overrides.platform || process.platform;
  const homedirFn = overrides.homedir || os.homedir;
  const existsSync = overrides.existsSync || fs.existsSync;
  const readFileSync = overrides.readFileSync || fs.readFileSync;
  const logWarn = overrides.logWarn || ((msg) => console.error(msg));

  const cache = {
    tool: null,
    configDir: null,
    dataDir: null,
    platformInfo: null,
    sessionId: null
  };

  function detectTool() {
    if (cache.tool) return cache.tool;

    // Cursor wins if both Cursor and Claude signals are present
    if (env.CURSOR_AGENT === '1') {
      cache.tool = 'cursor';
      return cache.tool;
    }

    if (env.CLAUDE_SESSION_ID && env.CLAUDE_SESSION_ID.length > 0) {
      cache.tool = 'claude';
      return cache.tool;
    }

    if (env.CLAUDE_CODE === '1') {
      cache.tool = 'claude';
      return cache.tool;
    }

    cache.tool = 'unknown';
    return cache.tool;
  }

  function getHomeDir() {
    // Centralized homedir so tests can override it
    return homedirFn();
  }

  function resolveConfigDir() {
    if (cache.configDir) return cache.configDir;

    const tool = detectTool();
    const homeDir = getHomeDir();

    // 1) Explicit override via CONFIG_DIR
    const explicit = env.CONFIG_DIR;
    if (explicit && typeof explicit === 'string' && explicit.trim().length > 0) {
      if (existsSync(explicit)) {
        cache.configDir = explicit;
        return cache.configDir;
      }

      // CONFIG_DIR set but path does not exist: fall back based on tool, log warning
      logWarn(
        `[detect-env] CONFIG_DIR is set to '${explicit}' but does not exist; falling back based on tool='${tool}'`
      );
    }

    // 2) Tool-specific defaults
    if (tool === 'cursor') {
      cache.configDir = path.join(homeDir, '.cursor');
      return cache.configDir;
    }

    if (tool === 'claude') {
      cache.configDir = path.join(homeDir, '.claude');
      return cache.configDir;
    }

    // 3) Unknown tool: inspect existing config directories
    const cursorSkillsDir = path.join(homeDir, '.cursor', 'skills');
    const claudeSkillsDir = path.join(homeDir, '.claude', 'skills');

    if (existsSync(cursorSkillsDir)) {
      cache.configDir = path.join(homeDir, '.cursor');
      return cache.configDir;
    }

    if (existsSync(claudeSkillsDir)) {
      cache.configDir = path.join(homeDir, '.claude');
      return cache.configDir;
    }

    // 4) Default when nothing exists: bias to Cursor to match newer tooling
    cache.configDir = path.join(homeDir, '.cursor');
    return cache.configDir;
  }

  function resolveDataDir() {
    if (cache.dataDir) return cache.dataDir;

    const homeDir = getHomeDir();
    const configDir = resolveConfigDir();

    // 1) Explicit override via DATA_DIR
    const explicit = env.DATA_DIR;
    if (explicit && typeof explicit === 'string' && explicit.trim().length > 0) {
      if (existsSync(explicit)) {
        cache.dataDir = explicit;
        return cache.dataDir;
      }

      logWarn(
        `[detect-env] DATA_DIR is set to '${explicit}' but does not exist; falling back based on configDir='${configDir}'`
      );
    }

    // 2) Homunculus co-located with config
    const configHomunculusDir = path.join(configDir, 'homunculus');
    if (existsSync(configHomunculusDir)) {
      cache.dataDir = configDir;
      return cache.dataDir;
    }

    // 3) Legacy Claude Code data
    const legacyClaudeHomunculusDir = path.join(homeDir, '.claude', 'homunculus');
    if (existsSync(legacyClaudeHomunculusDir)) {
      cache.dataDir = path.join(homeDir, '.claude');
      return cache.dataDir;
    }

    // 4) Fresh install, no data anywhere → colocate data with config
    cache.dataDir = configDir;
    return cache.dataDir;
  }

  function detectPlatform() {
    if (cache.platformInfo) return cache.platformInfo;

    const info = {
      isWindows: platform === 'win32',
      isMacOS: platform === 'darwin',
      isLinux: platform === 'linux',
      isWSL: false
    };

    // WSL detection: linux kernel with "microsoft" in /proc/version
    if (info.isLinux) {
      try {
        const procVersion = readFileSync('/proc/version', 'utf8');
        if (procVersion && /microsoft/i.test(procVersion)) {
          info.isWSL = true;
        }
      } catch {
        // If /proc/version is missing or unreadable, treat as generic Linux
      }
    }

    cache.platformInfo = info;
    return cache.platformInfo;
  }

  function resolveSessionId() {
    if (cache.sessionId) return cache.sessionId;

    if (env.CLAUDE_SESSION_ID && env.CLAUDE_SESSION_ID.length > 0) {
      cache.sessionId = env.CLAUDE_SESSION_ID;
      return cache.sessionId;
    }

    if (env.CURSOR_TRACE_ID && env.CURSOR_TRACE_ID.length > 0) {
      cache.sessionId = env.CURSOR_TRACE_ID;
      return cache.sessionId;
    }

    // No external signals: generate a stable, process-local ID
    // Use a timestamp + random suffix to reduce collision risk across processes.
    const rand = Math.random().toString(16).slice(2, 10);
    cache.sessionId = `sess-${Date.now().toString(16)}-${rand}`;
    return cache.sessionId;
  }

  function getDerivedPaths() {
    const configDir = resolveConfigDir();
    const dataDir = resolveDataDir();

    return {
      configDir,
      dataDir,
      skillsDir: path.join(configDir, 'skills'),
      hooksDir: path.join(configDir, 'hooks'),
      homunculusDir: path.join(dataDir, 'homunculus')
    };
  }

  // Public API
  return {
    // Core detection
    getTool: detectTool,
    getConfigDir: resolveConfigDir,
    getDataDir: resolveDataDir,
    getSessionId: resolveSessionId,
    getPlatformInfo: detectPlatform,
    getPaths: getDerivedPaths,

    // Cached properties for convenience
    get tool() {
      return detectTool();
    },
    get configDir() {
      return resolveConfigDir();
    },
    get dataDir() {
      return resolveDataDir();
    },
    get sessionId() {
      return resolveSessionId();
    },
    get isWindows() {
      return detectPlatform().isWindows;
    },
    get isMacOS() {
      return detectPlatform().isMacOS;
    },
    get isLinux() {
      return detectPlatform().isLinux;
    },
    get isWSL() {
      return detectPlatform().isWSL;
    }
  };
}

// Default singleton instance for production code
const detectEnv = createDetectEnv();

module.exports = {
  createDetectEnv,
  detectEnv
};


/**
 * Environment detection and path resolution for ModelDev Toolkit.
 *
 * Responsibilities:
 * - Detect running tool (Cursor, Claude Code, Codex, unknown)
 * - Resolve config and data directories with sensible fallbacks
 * - Detect platform (Windows, WSL, Linux, macOS)
 * - Provide derived paths (skills, hooks, homunculus)
 * - Resolve a stable session ID for logging/observations
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

function createContext(overrides = {}) {
  return {
    env: overrides.env || process.env,
    platform: overrides.platform || process.platform,
    homedirFn: overrides.homedir || os.homedir,
    existsSync: overrides.existsSync || fs.existsSync,
    readFileSync: overrides.readFileSync || fs.readFileSync,
    logWarn: overrides.logWarn || ((msg) => console.error(msg)),
    cache: {
      tool: null,
      configDir: null,
      dataDir: null,
      platformInfo: null,
      sessionId: null
    }
  };
}

function getHomeDir(ctx) {
  return ctx.homedirFn();
}

function detectTool(ctx) {
  if (ctx.cache.tool) return ctx.cache.tool;

  if (ctx.env.CURSOR_AGENT === '1') {
    ctx.cache.tool = 'cursor';
    return ctx.cache.tool;
  }
  if (ctx.env.CLAUDE_SESSION_ID && ctx.env.CLAUDE_SESSION_ID.length > 0) {
    ctx.cache.tool = 'claude';
    return ctx.cache.tool;
  }
  if (ctx.env.CLAUDE_CODE === '1') {
    ctx.cache.tool = 'claude';
    return ctx.cache.tool;
  }
  if (ctx.env.CODEX_AGENT === '1') {
    ctx.cache.tool = 'codex';
    return ctx.cache.tool;
  }

  ctx.cache.tool = 'unknown';
  return ctx.cache.tool;
}

function getExplicitDirValue(ctx, key) {
  const explicit = ctx.env[key];
  if (explicit && typeof explicit === 'string' && explicit.trim().length > 0) {
    return explicit;
  }
  return null;
}

function resolveConfigDir(ctx) {
  if (ctx.cache.configDir) return ctx.cache.configDir;

  const tool = detectTool(ctx);
  const homeDir = getHomeDir(ctx);
  const explicit = getExplicitDirValue(ctx, 'CONFIG_DIR');

  if (explicit && ctx.existsSync(explicit)) {
    ctx.cache.configDir = explicit;
    return ctx.cache.configDir;
  }

  if (explicit) {
    ctx.logWarn(
      `[detect-env] CONFIG_DIR is set to '${explicit}' but does not exist; falling back based on tool='${tool}'`
    );
  }

  if (tool === 'cursor') {
    ctx.cache.configDir = path.join(homeDir, '.cursor');
    return ctx.cache.configDir;
  }
  if (tool === 'claude') {
    ctx.cache.configDir = path.join(homeDir, '.claude');
    return ctx.cache.configDir;
  }
  if (tool === 'codex') {
    ctx.cache.configDir = path.join(homeDir, '.codex');
    return ctx.cache.configDir;
  }

  const cursorSkillsDir = path.join(homeDir, '.cursor', 'skills');
  if (ctx.existsSync(cursorSkillsDir)) {
    ctx.cache.configDir = path.join(homeDir, '.cursor');
    return ctx.cache.configDir;
  }

  const claudeSkillsDir = path.join(homeDir, '.claude', 'skills');
  if (ctx.existsSync(claudeSkillsDir)) {
    ctx.cache.configDir = path.join(homeDir, '.claude');
    return ctx.cache.configDir;
  }

  const codexConfigDir = path.join(homeDir, '.codex');
  if (ctx.existsSync(codexConfigDir)) {
    ctx.cache.configDir = codexConfigDir;
    return ctx.cache.configDir;
  }

  ctx.cache.configDir = path.join(homeDir, '.cursor');
  return ctx.cache.configDir;
}

function resolveDataDir(ctx) {
  if (ctx.cache.dataDir) return ctx.cache.dataDir;

  const configDir = resolveConfigDir(ctx);
  const explicit = getExplicitDirValue(ctx, 'DATA_DIR');
  const mdtDir = path.join(configDir, 'mdt');

  if (explicit && ctx.existsSync(explicit)) {
    ctx.cache.dataDir = explicit;
    return ctx.cache.dataDir;
  }
  if (explicit) {
    ctx.logWarn(
      `[detect-env] DATA_DIR is set to '${explicit}' but does not exist; falling back based on configDir='${configDir}'`
    );
  }

  ctx.cache.dataDir = mdtDir;
  return ctx.cache.dataDir;
}

function detectPlatform(ctx) {
  if (ctx.cache.platformInfo) return ctx.cache.platformInfo;

  const info = {
    isWindows: ctx.platform === 'win32',
    isMacOS: ctx.platform === 'darwin',
    isLinux: ctx.platform === 'linux',
    isWSL: false
  };

  if (info.isLinux) {
    try {
      const procVersion = ctx.readFileSync('/proc/version', 'utf8');
      if (procVersion && /microsoft/i.test(procVersion)) {
        info.isWSL = true;
      }
    } catch {
      // /proc/version may be missing; keep generic linux defaults
    }
  }

  ctx.cache.platformInfo = info;
  return ctx.cache.platformInfo;
}

function resolveSessionId(ctx) {
  if (ctx.cache.sessionId) return ctx.cache.sessionId;

  if (ctx.env.CLAUDE_SESSION_ID && ctx.env.CLAUDE_SESSION_ID.length > 0) {
    ctx.cache.sessionId = ctx.env.CLAUDE_SESSION_ID;
    return ctx.cache.sessionId;
  }
  if (ctx.env.CURSOR_TRACE_ID && ctx.env.CURSOR_TRACE_ID.length > 0) {
    ctx.cache.sessionId = ctx.env.CURSOR_TRACE_ID;
    return ctx.cache.sessionId;
  }
  if (ctx.env.CODEX_SESSION_ID && ctx.env.CODEX_SESSION_ID.length > 0) {
    ctx.cache.sessionId = ctx.env.CODEX_SESSION_ID;
    return ctx.cache.sessionId;
  }

  const rand = Math.random().toString(16).slice(2, 10);
  ctx.cache.sessionId = `sess-${Date.now().toString(16)}-${rand}`;
  return ctx.cache.sessionId;
}

function getDerivedPaths(ctx) {
  const configDir = resolveConfigDir(ctx);
  const dataDir = resolveDataDir(ctx);

  return {
    configDir,
    dataDir,
    mdtDir: dataDir,
    skillsDir: path.join(configDir, 'skills'),
    hooksDir: path.join(configDir, 'hooks'),
    homunculusDir: path.join(dataDir, 'homunculus')
  };
}

function createDetectEnv(overrides = {}) {
  const ctx = createContext(overrides);

  return {
    getTool: () => detectTool(ctx),
    getConfigDir: () => resolveConfigDir(ctx),
    getDataDir: () => resolveDataDir(ctx),
    getSessionId: () => resolveSessionId(ctx),
    getPlatformInfo: () => detectPlatform(ctx),
    getPaths: () => getDerivedPaths(ctx),

    get tool() {
      return detectTool(ctx);
    },
    get configDir() {
      return resolveConfigDir(ctx);
    },
    get dataDir() {
      return resolveDataDir(ctx);
    },
    get sessionId() {
      return resolveSessionId(ctx);
    },
    get isWindows() {
      return detectPlatform(ctx).isWindows;
    },
    get isMacOS() {
      return detectPlatform(ctx).isMacOS;
    },
    get isLinux() {
      return detectPlatform(ctx).isLinux;
    },
    get isWSL() {
      return detectPlatform(ctx).isWSL;
    }
  };
}

const detectEnv = createDetectEnv();

module.exports = {
  createDetectEnv,
  detectEnv
};

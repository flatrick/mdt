/**
 * Cross-platform utility functions for MDT hooks and scripts
 * Works on Windows, macOS, and Linux
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');
const { detectEnv, createDetectEnv } = require('./detect-env');

// Platform detection (delegated to detect-env for cross-environment consistency)
const isWindows = detectEnv.isWindows;
const isMacOS = detectEnv.isMacOS;
const isLinux = detectEnv.isLinux;

let hasLoggedClaudeDirDeprecation = false;

/**
 * Get the user's home directory (cross-platform)
 */
function getHomeDir() {
  return os.homedir();
}

/**
 * Get the config directory as resolved by detect-env.
 * Prefer this over getClaudeDir for new code.
 */
function getConfigDir() {
  return detectEnv.getConfigDir();
}

/**
 * Get the data directory (homunculus root) as resolved by detect-env.
 */
function getDataDir() {
  return detectEnv.getDataDir();
}

/**
 * Get the active MDT config directory.
 *
 * Deprecated: use getConfigDir()/getDataDir() instead. This now delegates
 * to detect-env so callers automatically respect Cursor/Claude/unknown
 * tool detection.
 */
function getClaudeDir() {
  if (!hasLoggedClaudeDirDeprecation) {
    hasLoggedClaudeDirDeprecation = true;
    try {
      // Best-effort warning; ignore if stderr is not available
      console.error(
        '[utils] getClaudeDir() is deprecated; use getConfigDir()/getDataDir() from detect-env instead.'
      );
    } catch {
      // ignore logging failures
    }
  }
  return getConfigDir();
}

/**
 * Get the sessions directory
 */
function getSessionsDir() {
  return path.join(getDataDir(), 'sessions');
}

/**
 * Get the MDT-managed generated skills staging directory.
 */
function getLearnedSkillsDir(env = process.env) {
  const dataDir = env.DATA_DIR || getDataDir();
  return path.join(dataDir, 'generated', 'skills', 'learned');
}

/**
 * Get the temp directory (cross-platform)
 */
function getTempDir() {
  return os.tmpdir();
}

/**
 * Ensure a directory exists (create if not)
 * @param {string} dirPath - Directory path to create
 * @returns {string} The directory path
 * @throws {Error} If directory cannot be created (e.g., permission denied)
 */
function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (err) {
    // EEXIST is fine (race condition with another process creating it)
    if (err.code !== 'EEXIST') {
      throw new Error(`Failed to create directory '${dirPath}': ${err.message}`);
    }
  }
  return dirPath;
}

/**
 * Get current date in YYYY-MM-DD format
 */
function getDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current time in HH:MM format
 */
function getTimeString() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Get the git repository name
 */
function getGitRepoName() {
  const result = runCommand('git rev-parse --show-toplevel');
  if (!result.success) return null;
  return path.basename(result.output);
}

/**
 * Get project name from git repo or current directory
 */
function getProjectName() {
  const repoName = getGitRepoName();
  if (repoName) return repoName;
  return path.basename(process.cwd()) || null;
}

/**
 * Get short session ID from CLAUDE_SESSION_ID environment variable
 * Returns last 8 characters, falls back to project name then 'default'
 */
function getSessionIdShort(fallback = 'default') {
  const hasClaudeSessionId = typeof process.env.CLAUDE_SESSION_ID === 'string' && process.env.CLAUDE_SESSION_ID.length > 0;
  const hasCursorTraceId = typeof process.env.CURSOR_TRACE_ID === 'string' && process.env.CURSOR_TRACE_ID.length > 0;

  if (hasClaudeSessionId || hasCursorTraceId) {
    // Use detect-env's shared signal precedence (CLAUDE_SESSION_ID, then CURSOR_TRACE_ID)
    // while avoiding stale singleton cache in tests by creating a fresh resolver.
    const resolvedSessionId = createDetectEnv({ env: process.env }).getSessionId();
    return resolvedSessionId.slice(-8);
  }
  return getProjectName() || fallback;
}

/**
 * Get current datetime in YYYY-MM-DD HH:MM:SS format
 */
function getDateTimeString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Find files matching a pattern in a directory (cross-platform alternative to find)
 * @param {string} dir - Directory to search
 * @param {string} pattern - File pattern (e.g., "*.tmp", "*.md")
 * @param {object} options - Options { maxAge: days, recursive: boolean }
 */
function findFiles(dir, pattern, options = {}) {
  if (!dir || typeof dir !== 'string') return [];
  if (!pattern || typeof pattern !== 'string') return [];

  const { maxAge = null, recursive = false } = options;
  const results = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  // Escape all regex special characters, then convert glob wildcards.
  // Order matters: escape specials first, then convert * and ? to regex equivalents.
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  const regex = new RegExp(`^${regexPattern}$`);

  function isWithinMaxAge(mtimeMs) {
    if (maxAge === null) return true;
    const ageInDays = (Date.now() - mtimeMs) / (1000 * 60 * 60 * 24);
    return ageInDays <= maxAge;
  }

  function addFileResultIfMatch(fullPath, fileName) {
    if (!regex.test(fileName)) return;

    let stats;
    try {
      stats = fs.statSync(fullPath);
    } catch {
      return; // File deleted between readdir and stat
    }

    if (isWithinMaxAge(stats.mtimeMs)) {
      results.push({ path: fullPath, mtime: stats.mtimeMs });
    }
  }

  function searchDir(currentDir) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isFile()) {
          addFileResultIfMatch(fullPath, entry.name);
          continue;
        }

        if (entry.isDirectory() && recursive) {
          searchDir(fullPath);
        }
      }
    } catch (_err) {
      // Ignore permission errors
    }
  }

  searchDir(dir);

  // Sort by modification time (newest first)
  results.sort((a, b) => b.mtime - a.mtime);

  return results;
}

/**
 * Read text from stdin with timeout and max-size guard.
 * @param {object} options - Options
 * @param {number} options.timeoutMs - Timeout in milliseconds (default: 5000)
 * @param {number} options.maxSize - Maximum number of characters to buffer (default: 1MB)
 * @param {NodeJS.ReadStream} options.inputStream - Stream to read from (default: process.stdin)
 * @returns {Promise<string>} Raw stdin text (possibly truncated to maxSize)
 */
async function readStdinText(options = {}) {
  const { timeoutMs = 5000, maxSize = 1024 * 1024, inputStream = process.stdin } = options;

  return new Promise((resolve) => {
    let data = '';
    let settled = false;

    const cleanup = () => {
      inputStream.removeListener('data', onData);
      inputStream.removeListener('end', onEnd);
      inputStream.removeListener('error', onError);
    };

    const settleWithData = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    const timer = setTimeout(() => {
      settleWithData();
      if (inputStream.unref) inputStream.unref();
    }, timeoutMs);

    inputStream.setEncoding('utf8');

    const onData = chunk => {
      if (data.length >= maxSize) {
        return;
      }
      const remaining = maxSize - data.length;
      data += chunk.length > remaining ? chunk.slice(0, remaining) : chunk;
    };

    const onEnd = () => {
      settleWithData();
    };

    const onError = () => {
      settleWithData();
    };

    inputStream.on('data', onData);
    inputStream.on('end', onEnd);
    inputStream.on('error', onError);
  });
}

/**
 * Read JSON from stdin (for hook input)
 * @param {object} options - Options
 * @param {number} options.timeoutMs - Timeout in milliseconds (default: 5000).
 *   Prevents hooks from hanging indefinitely if stdin never closes.
 * @returns {Promise<object>} Parsed JSON object, or empty object if stdin is empty
 */
async function readStdinJson(options = {}) {
  const { timeoutMs = 5000, maxSize = 1024 * 1024, inputStream = process.stdin } = options;

  return new Promise((resolve) => {
    let data = '';
    let settled = false;

    const cleanup = () => {
      inputStream.removeListener('data', onData);
      inputStream.removeListener('end', onEnd);
      inputStream.removeListener('error', onError);
    };

    const settleWithParsedData = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(parseJsonObject(data));
    };

    const timer = setTimeout(() => {
      settleWithParsedData();
      if (inputStream.unref) inputStream.unref();
    }, timeoutMs);

    inputStream.setEncoding('utf8');
    const onData = chunk => {
      if (data.length < maxSize) {
        data += chunk;
      }
    };

    const onEnd = () => {
      settleWithParsedData();
    };

    const onError = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      // Resolve with empty object so hooks don't crash on stdin errors
      resolve({});
    };

    inputStream.on('data', onData);
    inputStream.on('end', onEnd);
    inputStream.on('error', onError);
  });
}

/**
 * Parse a JSON object payload from text safely.
 * Returns {} for empty/invalid/non-object input.
 * @param {string} input
 * @returns {object}
 */
function parseJsonObject(input) {
  if (typeof input !== 'string') {
    return {};
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return {};
  }
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Log to stderr (visible to user in Claude Code)
 */
function log(message) {
  console.error(message);
}

/**
 * Output to stdout (returned to Claude)
 */
function output(data) {
  if (typeof data === 'object') {
    console.log(JSON.stringify(data));
  } else {
    console.log(data);
  }
}

/**
 * Read a text file safely
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Write a text file
 */
function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Append to a text file
 */
function appendFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, content, 'utf8');
}

/**
 * Check if a command exists in PATH
 * Uses execFileSync to prevent command injection
 */
function commandExists(cmd) {
  // Validate command name - only allow alphanumeric, dash, underscore, dot
  if (!/^[a-zA-Z0-9_.-]+$/.test(cmd)) {
    return false;
  }

  try {
    if (isWindows) {
      // Use spawnSync to avoid shell interpolation
      const result = spawnSync('where', [cmd], { stdio: 'pipe' });
      return result.status === 0;
    } else {
      const result = spawnSync('which', [cmd], { stdio: 'pipe' });
      return result.status === 0;
    }
  } catch {
    return false;
  }
}

/**
 * Run a command and return output
 *
 * SECURITY NOTE: This function executes shell commands. Only use with
 * trusted, hardcoded commands. Never pass user-controlled input directly.
 * For user input, use spawnSync with argument arrays instead.
 *
 * @param {string} cmd - Command to execute (should be trusted/hardcoded)
 * @param {object} options - execSync options
 */
function runCommand(cmd, options = {}) {
  try {
    const result = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return { success: false, output: err.stderr || err.message };
  }
}

/**
 * Check if current directory is a git repository
 */
function isGitRepo() {
  return runCommand('git rev-parse --git-dir').success;
}

/**
 * Get git modified files, optionally filtered by regex patterns
 * @param {string[]} patterns - Array of regex pattern strings to filter files.
 *   Invalid patterns are silently skipped.
 * @returns {string[]} Array of modified file paths
 */
function getGitModifiedFiles(patterns = []) {
  if (!isGitRepo()) return [];

  const result = runCommand('git diff --name-only HEAD');
  if (!result.success) return [];

  let files = result.output.split('\n').filter(Boolean);

  if (patterns.length > 0) {
    // Pre-compile patterns, skipping invalid ones
    const compiled = [];
    for (const pattern of patterns) {
      if (typeof pattern !== 'string' || pattern.length === 0) continue;
      try {
        compiled.push(new RegExp(pattern));
      } catch {
        // Skip invalid regex patterns
      }
    }
    if (compiled.length > 0) {
      files = files.filter(file => compiled.some(regex => regex.test(file)));
    }
  }

  return files;
}

/**
 * Replace text in a file (cross-platform sed alternative)
 * @param {string} filePath - Path to the file
 * @param {string|RegExp} search - Pattern to search for. String patterns replace
 *   the FIRST occurrence only; use a RegExp with the `g` flag for global replacement.
 * @param {string} replace - Replacement string
 * @param {object} options - Options
 * @param {boolean} options.all - When true and search is a string, replaces ALL
 *   occurrences (uses String.replaceAll). Ignored for RegExp patterns.
 * @returns {boolean} true if file was written, false on error
 */
function replaceInFile(filePath, search, replace, options = {}) {
  const content = readFile(filePath);
  if (content === null) return false;

  try {
    let newContent;
    if (options.all && typeof search === 'string') {
      newContent = content.replaceAll(search, replace);
    } else {
      newContent = content.replace(search, replace);
    }
    writeFile(filePath, newContent);
    return true;
  } catch (err) {
    log(`[Utils] replaceInFile failed for ${filePath}: ${err.message}`);
    return false;
  }
}

/**
 * Count occurrences of a pattern in a file
 * @param {string} filePath - Path to the file
 * @param {string|RegExp} pattern - Pattern to count. Strings are treated as
 *   global regex patterns. RegExp instances are used as-is but the global
 *   flag is enforced to ensure correct counting.
 * @returns {number} Number of matches found
 */
function countInFile(filePath, pattern) {
  const content = readFile(filePath);
  if (content === null) return 0;

  let regex;
  try {
    if (pattern instanceof RegExp) {
      // Always create new RegExp to avoid shared lastIndex state; ensure global flag
      regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    } else if (typeof pattern === 'string') {
      regex = new RegExp(pattern, 'g');
    } else {
      return 0;
    }
  } catch {
    return 0; // Invalid regex pattern
  }
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Search for pattern in file and return matching lines with line numbers
 */
function grepFile(filePath, pattern) {
  const content = readFile(filePath);
  if (content === null) return [];

  let regex;
  try {
    if (pattern instanceof RegExp) {
      // Always create a new RegExp without the 'g' flag to prevent lastIndex
      // state issues when using .test() in a loop (g flag makes .test() stateful,
      // causing alternating match/miss on consecutive matching lines)
      const flags = pattern.flags.replace('g', '');
      regex = new RegExp(pattern.source, flags);
    } else {
      regex = new RegExp(pattern);
    }
  } catch {
    return []; // Invalid regex pattern
  }
  const lines = content.split('\n');
  const results = [];

  lines.forEach((line, index) => {
    if (regex.test(line)) {
      results.push({ lineNumber: index + 1, content: line });
    }
  });

  return results;
}

module.exports = {
  // Platform info
  isWindows,
  isMacOS,
  isLinux,

  // Directories
  getHomeDir,
  getConfigDir,
  getDataDir,
  getClaudeDir,
  getSessionsDir,
  getLearnedSkillsDir,
  getTempDir,
  ensureDir,

  // Date/Time
  getDateString,
  getTimeString,
  getDateTimeString,

  // Session/Project
  getSessionIdShort,
  getGitRepoName,
  getProjectName,

  // File operations
  findFiles,
  readFile,
  writeFile,
  appendFile,
  replaceInFile,
  countInFile,
  grepFile,

  // Hook I/O
  readStdinText,
  readStdinJson,
  parseJsonObject,
  log,
  output,

  // System
  commandExists,
  runCommand,
  isGitRepo,
  getGitModifiedFiles
};

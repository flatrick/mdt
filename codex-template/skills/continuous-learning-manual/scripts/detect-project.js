#!/usr/bin/env node
/**
 * Continuous Learning v2 - Project Detection
 *
 * Shared logic for detecting current project context.
 * Used by observe.js and start-observer.js.
 *
 * Detection priority:
 *   1. CLAUDE_PROJECT_DIR env var
 *   2. git rev-parse --show-toplevel
 *   3. "global" (no project context)
 *
 * Project ID: first 12 chars of SHA-256(remote URL or project root path).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

function getScriptRoot() {
  const dir = __dirname; // .../skills/continuous-learning-manual/scripts
  return path.join(dir, '..', '..', '..');
}

function loadDetectEnv() {
  const root = getScriptRoot();
  const candidates = [
    path.join(root, 'scripts', 'lib', 'detect-env.js'),
    path.join(root, 'mdt', 'scripts', 'lib', 'detect-env.js'),
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate).createDetectEnv;
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    `Cannot find detect-env.js. Searched:\n${candidates.map(c => '  - ' + c).join('\n')}`
  );
}

const createDetectEnv = loadDetectEnv();

function inferInstalledConfigDir(scriptDir = __dirname) {
  const candidates = [
    path.resolve(scriptDir, '..', '..'),
    path.resolve(scriptDir, '..', '..', '..')
  ];

  for (const candidate of candidates) {
    const baseName = path.basename(candidate).toLowerCase();
    if ((baseName === '.cursor' || baseName === '.claude' || baseName === '.codex') && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getPathSet() {
  const installedConfigDir = inferInstalledConfigDir();
  const env = { ...process.env };
  if (installedConfigDir && (!env.CONFIG_DIR || !String(env.CONFIG_DIR).trim())) {
    env.CONFIG_DIR = installedConfigDir;
  }
  if (installedConfigDir) {
    const inferredTool = path.basename(installedConfigDir).toLowerCase();
    if (inferredTool === '.cursor' && !env.CURSOR_AGENT) {
      env.CURSOR_AGENT = '1';
    }
    if (inferredTool === '.claude' && !env.CLAUDE_CODE) {
      env.CLAUDE_CODE = '1';
    }
    if (inferredTool === '.codex' && !env.CODEX_AGENT) {
      env.CODEX_AGENT = '1';
    }
  }

  const detectEnv = createDetectEnv({ env });
  const dataDir = detectEnv.getDataDir();
  const homunculusDir = path.join(dataDir, 'homunculus');
  return {
    dataDir,
    homunculusDir,
    projectsDir: path.join(homunculusDir, 'projects'),
    registryFile: path.join(homunculusDir, 'projects.json')
  };
}

function hasRepoMarker(dirPath) {
  return (
    fs.existsSync(path.join(dirPath, '.git')) ||
    fs.existsSync(path.join(dirPath, 'package.json')) ||
    fs.existsSync(path.join(dirPath, 'AGENTS.md'))
  );
}

function findProjectRootFromFilesystem(startDir) {
  let current = path.resolve(startDir || process.cwd());

  while (true) {
    if (hasRepoMarker(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function sha12(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 12);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function updateRegistry(projectId, projectName, projectRoot, remoteUrl) {
  const { registryFile } = getPathSet();
  ensureDir(path.dirname(registryFile));
  let registry = {};
  try {
    if (fs.existsSync(registryFile)) {
      registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
    }
  } catch {
    registry = {};
  }
  registry[projectId] = {
    name: projectName,
    root: projectRoot,
    remote: remoteUrl || '',
    last_seen: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  };
  const tmpFile = registryFile + '.tmp.' + process.pid;
  fs.writeFileSync(tmpFile, JSON.stringify(registry, null, 2), 'utf8');
  fs.renameSync(tmpFile, registryFile);
}

function globalResult(homunculusDir) {
  return {
    id: 'global',
    name: 'global',
    root: '',
    remote: '',
    project_dir: homunculusDir,
    instincts_personal: path.join(homunculusDir, 'instincts', 'personal'),
    instincts_inherited: path.join(homunculusDir, 'instincts', 'inherited'),
    evolved_dir: path.join(homunculusDir, 'evolved'),
    observations_file: path.join(homunculusDir, 'observations.jsonl')
  };
}

/**
 * Find the git repo root for a given directory.
 * Returns { root, remote } or null if not inside a git repo.
 */
function findGitRepo(startDir) {
  let root = null;
  try {
    const result = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      cwd: startDir,
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    root = (result || '').trim();
  } catch {
    return null;
  }
  if (!root) return null;
  root = path.resolve(root);

  let remote = '';
  try {
    const result = execFileSync('git', ['-C', root, 'remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    remote = (result || '').trim();
  } catch {
    // local-only repo, no remote
  }

  return { root, remote };
}

function buildProjectResult(projectsDir, projectRoot, remoteUrl) {
  const projectName = path.basename(projectRoot);
  const hashInput = remoteUrl || projectRoot;
  const projectId = sha12(hashInput);
  const projectDir = path.join(projectsDir, projectId);

  const subdirs = [
    path.join(projectDir, 'instincts', 'personal'),
    path.join(projectDir, 'instincts', 'inherited'),
    path.join(projectDir, 'observations.archive'),
    path.join(projectDir, 'evolved', 'skills'),
    path.join(projectDir, 'evolved', 'commands'),
    path.join(projectDir, 'evolved', 'agents')
  ];
  for (const d of subdirs) {
    ensureDir(d);
  }

  updateRegistry(projectId, projectName, projectRoot, remoteUrl);

  return {
    id: projectId,
    name: projectName,
    root: projectRoot,
    remote: remoteUrl,
    project_dir: projectDir,
    instincts_personal: path.join(projectDir, 'instincts', 'personal'),
    instincts_inherited: path.join(projectDir, 'instincts', 'inherited'),
    evolved_dir: path.join(projectDir, 'evolved'),
    observations_file: path.join(projectDir, 'observations.jsonl')
  };
}

/**
 * Detect project context. Returns object with:
 *   id, name, root, remote, project_dir, instincts_personal, instincts_inherited,
 *   evolved_dir, observations_file
 *
 * Project identity is git-based (remote URL preferred, repo path fallback).
 * Non-git directories get the global scope unless an explicit env override
 * (CLAUDE_PROJECT_DIR / MDT_PROJECT_ROOT) points to a directory containing .git.
 */
function detectProject(cwd) {
  const { homunculusDir, projectsDir } = getPathSet();
  const effectiveCwd = cwd || process.cwd();

  // Explicit env overrides: trust them if they point to a git-like directory
  for (const envKey of ['CLAUDE_PROJECT_DIR', 'MDT_PROJECT_ROOT']) {
    const val = (process.env[envKey] || '').trim();
    if (!val || !fs.existsSync(val)) continue;
    const resolved = path.resolve(val);
    const repo = findGitRepo(resolved);
    if (repo) return buildProjectResult(projectsDir, repo.root, repo.remote);
    // Honour the override even when git binary is unavailable,
    // as long as the directory looks like a repo (.git present).
    if (fs.existsSync(path.join(resolved, '.git'))) {
      return buildProjectResult(projectsDir, resolved, '');
    }
  }

  // Auto-detect from cwd via git
  const repo = findGitRepo(effectiveCwd);
  if (repo) return buildProjectResult(projectsDir, repo.root, repo.remote);

  return globalResult(homunculusDir);
}

function getHomunculusDir() {
  return getPathSet().homunculusDir;
}

function getProjectsDir() {
  return getPathSet().projectsDir;
}

function getRegistryFile() {
  return getPathSet().registryFile;
}

module.exports = {
  detectProject,
  findProjectRootFromFilesystem,
  getHomunculusDir,
  getProjectsDir,
  getRegistryFile,
  inferInstalledConfigDir,
  get homunculusDir() {
    return getHomunculusDir();
  },
  get projectsDir() {
    return getProjectsDir();
  },
  get registryFile() {
    return getRegistryFile();
  }
};

if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();
  const project = detectProject(cwd);
  console.log(JSON.stringify(project, null, 2));
}

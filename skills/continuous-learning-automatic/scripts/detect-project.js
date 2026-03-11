#!/usr/bin/env node
/**
 * Continuous Learning v2 - Project Detection
 *
 * Shared logic for detecting current project context.
 * Used by observe.js and start-observer.js.
 *
 * Detection priority:
 *   1. CLAUDE_PROJECT_DIR / MDT_PROJECT_ROOT env var (git-backed dirs only)
 *   2. git rev-parse --show-toplevel (auto-detect from cwd)
 *   3. cwd-scoped project (non-git fallback)
 *
 * Project ID format:
 *   - Git remote available : <repo-name>-git   (e.g. "mdt-git")
 *   - Git repo, no remote  : <basename>-<md5>  (e.g. "my-tool-9f8e7d6c")
 *   - No VCS               : <basename>-<md5>  (e.g. "scripts-3a4b5c6d")
 *
 * The MD5 suffix (first 8 hex chars of the absolute path) prevents collisions
 * between unrelated directories that share the same folder name.
 * Only git is detected today; other VCS types are in BACKLOG.md.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

function getScriptRoot() {
  const dir = __dirname; // .../skills/continuous-learning-automatic/scripts
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
    projectsDir: homunculusDir,
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

function md5_8(input) {
  return crypto.createHash('md5').update(input, 'utf8').digest('hex').slice(0, 8);
}

/**
 * Extract the repository name from a git remote URL.
 * Handles both SSH (git@host:owner/repo.git) and HTTPS (https://host/owner/repo.git).
 */
function repoNameFromUrl(url) {
  const base = url.trim().replace(/\/$/, '').replace(/\.git$/, '');
  const segment = base.split('/').pop();
  return segment.split(':').pop();
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
  const projectId = remoteUrl
    ? `${repoNameFromUrl(remoteUrl)}-git`
    : `${projectName}-${md5_8(projectRoot)}`;
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
 * Project identity is VCS-based when possible; falls back to cwd-scoped project.
 * Non-git directories get a path-anchored project ID (<basename>-<md5>) rather
 * than collapsing into the global scope.
 */
function detectProject(cwd) {
  const { projectsDir } = getPathSet();
  const effectiveCwd = path.resolve(cwd || process.cwd());

  // Explicit env overrides: trust them if they point to a git-backed directory
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

  // No VCS detected — use cwd as path-anchored project scope
  return buildProjectResult(projectsDir, effectiveCwd, '');
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

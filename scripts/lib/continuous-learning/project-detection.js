'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const {
  createContinuousLearningContext,
  inferInstalledConfigDir
} = require('./runtime-context');
const { detectProjectRoot } = require('../project-root');

function md5_8(input) {
  return crypto.createHash('md5').update(input, 'utf8').digest('hex').slice(0, 8);
}

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

function getPathSet(entrypointDir, options = {}) {
  const context = createContinuousLearningContext({ entrypointDir });
  const homunculusDir = path.join(context.dataDir, 'homunculus');
  return {
    detectEnv: options.detectEnv || context.detectEnv,
    dataDir: context.dataDir,
    homunculusDir,
    projectsDir: homunculusDir,
    registryFile: path.join(homunculusDir, 'projects.json')
  };
}

function updateRegistry(registryFile, projectId, projectName, projectRoot, remoteUrl) {
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

function ensureProjectSubdirs(projectDir) {
  const subdirs = [
    path.join(projectDir, 'instincts', 'personal'),
    path.join(projectDir, 'instincts', 'inherited'),
    path.join(projectDir, 'observations.archive'),
    path.join(projectDir, 'evolved', 'skills'),
    path.join(projectDir, 'evolved', 'commands'),
    path.join(projectDir, 'evolved', 'agents')
  ];
  for (const dir of subdirs) {
    ensureDir(dir);
  }
}

function buildProjectResult(projectsDir, registryFile, projectRoot, remoteUrl, detectEnv) {
  const projectName = path.basename(projectRoot);
  const projectId = remoteUrl
    ? `${repoNameFromUrl(remoteUrl)}-git`
    : `${projectName}-${md5_8(projectRoot)}`;
  const projectDir = path.join(projectsDir, projectId);
  const workspaceInfo = detectEnv.getWorkspaceInfo(projectRoot);
  ensureProjectSubdirs(projectDir);
  updateRegistry(registryFile, projectId, projectName, projectRoot, remoteUrl);

  return {
    id: projectId,
    name: projectName,
    root: projectRoot,
    remote: remoteUrl,
    project_dir: projectDir,
    instincts_personal: path.join(projectDir, 'instincts', 'personal'),
    instincts_inherited: path.join(projectDir, 'instincts', 'inherited'),
    evolved_dir: path.join(projectDir, 'evolved'),
    observations_file: path.join(projectDir, 'observations.jsonl'),
    environment: {
      isWSL: workspaceInfo.isWSL,
      workspaceKind: workspaceInfo.workspaceKind,
      shouldWarnPerformance: workspaceInfo.shouldWarnPerformance
    }
  };
}

function getExplicitProjectRoot() {
  for (const envKey of ['CLAUDE_PROJECT_DIR', 'MDT_PROJECT_ROOT']) {
    const value = (process.env[envKey] || '').trim();
    if (value && fs.existsSync(value)) {
      return path.resolve(value);
    }
  }
  return null;
}

function resolveProjectRootWithGit(projectsDir, registryFile, rootDir, detectEnv) {
  const repo = findGitRepo(rootDir);
  if (repo) return buildProjectResult(projectsDir, registryFile, repo.root, repo.remote, detectEnv);
  if (fs.existsSync(path.join(rootDir, '.git'))) {
    return buildProjectResult(projectsDir, registryFile, rootDir, '', detectEnv);
  }
  return null;
}

function createProjectDetection(options = {}) {
  const entrypointDir = path.resolve(options.entrypointDir || process.cwd());

  function findProjectRootFromFilesystem(startDir) {
    return detectProjectRoot(startDir);
  }

  function detectProject(cwd) {
    const { detectEnv, projectsDir, registryFile } = getPathSet(entrypointDir, options);
    const effectiveCwd = path.resolve(cwd || process.cwd());

    const explicitRoot = getExplicitProjectRoot();
    if (explicitRoot) {
      const explicitProject = resolveProjectRootWithGit(projectsDir, registryFile, explicitRoot, detectEnv);
      if (explicitProject) {
        return explicitProject;
      }
    }

    const repo = findGitRepo(effectiveCwd);
    if (repo) return buildProjectResult(projectsDir, registryFile, repo.root, repo.remote, detectEnv);

    return buildProjectResult(projectsDir, registryFile, effectiveCwd, '', detectEnv);
  }

  function getHomunculusDir() {
    return getPathSet(entrypointDir).homunculusDir;
  }

  function getProjectsDir() {
    return getPathSet(entrypointDir).projectsDir;
  }

  function getRegistryFile() {
    return getPathSet(entrypointDir).registryFile;
  }

  return {
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
}

module.exports = {
  createProjectDetection
};

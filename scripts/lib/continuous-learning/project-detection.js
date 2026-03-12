'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const {
  createContinuousLearningContext,
  hasRepoMarker,
  inferInstalledConfigDir
} = require('./runtime-context');

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

function createProjectDetection(options = {}) {
  const entrypointDir = path.resolve(options.entrypointDir || process.cwd());

  function getPathSet() {
    const context = createContinuousLearningContext({ entrypointDir });
    const homunculusDir = path.join(context.dataDir, 'homunculus');
    return {
      dataDir: context.dataDir,
      homunculusDir,
      projectsDir: homunculusDir,
      registryFile: path.join(homunculusDir, 'projects.json')
    };
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
    for (const dir of subdirs) {
      ensureDir(dir);
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

  function detectProject(cwd) {
    const { projectsDir } = getPathSet();
    const effectiveCwd = path.resolve(cwd || process.cwd());

    for (const envKey of ['CLAUDE_PROJECT_DIR', 'MDT_PROJECT_ROOT']) {
      const val = (process.env[envKey] || '').trim();
      if (!val || !fs.existsSync(val)) continue;
      const resolved = path.resolve(val);
      const repo = findGitRepo(resolved);
      if (repo) return buildProjectResult(projectsDir, repo.root, repo.remote);
      if (fs.existsSync(path.join(resolved, '.git'))) {
        return buildProjectResult(projectsDir, resolved, '');
      }
    }

    const repo = findGitRepo(effectiveCwd);
    if (repo) return buildProjectResult(projectsDir, repo.root, repo.remote);

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

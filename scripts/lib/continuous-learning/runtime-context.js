'use strict';

const fs = require('fs');
const path = require('path');
const { createDetectEnv } = require('../detect-env');

const TOOL_ENV_KEY_BY_TOOL = {
  cursor: 'CURSOR_AGENT',
  claude: 'CLAUDE_CODE',
  codex: 'CODEX_AGENT'
};

function hasRepoMarker(dirPath) {
  return (
    fs.existsSync(path.join(dirPath, '.git')) ||
    fs.existsSync(path.join(dirPath, 'package.json')) ||
    fs.existsSync(path.join(dirPath, 'AGENTS.md'))
  );
}

function inferToolFromConfigDir(configDir) {
  const normalized = String(configDir || '').replace(/\\/g, '/').toLowerCase();
  if (normalized.endsWith('/.cursor')) return 'cursor';
  if (normalized.endsWith('/.claude')) return 'claude';
  if (normalized.endsWith('/.codex')) return 'codex';
  return 'unknown';
}

function inferInstalledConfigDir(entrypointDir = process.cwd()) {
  let current = path.resolve(entrypointDir);

  while (true) {
    const baseName = path.basename(current).toLowerCase();
    if (
      (baseName === '.cursor' || baseName === '.claude' || baseName === '.codex') &&
      fs.existsSync(current)
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function resolveRepoRootFromEntrypoint(entrypointDir = process.cwd()) {
  let current = path.resolve(entrypointDir);

  while (true) {
    if (
      hasRepoMarker(current) &&
      fs.existsSync(path.join(current, 'scripts', 'lib', 'detect-env.js'))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function applyInstalledToolEnv(env, configDir) {
  const tool = inferToolFromConfigDir(configDir);
  const nextEnv = { ...env };
  const envKey = TOOL_ENV_KEY_BY_TOOL[tool];

  if (envKey && (!nextEnv[envKey] || !String(nextEnv[envKey]).trim())) {
    nextEnv[envKey] = '1';
  }

  return nextEnv;
}

function resolveContinuousLearningSkillRoot(options = {}) {
  const skillName = options.skillName || 'continuous-learning-manual';
  const entrypointDir = path.resolve(options.entrypointDir || process.cwd());
  const explicitSkillDir = options.skillDir ? path.resolve(options.skillDir) : null;
  const configDir = options.configDir ? path.resolve(options.configDir) : inferInstalledConfigDir(entrypointDir);
  const repoRoot = options.repoRoot ? path.resolve(options.repoRoot) : resolveRepoRootFromEntrypoint(entrypointDir);
  const candidates = [
    explicitSkillDir,
    configDir ? path.join(configDir, 'skills', skillName) : null,
    repoRoot ? path.join(repoRoot, 'skills', skillName) : null
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, 'SKILL.md')) ||
      fs.existsSync(path.join(candidate, 'skill.meta.json')) ||
      fs.existsSync(path.join(candidate, 'scripts', 'detect-project.js')) ||
      fs.existsSync(path.join(candidate, 'agents', 'start-observer.js'))
    ) {
      return candidate;
    }
  }

  return null;
}

function createContinuousLearningContext(options = {}) {
  const entrypointDir = path.resolve(options.entrypointDir || process.cwd());
  const repoRoot = options.repoRoot
    ? path.resolve(options.repoRoot)
    : resolveRepoRootFromEntrypoint(entrypointDir);
  const env = { ...process.env, ...(options.env || {}) };
  const inferredConfigDir = options.configDir
    ? path.resolve(options.configDir)
    : inferInstalledConfigDir(options.skillDir || entrypointDir);
  const seededEnv = inferredConfigDir && (!env.CONFIG_DIR || !String(env.CONFIG_DIR).trim())
    ? { ...env, CONFIG_DIR: inferredConfigDir }
    : env;
  const toolSeededEnv = inferredConfigDir
    ? applyInstalledToolEnv(seededEnv, inferredConfigDir)
    : seededEnv;
  const detectEnv = createDetectEnv({ env: toolSeededEnv });
  const configDir = options.configDir
    ? path.resolve(options.configDir)
    : detectEnv.getConfigDir();
  const dataDir = options.dataDir
    ? path.resolve(options.dataDir)
    : detectEnv.getDataDir();
  const skillDir = resolveContinuousLearningSkillRoot({
    entrypointDir,
    skillDir: options.skillDir,
    configDir,
    repoRoot,
    skillName: options.skillName
  });
  const configPath = options.configPath
    ? path.resolve(options.configPath)
    : (skillDir ? path.join(skillDir, 'config.json') : null);
  const tool = detectEnv.getTool();
  const inferredTool = inferToolFromConfigDir(configDir);
  const mdtRoot = repoRoot || path.join(configDir, 'mdt');

  return {
    entrypointDir,
    repoRoot,
    configDir,
    dataDir,
    mdtRoot,
    skillDir,
    configPath,
    detectEnv,
    env: toolSeededEnv,
    tool: tool !== 'unknown' ? tool : inferredTool
  };
}

module.exports = {
  createContinuousLearningContext,
  hasRepoMarker,
  inferInstalledConfigDir,
  inferToolFromConfigDir,
  resolveContinuousLearningSkillRoot,
  resolveRepoRootFromEntrypoint
};

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DEFAULT_SKILLS_DIR = path.join(REPO_ROOT, 'skills');
const VALID_HOOK_MODES = new Set(['none', 'optional', 'required']);
const ACTIVE_TOOL_TARGETS = new Set(['claude', 'cursor', 'codex', 'gemini']);

function readUtf8IfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return null;
  }

  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) {
      frontmatter[key] = value;
    }
  }

  return frontmatter;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeRuntime(value) {
  const hooksValue = value && typeof value === 'object' ? value.hooks : null;
  const hookMode = hooksValue && typeof hooksValue === 'object' && typeof hooksValue.mode === 'string'
    ? hooksValue.mode.trim()
    : 'none';

  return {
    runtimeScripts: Boolean(value && value.runtimeScripts),
    sessionData: Boolean(value && value.sessionData),
    hooks: {
      mode: hookMode || 'none',
      tools: normalizeStringArray(hooksValue && typeof hooksValue === 'object' ? hooksValue.tools : [])
    }
  };
}

function normalizeSkillRequires(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      rules: [],
      skills: [],
      runtime: normalizeRuntime({})
    };
  }

  return {
    rules: normalizeStringArray(value.rules),
    skills: normalizeStringArray(value.skills),
    runtime: normalizeRuntime(value.runtime)
  };
}

function loadSkillMetadata(skillDir) {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  const metaPath = path.join(skillDir, 'skill.meta.json');
  const skillContent = readUtf8IfExists(skillMdPath);
  if (skillContent === null) {
    throw new Error(`Missing SKILL.md at ${skillMdPath}`);
  }

  const frontmatter = extractFrontmatter(skillContent) || {};
  let rawMeta = {};
  if (fs.existsSync(metaPath)) {
    rawMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  }

  return {
    skillDir,
    skillMdPath,
    metaPath,
    frontmatter,
    name: frontmatter.name || path.basename(skillDir),
    description: frontmatter.description || '',
    version: frontmatter.version || '',
    hasMetaFile: fs.existsSync(metaPath),
    requires: normalizeSkillRequires(rawMeta.requires)
  };
}

function loadSkillMetadataByName(skillName, options = {}) {
  const skillDir = path.join(options.skillsDir || DEFAULT_SKILLS_DIR, skillName);
  if (!fs.existsSync(skillDir)) {
    return null;
  }
  return loadSkillMetadata(skillDir);
}

module.exports = {
  ACTIVE_TOOL_TARGETS,
  VALID_HOOK_MODES,
  loadSkillMetadata,
  loadSkillMetadataByName,
  normalizeSkillRequires
};

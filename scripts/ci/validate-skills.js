#!/usr/bin/env node
/**
 * Validate skill directories have SKILL.md with required structure
 */

const fs = require('fs');
const path = require('path');
const { readMarkdownFile, hasMarkdownHeading } = require('./markdown-utils');
const {
  ACTIVE_TOOL_TARGETS,
  VALID_HOOK_MODES,
  loadSkillMetadata
} = require('../lib/skill-metadata');

const DEFAULT_SKILLS_DIR = path.join(__dirname, '../../skills');
const DEFAULT_RULES_DIR = path.join(__dirname, '../../rules');
const WHEN_TO_SECTION_REGEX = /^#{1,6}\s+When to (Use|Activate)\b/im;

function validateSkillRequires(skillMetadata, rulesDir, skillsDir, io) {
  if (!skillMetadata.hasMetaFile) {
    return false;
  }

  let hasErrors = false;
  const { requires, name } = skillMetadata;

  for (const rulePath of requires.rules) {
    const normalizedRulePath = rulePath.replace(/\\/g, '/');
    if (normalizedRulePath.startsWith('/') || normalizedRulePath.includes('..')) {
      io.error(`ERROR: ${name}/skill.meta.json - Invalid rule path '${rulePath}'`);
      hasErrors = true;
      continue;
    }
    const resolvedRule = path.join(rulesDir, ...normalizedRulePath.split('/'));
    if (!fs.existsSync(resolvedRule)) {
      io.error(`ERROR: ${name}/skill.meta.json - Missing referenced rule '${rulePath}'`);
      hasErrors = true;
    }
  }

  for (const requiredSkill of requires.skills) {
    const requiredSkillDir = path.join(skillsDir, requiredSkill);
    if (!fs.existsSync(path.join(requiredSkillDir, 'SKILL.md'))) {
      io.error(`ERROR: ${name}/skill.meta.json - Missing referenced skill '${requiredSkill}'`);
      hasErrors = true;
    }
  }

  const runtime = requires.runtime;
  if (!VALID_HOOK_MODES.has(runtime.hooks.mode)) {
    io.error(`ERROR: ${name}/skill.meta.json - Invalid hooks.mode '${runtime.hooks.mode}'`);
    hasErrors = true;
  }

  for (const toolName of runtime.hooks.tools) {
    if (!ACTIVE_TOOL_TARGETS.has(toolName)) {
      io.error(`ERROR: ${name}/skill.meta.json - hooks.tools contains unsupported target '${toolName}'`);
      hasErrors = true;
    }
  }

  if (runtime.hooks.mode === 'required' && runtime.hooks.tools.length === 0) {
    io.error(`ERROR: ${name}/skill.meta.json - hooks.tools must be provided when hooks.mode is 'required'`);
    hasErrors = true;
  }

  if (runtime.hooks.mode === 'none' && runtime.hooks.tools.length > 0) {
    io.error(`ERROR: ${name}/skill.meta.json - hooks.tools must be empty when hooks.mode is 'none'`);
    hasErrors = true;
  }

  return hasErrors;
}

function validateSkills(options = {}) {
  const skillsDir = options.skillsDir || DEFAULT_SKILLS_DIR;
  const rulesDir = options.rulesDir || DEFAULT_RULES_DIR;
  const io = options.io || { log: console.log, error: console.error };
  if (!fs.existsSync(skillsDir)) {
    io.log('No skills directory found, skipping validation');
    return { exitCode: 0, validCount: 0, hasErrors: false };
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  let hasErrors = false;
  let validCount = 0;

  for (const dir of dirs) {
    const skillMd = path.join(skillsDir, dir, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      io.error(`ERROR: ${dir}/ - Missing SKILL.md`);
      hasErrors = true;
      continue;
    }

    let content;
    try {
      content = readMarkdownFile(skillMd);
    } catch (err) {
      io.error(`ERROR: ${dir}/SKILL.md - ${err.message}`);
      hasErrors = true;
      continue;
    }
    if (content.trim().length === 0) {
      io.error(`ERROR: ${dir}/SKILL.md - Empty file`);
      hasErrors = true;
      continue;
    }
    if (!hasMarkdownHeading(content)) {
      io.error(`ERROR: ${dir}/SKILL.md - Missing markdown heading`);
      hasErrors = true;
      continue;
    }
    if (!WHEN_TO_SECTION_REGEX.test(content)) {
      io.error(`ERROR: ${dir}/SKILL.md - Missing required section: "When to Use" or "When to Activate"`);
      hasErrors = true;
      continue;
    }

    try {
      const skillMetadata = loadSkillMetadata(path.join(skillsDir, dir));
      hasErrors = validateSkillRequires(skillMetadata, rulesDir, skillsDir, io) || hasErrors;
    } catch (err) {
      io.error(`ERROR: ${dir}/skill.meta.json - ${err.message}`);
      hasErrors = true;
      continue;
    }

    validCount++;
  }

  if (hasErrors) {
    return { exitCode: 1, validCount, hasErrors: true };
  }

  io.log(`Validated ${validCount} skill directories`);
  return { exitCode: 0, validCount, hasErrors: false };
}

if (require.main === module) {
  const result = validateSkills();
  process.exit(result.exitCode);
}

module.exports = {
  validateSkills
};

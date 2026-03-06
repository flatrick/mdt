#!/usr/bin/env node
/**
 * Validate skill directories have SKILL.md with required structure
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_SKILLS_DIR = path.join(__dirname, '../../skills');

function validateSkills(options = {}) {
  const skillsDir = options.skillsDir || DEFAULT_SKILLS_DIR;
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
      content = fs.readFileSync(skillMd, 'utf-8');
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

#!/usr/bin/env node
/**
 * Validate rule markdown files
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_RULES_DIR = path.join(__dirname, '../../rules');

function validateRules(options = {}) {
  const rulesDir = options.rulesDir || DEFAULT_RULES_DIR;
  const io = options.io || { log: console.log, error: console.error };
  if (!fs.existsSync(rulesDir)) {
    io.log('No rules directory found, skipping validation');
    return { exitCode: 0, validatedCount: 0, hasErrors: false };
  }

  const files = fs.readdirSync(rulesDir, { recursive: true })
    .filter(f => f.endsWith('.md'));
  let hasErrors = false;
  let validatedCount = 0;

  for (const file of files) {
    const filePath = path.join(rulesDir, file);
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.trim().length === 0) {
        io.error(`ERROR: ${file} - Empty rule file`);
        hasErrors = true;
        continue;
      }
      validatedCount++;
    } catch (err) {
      io.error(`ERROR: ${file} - ${err.message}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    return { exitCode: 1, validatedCount, hasErrors: true };
  }

  io.log(`Validated ${validatedCount} rule files`);
  return { exitCode: 0, validatedCount, hasErrors: false };
}

if (require.main === module) {
  const result = validateRules();
  process.exit(result.exitCode);
}

module.exports = {
  validateRules
};

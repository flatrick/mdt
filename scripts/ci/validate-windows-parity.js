#!/usr/bin/env node
/**
 * Validate runtime skill shell scripts have Windows PowerShell counterparts.
 *
 * Scope:
 *   For each skill directory, scan hooks/scripts/agents recursively
 *   and validate every ".sh" runtime script.
 *
 * Requirement:
 *   For each .sh script, a same-path .ps1 file must exist unless allowlisted.
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '../../skills');
const RUNTIME_DIRS = new Set(['hooks', 'scripts', 'agents']);

// Relative paths (from repo root) that are intentionally Unix-only.
const ALLOWLIST = new Set([]);

function toRel(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function walkDir(dirPath) {
  const out = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkDir(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function validateWindowsParity() {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.log('No skills directory found, skipping validation');
    process.exit(0);
  }

  const repoRoot = path.join(__dirname, '../..');
  const skillEntries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let scanned = 0;
  let hasErrors = false;

  for (const skillName of skillEntries) {
    const skillRoot = path.join(SKILLS_DIR, skillName);
    const runtimeRoots = fs.readdirSync(skillRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && RUNTIME_DIRS.has(d.name))
      .map((d) => path.join(skillRoot, d.name));

    for (const runtimeRoot of runtimeRoots) {
      const files = walkDir(runtimeRoot)
        .filter((f) => f.endsWith('.sh'))
        .sort();

      for (const shPath of files) {
        scanned++;
        const relSh = toRel(repoRoot, shPath);
        if (ALLOWLIST.has(relSh)) {
          continue;
        }

        const ps1Path = shPath.replace(/\.sh$/, '.ps1');
        if (!fs.existsSync(ps1Path)) {
          hasErrors = true;
          const relPs1 = toRel(repoRoot, ps1Path);
          console.error(`ERROR: Missing Windows counterpart for ${relSh}`);
          console.error(`       Expected: ${relPs1}`);
        }
      }
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log(`Validated Windows parity for ${scanned} shell script(s)`);
}

validateWindowsParity();

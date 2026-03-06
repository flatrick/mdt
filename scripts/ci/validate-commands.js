#!/usr/bin/env node
/**
 * Validate command markdown files are non-empty, readable,
 * and have valid cross-references to other commands, agents, and skills.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '../..');
const DEFAULT_COMMANDS_DIR = path.join(ROOT_DIR, 'commands');
const DEFAULT_AGENTS_DIR = path.join(ROOT_DIR, 'agents');
const DEFAULT_SKILLS_DIR = path.join(ROOT_DIR, 'skills');

function validateCommands(options = {}) {
  const commandsDir = options.commandsDir || DEFAULT_COMMANDS_DIR;
  const agentsDir = options.agentsDir || DEFAULT_AGENTS_DIR;
  const skillsDir = options.skillsDir || DEFAULT_SKILLS_DIR;
  const io = options.io || { log: console.log, error: console.error, warn: console.warn };

  if (!fs.existsSync(commandsDir)) {
    io.log('No commands directory found, skipping validation');
    return { exitCode: 0, validatedCount: 0, warnCount: 0, hasErrors: false };
  }

  const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));
  let hasErrors = false;
  let warnCount = 0;

  // Build set of valid command names (without .md extension)
  const validCommands = new Set(files.map(f => f.replace(/\.md$/, '')));

  // Build set of valid agent names (without .md extension)
  const validAgents = new Set();
  if (fs.existsSync(agentsDir)) {
    for (const f of fs.readdirSync(agentsDir)) {
      if (f.endsWith('.md')) {
        validAgents.add(f.replace(/\.md$/, ''));
      }
    }
  }

  // Build set of valid skill directory names
  const validSkills = new Set();
  if (fs.existsSync(skillsDir)) {
    for (const f of fs.readdirSync(skillsDir)) {
      const skillPath = path.join(skillsDir, f);
      try {
        if (fs.statSync(skillPath).isDirectory()) {
          validSkills.add(f);
        }
      } catch {
        // skip unreadable entries
      }
    }
  }

  for (const file of files) {
    const filePath = path.join(commandsDir, file);
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      io.error(`ERROR: ${file} - ${err.message}`);
      hasErrors = true;
      continue;
    }

    // Validate the file is non-empty readable markdown
    if (content.trim().length === 0) {
      io.error(`ERROR: ${file} - Empty command file`);
      hasErrors = true;
      continue;
    }

    // Strip fenced code blocks before checking cross-references.
    // Examples/templates inside ``` blocks are not real references.
    const contentNoCodeBlocks = content.replace(/```[\s\S]*?```/g, '');

    // Check cross-references to other commands (e.g., `/build-fix`)
    // Skip lines that describe hypothetical output (e.g., "→ Creates: `/new-table`")
    // Process line-by-line so ALL command refs per line are captured
    // (previous anchored regex /^.*`\/...`.*$/gm only matched the last ref per line)
    for (const line of contentNoCodeBlocks.split('\n')) {
      if (/creates:|would create:/i.test(line)) continue;
      const lineRefs = line.matchAll(/`\/([a-z][-a-z0-9]*)`/g);
      for (const match of lineRefs) {
        const refName = match[1];
        if (!validCommands.has(refName)) {
          io.error(`ERROR: ${file} - references non-existent command /${refName}`);
          hasErrors = true;
        }
      }
    }

    // Check agent references (e.g., "agents/planner.md" or "`planner` agent")
    const agentPathRefs = contentNoCodeBlocks.matchAll(/agents\/([a-z][-a-z0-9]*)\.md/g);
    for (const match of agentPathRefs) {
      const refName = match[1];
      if (!validAgents.has(refName)) {
        io.error(`ERROR: ${file} - references non-existent agent agents/${refName}.md`);
        hasErrors = true;
      }
    }

    // Check skill directory references (e.g., "skills/tdd-workflow/")
    const skillRefs = contentNoCodeBlocks.matchAll(/skills\/([a-z][-a-z0-9]*)\//g);
    for (const match of skillRefs) {
      const refName = match[1];
      if (!validSkills.has(refName)) {
        io.warn(`WARN: ${file} - references skill directory skills/${refName}/ (not found locally)`);
        warnCount++;
      }
    }

    // Check agent name references in workflow diagrams (e.g., "planner -> tdd-guide")
    const workflowLines = contentNoCodeBlocks.matchAll(/^([a-z][-a-z0-9]*(?:\s*->\s*[a-z][-a-z0-9]*)+)$/gm);
    for (const match of workflowLines) {
      const agents = match[1].split(/\s*->\s*/);
      for (const agent of agents) {
        if (!validAgents.has(agent)) {
          io.error(`ERROR: ${file} - workflow references non-existent agent "${agent}"`);
          hasErrors = true;
        }
      }
    }
  }

  if (hasErrors) {
    return { exitCode: 1, validatedCount: files.length, warnCount, hasErrors: true };
  }

  let msg = `Validated ${files.length} command files`;
  if (warnCount > 0) {
    msg += ` (${warnCount} warnings)`;
  }
  io.log(msg);
  return { exitCode: 0, validatedCount: files.length, warnCount, hasErrors: false };
}

if (require.main === module) {
  const result = validateCommands();
  process.exit(result.exitCode);
}

module.exports = {
  validateCommands
};

#!/usr/bin/env node
/**
 * Validate command markdown files are non-empty, readable,
 * and have valid cross-references to other commands, agents, and skills.
 */

const fs = require('fs');
const path = require('path');
const { readMarkdownFile } = require('./markdown-utils');

const ROOT_DIR = path.join(__dirname, '../..');
const DEFAULT_COMMANDS_DIR = path.join(ROOT_DIR, 'commands');
const DEFAULT_AGENTS_DIR = path.join(ROOT_DIR, 'agents');
const DEFAULT_SKILLS_DIR = path.join(ROOT_DIR, 'skills');
const DEFAULT_IO = { log: console.log, error: console.error, warn: console.warn };

function listMarkdownFiles(dirPath) {
  return fs.readdirSync(dirPath).filter(fileName => fileName.endsWith('.md'));
}

function buildCommandSet(files) {
  return new Set(files.map(fileName => fileName.replace(/\.md$/, '')));
}

function buildAgentSet(agentsDir) {
  if (!fs.existsSync(agentsDir)) return new Set();
  return new Set(
    fs.readdirSync(agentsDir)
      .filter(fileName => fileName.endsWith('.md'))
      .map(fileName => fileName.replace(/\.md$/, ''))
  );
}

function buildSkillSet(skillsDir) {
  if (!fs.existsSync(skillsDir)) return new Set();

  const validSkills = new Set();
  for (const entryName of fs.readdirSync(skillsDir)) {
    const skillPath = path.join(skillsDir, entryName);
    try {
      if (fs.statSync(skillPath).isDirectory()) {
        validSkills.add(entryName);
      }
    } catch {
      // skip unreadable entries
    }
  }
  return validSkills;
}

function createValidationState(hasErrors = false, warnCount = 0) {
  return { hasErrors, warnCount };
}

function mergeValidationState(state, nextState) {
  return createValidationState(
    state.hasErrors || nextState.hasErrors,
    state.warnCount + nextState.warnCount
  );
}

function validateCommandRefs(fileName, contentNoCodeBlocks, validCommands, io) {
  let hasErrors = false;

  for (const line of contentNoCodeBlocks.split('\n')) {
    if (/creates:|would create:/i.test(line)) continue;
    const lineRefs = line.matchAll(/`\/([a-z][-a-z0-9]*)`/g);
    for (const match of lineRefs) {
      const refName = match[1];
      if (!validCommands.has(refName)) {
        io.error(`ERROR: ${fileName} - references non-existent command /${refName}`);
        hasErrors = true;
      }
    }
  }

  return createValidationState(hasErrors, 0);
}

function validateAgentPathRefs(fileName, contentNoCodeBlocks, validAgents, io) {
  let hasErrors = false;
  const agentPathRefs = contentNoCodeBlocks.matchAll(/agents\/([a-z][-a-z0-9]*)\.md/g);

  for (const match of agentPathRefs) {
    const refName = match[1];
    if (!validAgents.has(refName)) {
      io.error(`ERROR: ${fileName} - references non-existent agent agents/${refName}.md`);
      hasErrors = true;
    }
  }

  return createValidationState(hasErrors, 0);
}

function validateSkillRefs(fileName, contentNoCodeBlocks, validSkills, io) {
  let warnCount = 0;
  const skillRefs = contentNoCodeBlocks.matchAll(/skills\/([a-z][-a-z0-9]*)\//g);

  for (const match of skillRefs) {
    const refName = match[1];
    if (!validSkills.has(refName)) {
      io.warn(`WARN: ${fileName} - references skill directory skills/${refName}/ (not found locally)`);
      warnCount++;
    }
  }

  return createValidationState(false, warnCount);
}

function validateWorkflowRefs(fileName, contentNoCodeBlocks, validAgents, io) {
  let hasErrors = false;
  const workflowLines = contentNoCodeBlocks.matchAll(/^([a-z][-a-z0-9]*(?:\s*->\s*[a-z][-a-z0-9]*)+)$/gm);

  for (const match of workflowLines) {
    const agents = match[1].split(/\s*->\s*/);
    for (const agent of agents) {
      if (!validAgents.has(agent)) {
        io.error(`ERROR: ${fileName} - workflow references non-existent agent "${agent}"`);
        hasErrors = true;
      }
    }
  }

  return createValidationState(hasErrors, 0);
}

function validateCommandContent(fileName, content, validCommands, validAgents, validSkills, io) {
  const contentNoCodeBlocks = content.replace(/```[\s\S]*?```/g, '');
  const validators = [
    validateCommandRefs(fileName, contentNoCodeBlocks, validCommands, io),
    validateAgentPathRefs(fileName, contentNoCodeBlocks, validAgents, io),
    validateSkillRefs(fileName, contentNoCodeBlocks, validSkills, io),
    validateWorkflowRefs(fileName, contentNoCodeBlocks, validAgents, io)
  ];

  return validators.reduce(mergeValidationState, createValidationState(false, 0));
}

function validateSingleCommandFile(fileName, commandsDir, refs, io) {
  const filePath = path.join(commandsDir, fileName);

  let content;
  try {
    content = readMarkdownFile(filePath);
  } catch (err) {
    io.error(`ERROR: ${fileName} - ${err.message}`);
    return createValidationState(true, 0);
  }

  if (content.trim().length === 0) {
    io.error(`ERROR: ${fileName} - Empty command file`);
    return createValidationState(true, 0);
  }

  return validateCommandContent(
    fileName,
    content,
    refs.validCommands,
    refs.validAgents,
    refs.validSkills,
    io
  );
}

function validateCommands(options = {}) {
  const commandsDir = options.commandsDir || DEFAULT_COMMANDS_DIR;
  const agentsDir = options.agentsDir || DEFAULT_AGENTS_DIR;
  const skillsDir = options.skillsDir || DEFAULT_SKILLS_DIR;
  const io = options.io || DEFAULT_IO;

  if (!fs.existsSync(commandsDir)) {
    io.log('No commands directory found, skipping validation');
    return { exitCode: 0, validatedCount: 0, warnCount: 0, hasErrors: false };
  }

  const files = listMarkdownFiles(commandsDir);
  const refs = {
    validCommands: buildCommandSet(files),
    validAgents: buildAgentSet(agentsDir),
    validSkills: buildSkillSet(skillsDir)
  };

  let aggregate = createValidationState(false, 0);

  for (const file of files) {
    const fileResult = validateSingleCommandFile(file, commandsDir, refs, io);
    aggregate = mergeValidationState(aggregate, fileResult);
  }

  if (aggregate.hasErrors) {
    return { exitCode: 1, validatedCount: files.length, warnCount: aggregate.warnCount, hasErrors: true };
  }

  let msg = `Validated ${files.length} command files`;
  if (aggregate.warnCount > 0) {
    msg += ` (${aggregate.warnCount} warnings)`;
  }
  io.log(msg);
  return { exitCode: 0, validatedCount: files.length, warnCount: aggregate.warnCount, hasErrors: false };
}

if (require.main === module) {
  const result = validateCommands();
  process.exit(result.exitCode);
}

module.exports = {
  validateCommands
};

const path = require('path');

const validatorsDir = path.join(__dirname, '..', '..', 'scripts', 'ci');

function getValidatorFunction(validatorName) {
  const mod = require(path.join(validatorsDir, `${validatorName}.js`));
  const map = {
    'validate-agents': mod.validateAgents,
    'validate-hooks': mod.validateHooks,
    'validate-commands': mod.validateCommands,
    'validate-skills': mod.validateSkills,
    'validate-rules': mod.validateRules,
    'validate-hook-mirrors': mod.runCli,
    'validate-metadata': mod.validateMetadata,
    'validate-no-hardcoded-paths': mod.validateNoHardcodedPaths,
    'validate-runtime-ignores': mod.validateRuntimeIgnores,
    'validate-markdown-links': mod.validateMarkdownLinks,
    'validate-markdown-path-refs': mod.validateMarkdownPathRefs
  };
  if (!map[validatorName]) {
    throw new Error(`Unsupported validator: ${validatorName}`);
  }
  return map[validatorName];
}

function runValidatorFunction(validatorName, options = {}) {
  const logs = [];
  const errors = [];
  const warns = [];
  const fn = getValidatorFunction(validatorName);
  const result = fn({
    ...options,
    io: {
      log: msg => logs.push(String(msg)),
      error: msg => errors.push(String(msg)),
      warn: msg => warns.push(String(msg))
    }
  });
  return {
    code: result.exitCode,
    stdout: logs.join('\n') + (warns.length ? `\n${warns.join('\n')}` : ''),
    stderr: errors.join('\n')
  };
}

function runValidatorWithDir(validatorName, dirConstant, overridePath) {
  const optionMap = {
    AGENTS_DIR: 'agentsDir',
    HOOKS_FILE: 'hooksFile',
    COMMANDS_DIR: 'commandsDir',
    SKILLS_DIR: 'skillsDir',
    RULES_DIR: 'rulesDir',
    GITIGNORE_FILE: 'gitignorePath'
  };
  const key = optionMap[dirConstant];
  if (!key) throw new Error(`Unsupported dir constant: ${dirConstant}`);
  return runValidatorFunction(validatorName, { [key]: overridePath });
}

function runValidatorWithDirs(validatorName, overrides) {
  const optionMap = {
    AGENTS_DIR: 'agentsDir',
    HOOKS_FILE: 'hooksFile',
    COMMANDS_DIR: 'commandsDir',
    SKILLS_DIR: 'skillsDir',
    RULES_DIR: 'rulesDir',
    GITIGNORE_FILE: 'gitignorePath'
  };
  const options = {};
  for (const [constant, overridePath] of Object.entries(overrides)) {
    const key = optionMap[constant];
    if (!key) throw new Error(`Unsupported dir constant: ${constant}`);
    options[key] = overridePath;
  }
  return runValidatorFunction(validatorName, options);
}

function runValidator(validatorName) {
  return runValidatorFunction(validatorName);
}

module.exports = {
  runValidatorFunction,
  runValidatorWithDir,
  runValidatorWithDirs,
  runValidator
};

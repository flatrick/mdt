#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'scripts');
const SKILLS_ROOT = path.join(REPO_ROOT, 'skills', 'continuous-learning-manual', 'scripts');

const CI_VALIDATORS = [
  'agents',
  'commands',
  'rules',
  'skills',
  'hooks',
  'hook-mirrors',
  'metadata',
  'no-hardcoded-paths',
  'runtime-ignores',
  'install-packages',
  'markdown-links',
  'markdown-path-refs',
  'frontmatter-format',
  'template-doc-boundaries'
];

const WORKFLOW_SMOKE_SCRIPTS = {
  claude: 'smoke-claude-workflows.js',
  cursor: 'smoke-cursor-workflows.js',
  codex: 'smoke-codex-workflows.js'
};

function createIo(io = {}) {
  return {
    log: io.log || ((message = '') => process.stdout.write(`${message}\n`)),
    error: io.error || ((message = '') => process.stderr.write(`${message}\n`))
  };
}

const VALUE_OPTION_SETTERS = {
  '--format': (options, value) => { options.format = value || 'text'; },
  '--cwd': (options, value) => { options.cwd = path.resolve(value); },
  '--tool': (options, value) => { options.tool = value; },
  '--config-root': (options, value) => { options.configRoot = path.resolve(value); },
  '--scope': (options, value) => { options.scope = value; },
  '--surface': (options, value) => { options.surface = value; },
  '--manager': (options, value) => { options.manager = value; },
  '--version': (options, value) => { options.version = value; },
  '--output': (options, value) => { options.output = value; },
  '--week': (options, value) => { options.week = value; },
  '--interval-seconds': (options, value) => { options.intervalSeconds = value; },
  '--min-observations': (options, value) => { options.minObservations = value; },
  '--profiles': (options, value) => { options.profiles = value; },
  '--hook-id': (options, value) => { options.hookId = value; }
};

const BOOLEAN_OPTION_SETTERS = {
  '--dev': (options) => { options.dev = true; },
  '--dry-run': (options) => { options.dryRun = true; },
  '--force': (options) => { options.force = true; }
};

function createCommonOptions() {
  return {
    format: 'text',
    cwd: null,
    tool: null,
    configRoot: null,
    scope: null,
    surface: null,
    manager: null,
    version: null,
    output: null,
    week: null,
    intervalSeconds: null,
    minObservations: null,
    dev: false,
    dryRun: false,
    force: false,
    profiles: null,
    hookId: null,
    packageNames: [],
    positionals: []
  };
}

function applyInlineValueOption(options, arg) {
  const equalIndex = arg.indexOf('=');
  if (equalIndex === -1) {
    return false;
  }

  const flag = arg.slice(0, equalIndex);
  const setter = VALUE_OPTION_SETTERS[flag];
  if (!setter) {
    return false;
  }

  setter(options, arg.slice(equalIndex + 1));
  return true;
}

function applyNextValueOption(options, argv, index) {
  const setter = VALUE_OPTION_SETTERS[argv[index]];
  if (!setter) {
    return index;
  }
  const next = argv[index + 1];
  if (!next) {
    throw createUsageError(`Missing value for ${argv[index]}`);
  }
  setter(options, next);
  return index + 1;
}

function applyBooleanOption(options, arg) {
  const setter = BOOLEAN_OPTION_SETTERS[arg];
  if (!setter) {
    return false;
  }
  setter(options);
  return true;
}

function parseCommonOptions(argv) {
  const options = createCommonOptions();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (applyInlineValueOption(options, arg) || applyBooleanOption(options, arg)) {
      continue;
    }
    const nextIndex = applyNextValueOption(options, argv, i);
    if (nextIndex !== i) {
      i = nextIndex;
      continue;
    }

    if (arg.startsWith('--')) {
      throw createUsageError(`Unknown option: ${arg}`);
    }

    options.positionals.push(arg);
  }

  return options;
}

function createUsageError(message) {
  const error = new Error(message);
  error.exitCode = 2;
  return error;
}

function normalizeCommand(argv) {
  if (!Array.isArray(argv) || argv.length === 0) {
    throw createUsageError(buildHelpText());
  }

  return {
    root: argv[0],
    segments: argv.slice(0, 4),
    rest: argv.slice(1)
  };
}

function buildHelpText() {
  return [
    'Usage: mdt <command> [subcommand] [options]',
    '',
    'Commands:',
    '  install [package...]',
    '  install list',
    '  bridge materialize',
    '  verify tool-setups',
    '  smoke tool-setups',
    '  smoke workflows --tool <claude|cursor|codex>',
    '  package-manager detect|list|set',
    '  release --version <x.y.z>',
    '  learning status|capture|analyze',
    '  learning retrospective weekly',
    '  learning observer status|run|watch',
    '  learning instincts status|projects|export|evolve|import|promote',
    '  ci check-dependencies <package...>',
    '  ci validate <name|all>',
    '  hooks enabled',
    '  hooks sync-mirrors'
  ].join('\n');
}

function summarizeOutput(stdout, stderr, fallback) {
  const text = `${stdout || ''}\n${stderr || ''}`.trim();
  if (!text) {
    return fallback;
  }
  return text.split(/\r?\n/, 1)[0].trim() || fallback;
}

function collectIoOutput() {
  const stdout = [];
  const stderr = [];
  return {
    io: {
      log: (message = '') => stdout.push(String(message)),
      error: (message = '') => stderr.push(String(message))
    },
    stdout,
    stderr
  };
}

function normalizeJsonResult(commandName, status, stdout, stderr, data = {}) {
  const ok = status === 0;
  return {
    ok,
    command: commandName,
    summary: summarizeOutput(stdout, stderr, ok ? 'ok' : 'failed'),
    data: {
      ...data,
      stdout: stdout || '',
      stderr: stderr || '',
      exitCode: status
    },
    errors: ok
      ? []
      : [{
          message: (stderr || stdout || `Command failed with exit code ${status}`).trim()
        }]
  };
}

function runNodeScript(scriptPath, scriptArgs, options = {}) {
  const cwd = options.cwd || REPO_ROOT;
  const format = options.format || 'text';
  const commandName = options.commandName || path.basename(scriptPath, '.js');
  const child = spawnSync('node', [scriptPath, ...scriptArgs], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    input: options.stdin || undefined,
    env: options.env || process.env,
    timeout: options.timeoutMs || 60000
  });

  const stdout = child.stdout || '';
  const stderr = child.stderr || '';
  const status = typeof child.status === 'number' ? child.status : 1;

  if (format === 'json') {
    return {
      exitCode: status,
      stdout: JSON.stringify(normalizeJsonResult(commandName, status, stdout, stderr, options.data), null, 2),
      stderr: ''
    };
  }

  return {
    exitCode: status,
    stdout,
    stderr
  };
}

function renderResult(result, io) {
  if (result.stdout) {
    io.log(result.stdout.replace(/\n$/, ''));
  }
  if (result.stderr) {
    io.error(result.stderr.replace(/\n$/, ''));
  }
  return result.exitCode;
}

function runInProcess(executor, options = {}) {
  const collected = collectIoOutput();
  const exitCode = executor(collected.io);
  const stdout = collected.stdout.join('\n');
  const stderr = collected.stderr.join('\n');

  if (options.format === 'json') {
    return {
      exitCode,
      stdout: JSON.stringify(
        normalizeJsonResult(options.commandName || 'command', exitCode, stdout, stderr, options.data),
        null,
        2
      ),
      stderr: ''
    };
  }

  return {
    exitCode,
    stdout,
    stderr
  };
}

function buildInstallCommand(argv) {
  const options = parseCommonOptions(argv);
  const args = [];

  if (options.tool) {
    args.push('--target', options.tool);
  }
  if (options.configRoot) {
    args.push('--override', options.configRoot);
  }
  if (options.dev) {
    args.push('--dev');
  }
  if (options.dryRun) {
    args.push('--dry-run');
  }
  if (options.positionals[0] === 'list') {
    args.push('--list');
  } else {
    args.push(...options.positionals);
  }

  return runNodeScript(path.join(SCRIPTS_ROOT, 'install-mdt.js'), args, {
    cwd: options.cwd || REPO_ROOT,
    format: options.format,
    commandName: 'install'
  });
}

function buildBridgeCommand(argv) {
  const options = parseCommonOptions(argv);
  const args = [];

  if (options.tool) {
    args.push('--target', options.tool);
  }
  if (options.surface) {
    args.push('--surface', options.surface);
  }
  if (options.cwd) {
    args.push('--repo', options.cwd);
  }
  if (options.configRoot) {
    args.push('--override', options.configRoot);
  }
  args.push(...options.positionals);

  return runNodeScript(path.join(SCRIPTS_ROOT, 'materialize-mdt-local.js'), args, {
    cwd: options.cwd || REPO_ROOT,
    format: options.format,
    commandName: 'bridge materialize'
  });
}

function buildVerifyCommand(argv) {
  const options = parseCommonOptions(argv);
  const { evaluateToolSetups } = require('./verify-tool-setups');
  return runInProcess(
    (io) => evaluateToolSetups({ rootDir: options.cwd || REPO_ROOT, io, format: options.format }).exitCode,
    {
      format: options.format,
      commandName: 'verify tool-setups'
    }
  );
}

function buildSmokeCommand(argv) {
  if (argv[0] === 'tool-setups') {
    const options = parseCommonOptions(argv.slice(1));
    const { smokeToolSetups } = require('./smoke-tool-setups');
    return runInProcess(
      (io) => smokeToolSetups({ io, format: options.format }).exitCode,
      {
        format: options.format,
        commandName: 'smoke tool-setups'
      }
    );
  }

  if (argv[0] === 'workflows') {
    const options = parseCommonOptions(argv.slice(1));
    if (!options.tool || !WORKFLOW_SMOKE_SCRIPTS[options.tool]) {
      throw createUsageError('smoke workflows requires --tool <claude|cursor|codex>');
    }
    const workflowFns = {
      claude: require('./smoke-claude-workflows').smokeClaudeWorkflows,
      cursor: require('./smoke-cursor-workflows').smokeCursorWorkflows,
      codex: require('./smoke-codex-workflows').smokeCodexWorkflows
    };
    return runInProcess(
      (io) => workflowFns[options.tool]({ io, format: options.format, workspaceRoot: options.cwd || REPO_ROOT, rootDir: options.cwd || REPO_ROOT }).exitCode,
      {
        format: options.format,
        commandName: `smoke workflows ${options.tool}`
      }
    );
  }

  throw createUsageError('Unknown smoke command');
}

function buildPackageManagerCommand(argv) {
  const subcommand = argv[0];
  const options = parseCommonOptions(argv.slice(1));
  const args = [];
  const { runSetupPackageManager } = require('./setup-package-manager');

  if (subcommand === 'detect') {
    args.push('--detect');
  } else if (subcommand === 'list') {
    args.push('--list');
  } else if (subcommand === 'set') {
    if (!options.scope || !options.manager) {
      throw createUsageError('package-manager set requires --scope and --manager');
    }
    if (options.scope === 'global') {
      args.push('--global', options.manager);
    } else if (options.scope === 'project') {
      args.push('--project', options.manager);
    } else {
      throw createUsageError('package-manager set --scope must be global or project');
    }
  } else {
    throw createUsageError('Unknown package-manager command');
  }

  return runInProcess(
    (io) => runSetupPackageManager(args, { io, cwd: options.cwd || REPO_ROOT, env: process.env }),
    {
      format: options.format,
      commandName: `package-manager ${subcommand}`
    }
  );
}

function buildReleaseCommand(argv) {
  const options = parseCommonOptions(argv);
  if (!options.version) {
    throw createUsageError('release requires --version <x.y.z>');
  }
  return runNodeScript(path.join(SCRIPTS_ROOT, 'release.js'), [options.version], {
    cwd: options.cwd || REPO_ROOT,
    format: options.format,
    commandName: 'release'
  });
}

function appendLearningLocationArgs(args, options) {
  if (options.cwd) {
    args.push('--project-dir', options.cwd);
  }
  if (options.intervalSeconds) {
    args.push('--interval-seconds', String(options.intervalSeconds));
  }
  if (options.minObservations) {
    args.push('--min-observations', String(options.minObservations));
  }
}

function buildLearningObserverCommand(argv) {
  const action = argv[1];
  const options = parseCommonOptions(argv.slice(2));
  const commandMap = { run: 'once', status: 'status', watch: 'watch' };
  const command = commandMap[action];
  if (!command) {
    throw createUsageError('learning observer requires status, run, or watch');
  }
  const args = [command];
  appendLearningLocationArgs(args, options);
  return runNodeScript(path.join(SCRIPTS_ROOT, 'codex-observer.js'), args, {
    cwd: options.cwd || REPO_ROOT,
    format: options.format,
    commandName: `learning observer ${action}`
  });
}

function buildLearningRetrospectiveCommand(argv) {
  if (argv[1] !== 'weekly') {
    throw createUsageError('learning retrospective requires the weekly subcommand');
  }
  const options = parseCommonOptions(argv.slice(2));
  const args = ['weekly'];
  if (options.week) {
    args.push('--week', options.week);
  }
  return runNodeScript(path.join(SKILLS_ROOT, 'codex-learn.js'), args, {
    cwd: options.cwd || REPO_ROOT,
    format: options.format,
    commandName: 'learning retrospective weekly'
  });
}

function buildLearningInstinctsArgs(action, options) {
  const args = [action];
  if (action === 'import' || action === 'promote') {
    const first = options.positionals[0];
    if (!first) {
      throw createUsageError(`learning instincts ${action} requires a target argument`);
    }
    args.push(first);
  }
  if (options.scope) {
    args.push('--scope', options.scope);
  }
  if (options.output) {
    args.push('--output', options.output);
  }
  if (options.dryRun) {
    args.push('--dry-run');
  }
  if (options.force) {
    args.push('--force');
  }
  if (options.week) {
    args.push('--week', options.week);
  }
  return args;
}

function buildLearningInstinctsCommand(argv) {
  const action = argv[1];
  if (!action) {
    throw createUsageError('learning instincts requires a subcommand');
  }
  const options = parseCommonOptions(argv.slice(2));
  return runNodeScript(path.join(SKILLS_ROOT, 'instinct-cli.js'), buildLearningInstinctsArgs(action, options), {
    cwd: options.cwd || REPO_ROOT,
    format: options.format,
    commandName: `learning instincts ${action}`
  });
}

function buildLearningBasicCommand(area, argv) {
  const options = parseCommonOptions(argv.slice(1));
  return runNodeScript(path.join(SKILLS_ROOT, 'codex-learn.js'), [area], {
    cwd: options.cwd || REPO_ROOT,
    format: options.format,
    commandName: `learning ${area}`
  });
}

function buildLearningCommand(argv) {
  const area = argv[0];
  if (area === 'observer') return buildLearningObserverCommand(argv);
  if (area === 'retrospective') return buildLearningRetrospectiveCommand(argv);
  if (area === 'instincts') return buildLearningInstinctsCommand(argv);
  if (['status', 'capture', 'analyze'].includes(area)) return buildLearningBasicCommand(area, argv);
  throw createUsageError('Unknown learning command');
}

function buildCiCheckDependenciesCommand(common, execScript) {
  return execScript(path.join(SCRIPTS_ROOT, 'ci', 'check-dependencies.js'), common.positionals, {
    cwd: common.cwd || REPO_ROOT,
    format: common.format,
    commandName: 'ci check-dependencies'
  });
}

function buildCiValidateAllCommand(common, execScript) {
  const outputs = [];
  let exitCode = 0;
  for (const validatorName of CI_VALIDATORS) {
    const result = execScript(path.join(SCRIPTS_ROOT, 'ci', `validate-${validatorName}.js`), [], {
      cwd: common.cwd || REPO_ROOT,
      format: common.format,
      commandName: `ci validate ${validatorName}`
    });
    outputs.push(result.stdout || '');
    if (result.exitCode !== 0) {
      exitCode = result.exitCode;
    }
  }
  return {
    exitCode,
    stdout: outputs.filter(Boolean).join('\n'),
    stderr: ''
  };
}

function buildCiValidateCommand(common, execScript) {
  const validator = common.positionals[0];
  if (!validator) {
    throw createUsageError('ci validate requires a validator name or all');
  }
  if (validator === 'all') {
    return buildCiValidateAllCommand(common, execScript);
  }
  if (!CI_VALIDATORS.includes(validator)) {
    throw createUsageError(`Unknown validator: ${validator}`);
  }
  return execScript(path.join(SCRIPTS_ROOT, 'ci', `validate-${validator}.js`), [], {
    cwd: common.cwd || REPO_ROOT,
    format: common.format,
    commandName: `ci validate ${validator}`
  });
}

function buildCiCommand(argv, options = {}) {
  const action = argv[0];
  const common = parseCommonOptions(argv.slice(1));
  const execScript = options.execScript || runNodeScript;
  if (action === 'check-dependencies') return buildCiCheckDependenciesCommand(common, execScript);
  if (action === 'validate') return buildCiValidateCommand(common, execScript);
  throw createUsageError('Unknown ci command');
}

function buildHooksCommand(argv) {
  const action = argv[0];
  const options = parseCommonOptions(argv.slice(1));
  if (action === 'enabled') {
    if (!options.hookId) {
      throw createUsageError('hooks enabled requires --hook-id <id>');
    }
    const args = [options.hookId];
    if (options.profiles) {
      args.push(options.profiles);
    }
    return runNodeScript(path.join(SCRIPTS_ROOT, 'hooks', 'check-hook-enabled.js'), args, {
      cwd: options.cwd || REPO_ROOT,
      format: options.format,
      commandName: 'hooks enabled'
    });
  }
  if (action === 'sync-mirrors') {
    return runNodeScript(path.join(SCRIPTS_ROOT, 'sync-hook-mirrors.js'), [], {
      cwd: options.cwd || REPO_ROOT,
      format: options.format,
      commandName: 'hooks sync-mirrors'
    });
  }
  throw createUsageError('Unknown hooks command');
}

const ROOT_COMMAND_HANDLERS = {
  install: (rest) => buildInstallCommand(rest),
  smoke: (rest) => buildSmokeCommand(rest),
  'package-manager': (rest) => buildPackageManagerCommand(rest),
  release: (rest) => buildReleaseCommand(rest),
  learning: (rest) => buildLearningCommand(rest),
  ci: (rest) => buildCiCommand(rest),
  hooks: (rest) => buildHooksCommand(rest)
};

function dispatch(argv, options = {}) {
  const io = createIo(options.io);
  const command = normalizeCommand(argv);
  const rootHandler = ROOT_COMMAND_HANDLERS[command.root];
  const result = command.root === 'bridge' && command.rest[0] === 'materialize'
    ? buildBridgeCommand(command.rest.slice(1))
    : command.root === 'verify' && command.rest[0] === 'tool-setups'
      ? buildVerifyCommand(command.rest.slice(1))
      : rootHandler
        ? rootHandler(command.rest)
        : (() => { throw createUsageError(buildHelpText()); })();
  return renderResult(result, io);
}

function main(argv = process.argv.slice(2), options = {}) {
  try {
    return dispatch(argv, options);
  } catch (error) {
    const io = createIo(options.io);
    io.error(error.message || String(error));
    return error.exitCode || 1;
  }
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  CI_VALIDATORS,
  WORKFLOW_SMOKE_SCRIPTS,
  buildCiCommand,
  buildHelpText,
  createUsageError,
  dispatch,
  main,
  normalizeJsonResult,
  parseCommonOptions,
  runNodeScript
};

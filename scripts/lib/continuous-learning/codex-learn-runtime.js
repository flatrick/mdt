'use strict';

const fs = require('fs');
const path = require('path');

function createCodexLearnRuntime(options = {}) {
  const {
    detectProject,
    inferInstalledConfigDir,
    analyzeObservations,
    loadObserverConfig,
    generateWeeklyRetrospective,
    entrypointDir
  } = options;

  if (typeof detectProject !== 'function') {
    throw new Error('createCodexLearnRuntime requires detectProject');
  }
  if (typeof inferInstalledConfigDir !== 'function') {
    throw new Error('createCodexLearnRuntime requires inferInstalledConfigDir');
  }
  if (typeof analyzeObservations !== 'function') {
    throw new Error('createCodexLearnRuntime requires analyzeObservations');
  }
  if (typeof loadObserverConfig !== 'function') {
    throw new Error('createCodexLearnRuntime requires loadObserverConfig');
  }
  if (typeof generateWeeklyRetrospective !== 'function') {
    throw new Error('createCodexLearnRuntime requires generateWeeklyRetrospective');
  }

  function loadStdin() {
    return new Promise((resolve) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => { data += chunk; });
      process.stdin.on('end', () => resolve(data));
    });
  }

  const TOOL_ENV_MAP = {
    '.cursor': { envKey: 'CURSOR_AGENT', observerTool: 'cursor' },
    '.claude': { envKey: 'CLAUDE_CODE', observerTool: 'claude' },
    '.codex': { envKey: 'CODEX_AGENT', observerTool: 'codex' }
  };

  function buildCodexEnv(env = process.env) {
    const nextEnv = { ...env };
    const homeDir = nextEnv.HOME || nextEnv.USERPROFILE || process.env.HOME || process.env.USERPROFILE || '';

    const installedDir = inferInstalledConfigDir(entrypointDir);
    const toolName = installedDir ? path.basename(installedDir).toLowerCase() : '.codex';
    const toolInfo = TOOL_ENV_MAP[toolName] || TOOL_ENV_MAP['.codex'];

    const configDir = nextEnv.CONFIG_DIR || (installedDir || path.join(homeDir, '.codex'));
    const dataDir = nextEnv.DATA_DIR || path.join(configDir, 'mdt');
    fs.mkdirSync(dataDir, { recursive: true });

    nextEnv[toolInfo.envKey] = '1';
    nextEnv.MDT_OBSERVER_TOOL = toolInfo.observerTool;
    nextEnv.CONFIG_DIR = configDir;
    nextEnv.DATA_DIR = dataDir;

    return nextEnv;
  }

  function countLines(filePath) {
    if (!fs.existsSync(filePath)) {
      return 0;
    }
    return fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean).length;
  }

  function appendSummaryObservation(summaryText, project, env) {
    const tool = env.MDT_OBSERVER_TOOL || 'codex';
    const observation = {
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      event: 'session_summary',
      tool,
      session: env.CODEX_SESSION_ID || env.CLAUDE_SESSION_ID || env.CURSOR_SESSION_ID || `${tool}-${Date.now()}`,
      project_id: project.id,
      project_name: project.name,
      input: summaryText.trim()
    };

    fs.mkdirSync(path.dirname(project.observations_file), { recursive: true });
    fs.appendFileSync(project.observations_file, `${JSON.stringify(observation)}\n`, 'utf8');
  }

  async function run(argv = process.argv.slice(2)) {
    const cmd = argv[0] || 'status';
    const env = buildCodexEnv();
    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined) {
        process.env[key] = value;
      }
    }
    const project = detectProject(process.cwd());

    if (cmd === 'status') {
      console.log(`Project: ${project.name} (${project.id})`);
      console.log(`Storage: ${project.project_dir}`);
      console.log(`Tool: ${env.MDT_OBSERVER_TOOL || 'unknown'}`);
      console.log(`Observations: ${countLines(project.observations_file)}`);
      return;
    }

    if (cmd === 'capture') {
      const summaryText = (await loadStdin()).trim();
      if (!summaryText) {
        console.error('Error: capture requires summary text on stdin');
        process.exit(1);
      }
      appendSummaryObservation(summaryText, project, env);
      console.log(`Captured Codex session summary for ${project.name}`);
      console.log(`Observations: ${countLines(project.observations_file)}`);
      return;
    }

    if (cmd === 'analyze') {
      const config = {
        ...loadObserverConfig(),
        tool: 'codex',
        min_observations_to_analyze: 1
      };

      const child = analyzeObservations({
        env: {
          ...env,
          CLV2_PROJECT_DIR: project.project_dir,
          CLV2_OBSERVATIONS_FILE: project.observations_file,
          CLV2_INSTINCTS_DIR: path.join(project.project_dir, 'instincts', 'personal'),
          CLV2_MIN_OBSERVATIONS: '1',
          CLV2_PROJECT_NAME: project.name,
          CLV2_PROJECT_ID: project.id,
          CLV2_LOG_FILE: path.join(project.project_dir, 'observer.log')
        },
        config
      });

      if (!child) {
        console.log('No observations available to analyze.');
        return;
      }

      await new Promise((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Codex analysis exited with code ${code}`));
          }
        });
        child.on('error', reject);
      });

      console.log(`Analyzed observations for ${project.name}`);
      return;
    }

    if (cmd === 'weekly') {
      let week = null;
      for (let i = 1; i < argv.length; i++) {
        if (argv[i] === '--week' && argv[i + 1]) {
          week = argv[++i];
        }
      }

      const retrospective = generateWeeklyRetrospective({
        cwd: project.root || process.cwd(),
        project,
        week
      });

      console.log(retrospective.text);
      console.log(`Summary file: ${retrospective.outputPath}`);
      return;
    }

    console.log('Usage: node codex-learn.js {status|capture|analyze|weekly} [--week YYYY-Www]');
    process.exit(1);
  }

  return {
    buildCodexEnv,
    run
  };
}

module.exports = {
  createCodexLearnRuntime
};

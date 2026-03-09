#!/usr/bin/env node
/**
 * Codex-native explicit continuous-learning workflow.
 *
 * Usage:
 *   node codex-learn.js status
 *   node codex-learn.js capture < summary.txt
 *   node codex-learn.js analyze
 */

'use strict';

const fs = require('fs');
const path = require('path');

const skillRoot = path.join(__dirname, '..');
const projectRoot = path.join(skillRoot, '..', '..', '..');
const { detectProject } = require(path.join(__dirname, 'detect-project.js'));
const { analyzeObservations, loadObserverConfig } = require(path.join(skillRoot, 'agents', 'start-observer.js'));

function loadStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

function buildCodexEnv(env = process.env) {
  const nextEnv = { ...env };
  const configDir = nextEnv.CONFIG_DIR || path.join(projectRoot, '.agents');
  const dataDir = nextEnv.DATA_DIR || path.join(projectRoot, '.codex');
  fs.mkdirSync(dataDir, { recursive: true });

  nextEnv.CODEX_AGENT = '1';
  nextEnv.MDT_OBSERVER_TOOL = 'codex';
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
  const observation = {
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    event: 'session_summary',
    tool: 'codex',
    session: env.CODEX_SESSION_ID || env.CLAUDE_SESSION_ID || `codex-${Date.now()}`,
    project_id: project.id,
    project_name: project.name,
    input: summaryText.trim()
  };

  fs.mkdirSync(path.dirname(project.observations_file), { recursive: true });
  fs.appendFileSync(project.observations_file, JSON.stringify(observation) + '\n', 'utf8');
}

async function run() {
  const cmd = process.argv[2] || 'status';
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
    console.log('Tool: codex');
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

  console.log('Usage: node codex-learn.js {status|capture|analyze}');
  process.exit(1);
}

run().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});

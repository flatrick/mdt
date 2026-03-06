#!/usr/bin/env node
/**
 * Continuous Learning - Session Evaluator
 *
 * Runs on Stop hook to extract reusable patterns from Claude Code sessions.
 * Designed for both CLI execution and direct unit testing.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const {
  getLearnedSkillsDir,
  ensureDir,
  readFile,
  countInFile,
  readStdinJson,
  log
} = require('../lib/utils');

const MAX_STDIN = 1024 * 1024;

function getDefaultConfigPath(env = process.env) {
  return env.ECC_CONTINUOUS_LEARNING_CONFIG || path.join(__dirname, '..', '..', 'skills', 'continuous-learning', 'config.json');
}

function loadEvaluateConfig(configPath, logger = log) {
  const configContent = readFile(configPath);
  let minSessionLength = 10;
  let learnedSkillsPath = getLearnedSkillsDir();

  if (configContent) {
    try {
      const config = JSON.parse(configContent);
      minSessionLength = config.min_session_length ?? 10;
      if (config.learned_skills_path) {
        learnedSkillsPath = config.learned_skills_path.replace(/^~/, os.homedir());
      }
    } catch (err) {
      logger(`[ContinuousLearning] Failed to parse config: ${err.message}, using defaults`);
    }
  }

  return { minSessionLength, learnedSkillsPath };
}

function evaluateSession(options = {}) {
  const {
    input = {},
    env = process.env,
    logger = log,
    fileSystem = fs
  } = options;

  const transcriptPath = input.transcript_path || env.CLAUDE_TRANSCRIPT_PATH || null;
  const configPath = getDefaultConfigPath(env);
  const { minSessionLength, learnedSkillsPath } = loadEvaluateConfig(configPath, logger);

  ensureDir(learnedSkillsPath);

  if (!transcriptPath || !fileSystem.existsSync(transcriptPath)) {
    return { shouldEvaluate: false, reason: 'missing-transcript', messageCount: 0, learnedSkillsPath };
  }

  const messageCount = countInFile(transcriptPath, /"type"\s*:\s*"user"/g);
  if (messageCount < minSessionLength) {
    logger(`[ContinuousLearning] Session too short (${messageCount} messages), skipping`);
    return { shouldEvaluate: false, reason: 'too-short', messageCount, learnedSkillsPath };
  }

  logger(`[ContinuousLearning] Session has ${messageCount} messages - evaluate for extractable patterns`);
  logger(`[ContinuousLearning] Save learned skills to: ${learnedSkillsPath}`);

  return { shouldEvaluate: true, reason: 'evaluate', messageCount, learnedSkillsPath };
}

async function runCli() {
  try {
    const input = await readStdinJson({ timeoutMs: 5000, maxSize: MAX_STDIN });
    evaluateSession({ input });
    process.exit(0);
  } catch (err) {
    console.error('[ContinuousLearning] Error:', err.message);
    process.exit(0);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  getDefaultConfigPath,
  loadEvaluateConfig,
  evaluateSession,
  runCli
};

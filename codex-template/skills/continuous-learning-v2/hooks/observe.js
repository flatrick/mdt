#!/usr/bin/env node
/**
 * Continuous Learning v2 - Observation Hook
 *
 * Captures tool use events for pattern analysis.
 * Claude Code / Cursor pass hook data via stdin as JSON.
 *
 * v2.1: Project-scoped observations — writes to project-specific directory.
 *
 * Usage: node observe.js [pre|post]
 *   pre  = PreToolUse (tool_start)
 *   post = PostToolUse (tool_complete, default)
 */

const fs = require('fs');
const path = require('path');

const skillRoot = path.join(__dirname, '..');
const { detectProject, getHomunculusDir } = require(path.join(skillRoot, 'scripts', 'detect-project.js'));

const HOOK_PHASE = process.argv[2] || 'post';
const MAX_FILE_SIZE_MB = 10;
const TRUNCATE_INPUT = 5000;
const TRUNCATE_OUTPUT = 5000;
const TRUNCATE_RAW_ERROR = 2000;

function loadStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

function main() {
  loadStdin().then((inputRaw) => {
    if (!inputRaw || !inputRaw.trim()) {
      process.exit(0);
      return;
    }

    let inputJson;
    try {
      inputJson = JSON.parse(inputRaw);
    } catch {
      const projectForError = detectProject(process.cwd());
      const errFile = projectForError.observations_file;
      const parseErrorLine = JSON.stringify({
        timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        event: 'parse_error',
        raw: inputRaw.slice(0, TRUNCATE_RAW_ERROR)
      }) + '\n';
      try {
        fs.mkdirSync(path.dirname(errFile), { recursive: true });
        fs.appendFileSync(errFile, parseErrorLine, { encoding: 'utf8', flag: 'a' });
      } catch (_err) {
        // Ignore parse-error logging failures.
      }
      process.exit(0);
      return;
    }

    const cwd = inputJson.cwd || inputJson.workspace_roots?.[0];
    if (cwd && typeof cwd === 'string') {
      process.env.CLAUDE_PROJECT_DIR = cwd;
    }

    const project = detectProject(process.cwd());

    const configDir = getHomunculusDir();
    const observationsFile = project.observations_file;

    if (fs.existsSync(path.join(configDir, 'disabled'))) {
      process.exit(0);
      return;
    }

    const event = HOOK_PHASE === 'pre' ? 'tool_start' : 'tool_complete';
    const toolName = inputJson.tool_name || inputJson.tool || 'unknown';
    const sessionId = inputJson.session_id || inputJson.conversation_id || 'unknown';
    let toolInput = inputJson.tool_input || inputJson.input;
    let toolOutput = inputJson.tool_output || inputJson.output;

    if (typeof toolInput === 'object') toolInput = JSON.stringify(toolInput);
    else if (toolInput !== null && toolInput !== undefined) toolInput = String(toolInput);
    else toolInput = '';
    if (typeof toolOutput === 'object') toolOutput = JSON.stringify(toolOutput);
    else if (toolOutput !== null && toolOutput !== undefined) toolOutput = String(toolOutput);
    else toolOutput = '';

    const inputStr = toolInput.slice(0, TRUNCATE_INPUT);
    const outputStr = toolOutput.slice(0, TRUNCATE_OUTPUT);

    const observation = {
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      event,
      tool: toolName,
      session: sessionId,
      project_id: project.id,
      project_name: project.name
    };
    if (event === 'tool_start') observation.input = inputStr;
    else observation.output = outputStr;

    const line = JSON.stringify(observation) + '\n';

    try {
      if (fs.existsSync(observationsFile)) {
        const stat = fs.statSync(observationsFile);
        const sizeMB = stat.size / (1024 * 1024);
        if (sizeMB >= MAX_FILE_SIZE_MB) {
          const archiveDir = path.join(project.project_dir, 'observations.archive');
          fs.mkdirSync(archiveDir, { recursive: true });
          const archiveName = `observations-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}.jsonl`;
          fs.renameSync(observationsFile, path.join(archiveDir, archiveName));
        }
      }

      fs.mkdirSync(path.dirname(observationsFile), { recursive: true });
      fs.appendFileSync(observationsFile, line, { encoding: 'utf8', flag: 'a' });
    } catch (_err) {
      // ignore write failure
    }

    process.exit(0);
  });
}

main();

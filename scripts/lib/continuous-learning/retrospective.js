'use strict';

const fs = require('fs');
const path = require('path');

const MCP_COMMAND_PREFIXES = new Set(['gh', 'docker', 'kubectl', 'psql', 'mysql', 'sqlite3', 'aws', 'az', 'gcloud', 'curl']);
const TRIVIAL_COMMANDS = new Set(['pwd', 'ls', 'dir', 'node -v', 'git status']);

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseWeekSpec(weekSpec) {
  const match = String(weekSpec || '').trim().match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid week format '${weekSpec}'. Use YYYY-Www, for example 2026-W11.`);
  }

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  if (week < 1 || week > 53) {
    throw new Error(`Invalid ISO week '${weekSpec}'. Week must be between 01 and 53.`);
  }

  return { year, week, key: `${year}-W${pad2(week)}` };
}

function getIsoWeekWindow(weekSpecOrParts) {
  const parts = typeof weekSpecOrParts === 'string'
    ? parseWeekSpec(weekSpecOrParts)
    : weekSpecOrParts;
  const jan4 = new Date(parts.year, 0, 4, 0, 0, 0, 0);
  const jan4Day = jan4.getDay() || 7;
  const mondayOfWeek1 = new Date(parts.year, 0, 4 - (jan4Day - 1), 0, 0, 0, 0);
  const start = new Date(mondayOfWeek1);
  start.setDate(mondayOfWeek1.getDate() + (parts.week - 1) * 7);
  start.setHours(0, 0, 0, 0);
  const endExclusive = new Date(start);
  endExclusive.setDate(start.getDate() + 7);
  const endInclusive = new Date(endExclusive.getTime() - 1);

  return {
    week: parts.key,
    start,
    endInclusive,
    endExclusive
  };
}

function getIsoWeekForDate(dateInput = new Date()) {
  const date = new Date(dateInput);
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  const day = normalized.getDay() || 7;
  normalized.setDate(normalized.getDate() + 4 - day);
  const year = normalized.getFullYear();
  const jan1 = new Date(year, 0, 1, 12, 0, 0, 0);
  const diffDays = Math.round((normalized - jan1) / 86400000);
  const week = Math.floor(diffDays / 7) + 1;
  return { year, week, key: `${year}-W${pad2(week)}` };
}

function parseArgs(argv) {
  let week = null;
  let cwd = process.cwd();
  let format = 'text';

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--week' && argv[i + 1]) {
      week = argv[++i];
    } else if (argv[i] === '--cwd' && argv[i + 1]) {
      cwd = path.resolve(argv[++i]);
    } else if (argv[i] === '--json') {
      format = 'json';
    }
  }

  return { week, cwd, format };
}

function readObservationFile(filePath, window, sourceType) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  const entries = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const timestamp = new Date(parsed.timestamp);
      if (Number.isNaN(timestamp.getTime())) {
        continue;
      }
      if (timestamp < window.start || timestamp >= window.endExclusive) {
        continue;
      }

      entries.push({
        ...parsed,
        timestamp,
        source_file: filePath,
        source_type: sourceType
      });
    } catch {
      // Ignore invalid observation lines during retrospective scans.
    }
  }

  return entries;
}

function collectWeeklyObservations(project, window) {
  const archiveDir = path.join(project.project_dir, 'observations.archive');
  const archiveFiles = fs.existsSync(archiveDir)
    ? fs.readdirSync(archiveDir)
      .filter((fileName) => fileName.endsWith('.jsonl'))
      .map((fileName) => path.join(archiveDir, fileName))
    : [];

  const allEntries = [];
  const matchingSourceFiles = new Set();

  const currentEntries = readObservationFile(project.observations_file, window, 'live');
  if (currentEntries.length > 0) {
    matchingSourceFiles.add(project.observations_file);
    allEntries.push(...currentEntries);
  }

  for (const archiveFile of archiveFiles) {
    const archiveEntries = readObservationFile(archiveFile, window, 'archive');
    if (archiveEntries.length > 0) {
      matchingSourceFiles.add(archiveFile);
      allEntries.push(...archiveEntries);
    }
  }

  allEntries.sort((a, b) => a.timestamp - b.timestamp);

  return {
    entries: allEntries,
    currentFile: project.observations_file,
    archiveDir,
    archiveFilesScanned: archiveFiles.length,
    matchingSourceFiles: [...matchingSourceFiles].sort()
  };
}

function increment(map, key) {
  if (!key) {
    return;
  }
  map.set(key, (map.get(key) || 0) + 1);
}

function mapToSortedArray(map, keyName, valueName = 'count') {
  return [...map.entries()]
    .map(([key, value]) => ({ [keyName]: key, [valueName]: value }))
    .sort((a, b) => b[valueName] - a[valueName] || String(a[keyName]).localeCompare(String(b[keyName])));
}

function tryParseJsonString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function normalizeCommand(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractCommand(entry) {
  if (!entry || entry.tool !== 'Bash' || entry.event !== 'tool_start') {
    return '';
  }

  if (typeof entry.input === 'string') {
    const parsed = tryParseJsonString(entry.input);
    if (parsed && typeof parsed.command === 'string') {
      return normalizeCommand(parsed.command);
    }
    return normalizeCommand(entry.input);
  }

  if (entry.input && typeof entry.input.command === 'string') {
    return normalizeCommand(entry.input.command);
  }

  return '';
}

function extractFilePath(entry) {
  if (!entry || entry.tool !== 'Edit') {
    return '';
  }

  if (typeof entry.input === 'string') {
    const parsed = tryParseJsonString(entry.input);
    if (parsed && typeof parsed.file_path === 'string') {
      return parsed.file_path;
    }
  }

  if (entry.input && typeof entry.input.file_path === 'string') {
    return entry.input.file_path;
  }

  return '';
}

function buildWorkflowPairs(entries) {
  const pairCounts = new Map();
  const bySession = new Map();

  for (const entry of entries) {
    const sessionId = entry.session || 'unknown';
    if (!bySession.has(sessionId)) {
      bySession.set(sessionId, []);
    }
    bySession.get(sessionId).push(entry);
  }

  for (const sessionEntries of bySession.values()) {
    sessionEntries.sort((a, b) => a.timestamp - b.timestamp);
    for (let i = 0; i < sessionEntries.length - 1; i++) {
      const pair = `${sessionEntries[i].tool} -> ${sessionEntries[i + 1].tool}`;
      increment(pairCounts, pair);
    }
  }

  return mapToSortedArray(pairCounts, 'sequence');
}

function buildAutomationCandidates(commandCounts, fileCounts, workflowPairs) {
  const candidates = [];

  for (const { command, count } of commandCounts) {
    const normalized = normalizeCommand(command);
    if (!normalized || TRIVIAL_COMMANDS.has(normalized)) {
      continue;
    }
    const family = normalized.split(' ')[0];

    if (count >= 2 && MCP_COMMAND_PREFIXES.has(family)) {
      candidates.push({
        kind: 'mcp',
        signal: 'repeated-external-cli',
        item: normalized,
        count,
        rationale: `Repeated ${family} workflow ${count} times this week; a dedicated MCP integration could reduce manual shell usage.`
      });
      continue;
    }

    if (count >= 3) {
      candidates.push({
        kind: 'script',
        signal: 'repeated-shell-command',
        item: normalized,
        count,
        rationale: `Repeated the same shell command ${count} times this week; likely a good candidate for a dedicated script or custom command.`
      });
    }
  }

  for (const { sequence, count } of workflowPairs) {
    if (count < 3 || !/Bash -> Edit|Bash -> Read|Read -> Edit/i.test(sequence)) {
      continue;
    }
    candidates.push({
      kind: 'workflow',
      signal: 'repeated-tool-sequence',
      item: sequence,
      count,
      rationale: `Observed the same multi-step tool sequence ${count} times; consider turning it into a documented scripted workflow.`
    });
  }

  for (const { file_path: filePath, count } of fileCounts) {
    if (count < 3) {
      continue;
    }
    candidates.push({
      kind: 'file-hotspot',
      signal: 'repeated-file-touchpoint',
      item: filePath,
      count,
      rationale: `The same file was touched ${count} times this week; check whether a dedicated helper, command, or MCP-backed workflow could remove repetitive manual steps.`
    });
  }

  return candidates
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind))
    .slice(0, 10);
}

function summarizeWeeklyObservations(project, collected, window) {
  const toolCounts = new Map();
  const eventCounts = new Map();
  const sessionCounts = new Set();
  const commandCounts = new Map();
  const fileCounts = new Map();

  for (const entry of collected.entries) {
    increment(toolCounts, entry.tool || 'unknown');
    increment(eventCounts, entry.event || 'unknown');
    if (entry.session) {
      sessionCounts.add(entry.session);
    }

    const command = extractCommand(entry);
    if (command) {
      increment(commandCounts, command);
    }

    const filePath = extractFilePath(entry);
    if (filePath) {
      increment(fileCounts, filePath);
    }
  }

  const topCommands = mapToSortedArray(commandCounts, 'command').slice(0, 10);
  const topFiles = mapToSortedArray(fileCounts, 'file_path').slice(0, 10);
  const repeatedWorkflows = buildWorkflowPairs(collected.entries).slice(0, 10);
  const automationCandidates = buildAutomationCandidates(topCommands, topFiles, repeatedWorkflows);

  return {
    period: window.week,
    generated_at: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      root: project.root || ''
    },
    window: {
      start: window.start.toISOString(),
      end: window.endInclusive.toISOString()
    },
    sources: {
      current_observations_file: collected.currentFile,
      archive_directory: collected.archiveDir,
      archive_files_scanned: collected.archiveFilesScanned,
      matching_source_files: collected.matchingSourceFiles
    },
    observation_count: collected.entries.length,
    session_count: sessionCounts.size,
    tool_counts: mapToSortedArray(toolCounts, 'tool'),
    event_counts: mapToSortedArray(eventCounts, 'event'),
    top_commands: topCommands,
    top_files: topFiles,
    repeated_workflows: repeatedWorkflows,
    automation_candidates: automationCandidates,
    notes: [
      'Weekly retrospectives intentionally focus on repeated or costly workflows rather than capturing every interaction.',
      'Monthly rollups remain deferred until weekly summaries prove useful.'
    ]
  };
}

function getWeeklyRetrospectivePath(project, weekKey) {
  return path.join(project.project_dir, 'retrospectives', 'weekly', `${weekKey}.json`);
}

function formatSummaryText(summary) {
  const lines = [
    `Weekly retrospective written for ${summary.project.name} (${summary.period})`,
    `Observations: ${summary.observation_count}`,
    `Sessions: ${summary.session_count}`,
    `Window: ${summary.window.start} -> ${summary.window.end}`
  ];

  if (summary.automation_candidates.length > 0) {
    lines.push('Automation candidates:');
    for (const candidate of summary.automation_candidates.slice(0, 5)) {
      lines.push(`- ${candidate.kind}: ${candidate.item} (${candidate.count})`);
    }
  } else {
    lines.push('Automation candidates: none yet');
  }

  if (summary.top_files.length > 0) {
    lines.push('Top repeated files:');
    for (const entry of summary.top_files.slice(0, 3)) {
      lines.push(`- ${entry.file_path} (${entry.count})`);
    }
  }

  return lines.join('\n');
}

function createRetrospectiveRuntime(options = {}) {
  const detectProject = options.detectProject;

  if (typeof detectProject !== 'function') {
    throw new Error('createRetrospectiveRuntime requires detectProject');
  }

  function generateWeeklyRetrospective(runtimeOptions = {}) {
    const weekParts = runtimeOptions.week
      ? parseWeekSpec(runtimeOptions.week)
      : getIsoWeekForDate(runtimeOptions.now || new Date());
    const window = getIsoWeekWindow(weekParts);
    const project = runtimeOptions.project || detectProject(runtimeOptions.cwd || process.cwd());
    const collected = collectWeeklyObservations(project, window);
    const summary = summarizeWeeklyObservations(project, collected, window);
    const outputPath = runtimeOptions.outputPath || getWeeklyRetrospectivePath(project, window.week);

    if (runtimeOptions.write !== false) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf8');
    }

    return {
      summary,
      outputPath,
      text: formatSummaryText(summary)
    };
  }

  function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv);
    const result = generateWeeklyRetrospective({
      cwd: args.cwd,
      week: args.week
    });

    if (args.format === 'json') {
      process.stdout.write(JSON.stringify(result.summary, null, 2));
      return;
    }

    process.stdout.write(result.text + '\n');
    process.stdout.write(`Summary file: ${result.outputPath}\n`);
  }

  return {
    buildAutomationCandidates,
    collectWeeklyObservations,
    extractCommand,
    extractFilePath,
    formatSummaryText,
    generateWeeklyRetrospective,
    getIsoWeekForDate,
    getIsoWeekWindow,
    getWeeklyRetrospectivePath,
    main,
    parseWeekSpec,
    summarizeWeeklyObservations
  };
}

module.exports = {
  createRetrospectiveRuntime
};

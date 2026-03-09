const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, createTestDir, cleanupTestDir } = require('../helpers/test-runner');
const {
  generateWeeklyRetrospective,
  getIsoWeekWindow,
  parseWeekSpec
} = require('../../skills/continuous-learning-v2/scripts/retrospect-week.js');

function appendObservation(filePath, observation) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(observation) + '\n', 'utf8');
}

function runTests() {
  console.log('\n=== Testing continuous-learning weekly retrospective ===\n');

  let passed = 0;
  let failed = 0;

  if (test('parseWeekSpec validates ISO week format', () => {
    assert.deepStrictEqual(parseWeekSpec('2026-W11'), { year: 2026, week: 11, key: '2026-W11' });
    assert.throws(() => parseWeekSpec('2026-11'), /Invalid week format/);
    assert.throws(() => parseWeekSpec('2026-W99'), /Invalid ISO week/);
  })) passed++; else failed++;

  if (test('getIsoWeekWindow returns Monday-start local window', () => {
    const window = getIsoWeekWindow('2026-W11');
    assert.strictEqual(window.week, '2026-W11');
    assert.strictEqual(window.start.getDay(), 1);
    assert.strictEqual(window.start.getFullYear(), 2026);
    assert.strictEqual(window.start.getMonth(), 2);
    assert.strictEqual(window.start.getDate(), 9);
  })) passed++; else failed++;

  if (test('generateWeeklyRetrospective reads live and archived observations for one week', () => {
    const tempDir = createTestDir('weekly-retro-');
    try {
      const projectDir = path.join(tempDir, 'homunculus', 'projects', 'abc123');
      const observationsFile = path.join(projectDir, 'observations.jsonl');
      const archiveDir = path.join(projectDir, 'observations.archive');
      const project = {
        id: 'abc123',
        name: 'demo-project',
        root: path.join(tempDir, 'repo'),
        project_dir: projectDir,
        observations_file: observationsFile
      };

      appendObservation(observationsFile, {
        timestamp: '2026-03-10T08:00:00Z',
        event: 'tool_start',
        tool: 'Bash',
        session: 's1',
        input: '{"command":"gh pr create"}'
      });
      appendObservation(observationsFile, {
        timestamp: '2026-03-10T08:01:00Z',
        event: 'tool_start',
        tool: 'Edit',
        session: 's1',
        input: '{"file_path":"src/app.ts"}'
      });
      appendObservation(observationsFile, {
        timestamp: '2026-03-15T08:00:00Z',
        event: 'tool_start',
        tool: 'Bash',
        session: 's2',
        input: '{"command":"npm test"}'
      });

      appendObservation(path.join(archiveDir, 'processed-1.jsonl'), {
        timestamp: '2026-03-11T09:00:00Z',
        event: 'tool_start',
        tool: 'Bash',
        session: 's1',
        input: '{"command":"gh pr create"}'
      });
      appendObservation(path.join(archiveDir, 'processed-1.jsonl'), {
        timestamp: '2026-03-12T09:00:00Z',
        event: 'tool_start',
        tool: 'Bash',
        session: 's3',
        input: '{"command":"gh pr create"}'
      });
      appendObservation(path.join(archiveDir, 'processed-1.jsonl'), {
        timestamp: '2026-03-12T09:01:00Z',
        event: 'tool_start',
        tool: 'Edit',
        session: 's3',
        input: '{"file_path":"src/app.ts"}'
      });
      appendObservation(path.join(archiveDir, 'processed-2.jsonl'), {
        timestamp: '2026-03-13T10:00:00Z',
        event: 'tool_start',
        tool: 'Bash',
        session: 's4',
        input: '{"command":"npm test"}'
      });
      appendObservation(path.join(archiveDir, 'processed-2.jsonl'), {
        timestamp: '2026-03-15T10:00:00Z',
        event: 'tool_start',
        tool: 'Bash',
        session: 's4',
        input: '{"command":"npm test"}'
      });
      appendObservation(path.join(archiveDir, 'processed-2.jsonl'), {
        timestamp: 'not-a-date',
        event: 'tool_start',
        tool: 'Bash',
        session: 's4',
        input: '{"command":"ignored"}'
      });

      const result = generateWeeklyRetrospective({
        project,
        week: '2026-W11'
      });

      assert.strictEqual(result.summary.period, '2026-W11');
      assert.strictEqual(result.summary.observation_count, 8);
      assert.strictEqual(result.summary.session_count, 4);
      assert.strictEqual(result.summary.sources.archive_files_scanned, 2);
      assert.strictEqual(result.summary.sources.matching_source_files.length, 3);
      assert.deepStrictEqual(result.summary.tool_counts[0], { tool: 'Bash', count: 6 });
      assert.deepStrictEqual(result.summary.top_commands[0], { command: 'gh pr create', count: 3 });
      assert.deepStrictEqual(result.summary.top_files[0], { file_path: 'src/app.ts', count: 2 });
      assert.ok(result.summary.automation_candidates.some((candidate) =>
        candidate.kind === 'mcp' && candidate.item === 'gh pr create' && candidate.count === 3
      ));
      assert.ok(result.summary.automation_candidates.some((candidate) =>
        candidate.kind === 'script' && candidate.item === 'npm test' && candidate.count === 3
      ));
      assert.ok(fs.existsSync(result.outputPath), 'Expected weekly summary file to be written');

      const written = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
      assert.strictEqual(written.period, '2026-W11');
      assert.strictEqual(written.automation_candidates.length >= 2, true);
    } finally {
      cleanupTestDir(tempDir);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { TOOL_WORKFLOW_CONTRACT, TOOL_ORDER } = require('./lib/tool-workflow-contract');

const DEFAULT_DOC_PATH = path.join('docs', 'tools', 'workflow-matrix.md');

function parseArgs(argv) {
  const formatArg = argv.find(arg => arg.startsWith('--format='));
  if (formatArg) {
    return { format: formatArg.split('=')[1] || 'text' };
  }

  const formatIndex = argv.indexOf('--format');
  if (formatIndex >= 0) {
    return { format: argv[formatIndex + 1] || 'text' };
  }

  return { format: 'text' };
}

function buildDocChecks(docContent) {
  const checks = [];
  const lines = docContent.split(/\r?\n/);

  for (const workflow of TOOL_WORKFLOW_CONTRACT.workflows) {
    const row = lines.find(line => line.startsWith(`| \`${workflow.id}\` |`));

    checks.push({
      kind: 'workflow-heading',
      workflowId: workflow.id,
      ok: Boolean(row)
    });

    for (const tool of TOOL_ORDER) {
      const toolDefinition = workflow.tools[tool];
      const docMarker = toolDefinition.artifactMappings[toolDefinition.artifactMappings.length - 1].path;
      checks.push({
        kind: 'status-label',
        workflowId: workflow.id,
        tool,
        ok: Boolean(row) && row.includes(toolDefinition.status) && row.includes(docMarker)
      });
    }
  }

  return checks;
}

function getDocFailures(rootDir, docPath) {
  const failures = [];
  let checked = 0;

  if (!fs.existsSync(docPath)) {
    failures.push({
      kind: 'missing-doc',
      path: path.relative(rootDir, docPath) || docPath,
      message: 'workflow matrix is missing'
    });
    return { checked, failures };
  }

  const docContent = fs.readFileSync(docPath, 'utf8');
  for (const check of buildDocChecks(docContent)) {
    checked += 1;
    if (!check.ok) {
      failures.push({
        kind: check.kind,
        workflowId: check.workflowId,
        tool: check.tool,
        message:
          check.kind === 'workflow-heading'
            ? `workflow matrix is missing the \`${check.workflowId}\` row`
            : `workflow matrix is missing the \`${check.workflowId}\` ${check.tool} status`
      });
    }
  }

  return { checked, failures };
}

function getRequiredFileFailures(rootDir) {
  const failures = [];
  let checked = 0;

  for (const workflow of TOOL_WORKFLOW_CONTRACT.workflows) {
    for (const tool of TOOL_ORDER) {
      const definition = workflow.tools[tool];
      for (const relativeFile of definition.requiredFiles) {
        checked += 1;
        const absoluteFile = path.join(rootDir, relativeFile);
        if (!fs.existsSync(absoluteFile)) {
          failures.push({
            kind: 'missing-file',
            workflowId: workflow.id,
            tool,
            path: relativeFile,
            message: `required file is missing for ${workflow.id}/${tool}: ${relativeFile}`
          });
        }
      }
    }
  }

  return { checked, failures };
}

function reportResult(result, io, format) {
  if (format === 'json') {
    io.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.ok) {
    io.log(`Verified ${result.checked} workflow setup checks across ${TOOL_WORKFLOW_CONTRACT.workflows.length} workflows.`);
    return;
  }

  io.error(`Tool setup verification failed with ${result.failures.length} issue(s):`);
  for (const failure of result.failures) {
    const context = [failure.workflowId, failure.tool, failure.path].filter(Boolean).join(' ');
    io.error(`- ${context}: ${failure.message}`.trim());
  }
}

function evaluateToolSetups(options = {}) {
  const rootDir = options.rootDir || path.join(__dirname, '..');
  const docPath = options.docPath || path.join(rootDir, DEFAULT_DOC_PATH);
  const io = options.io || console;
  const docResult = getDocFailures(rootDir, docPath);
  const fileResult = getRequiredFileFailures(rootDir);

  const result = {
    ok: docResult.failures.length === 0 && fileResult.failures.length === 0,
    checked: docResult.checked + fileResult.checked,
    failures: [...docResult.failures, ...fileResult.failures]
  };

  reportResult(result, io, options.format);

  return {
    exitCode: result.ok ? 0 : 1,
    result
  };
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const { exitCode } = evaluateToolSetups({ format: args.format });
  process.exit(exitCode);
}

module.exports = {
  evaluateToolSetups
};

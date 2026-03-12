#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { TOOL_WORKFLOW_CONTRACT } = require('./lib/tool-workflow-contract');
const { summarizeTool } = require('./smoke-tool-setups');

function resolveWorkspaceRoot(scriptDir) {
  const installedRepoRoot = path.join(scriptDir, '..', '..');
  if (fs.existsSync(path.join(installedRepoRoot, '.claude'))) {
    return installedRepoRoot;
  }
  return path.join(scriptDir, '..');
}

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

function readRepoFile(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  return {
    relativePath,
    exists: fs.existsSync(absolutePath),
    content: fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : ''
  };
}

function buildPlanChecks(files) {
  return {
    workflow: 'plan',
    checks: [
      {
        path: 'AGENTS.md',
        ok: files['AGENTS.md'].exists && files['AGENTS.md'].content.includes('Plan Before Execute'),
        message: 'root AGENTS.md should require planning before execution'
      },
      {
        path: 'commands/plan.md',
        ok: files['commands/plan.md'].exists,
        message: 'Claude plan command should exist'
      },
      {
        path: 'agents/planner.md',
        ok: files['agents/planner.md'].exists,
        message: 'Claude planner agent should exist'
      }
    ]
  };
}

function buildTddChecks(files) {
  return {
    workflow: 'tdd',
    checks: [
      {
        path: 'AGENTS.md',
        ok: files['AGENTS.md'].exists && files['AGENTS.md'].content.includes('**TDD workflow (mandatory):**'),
        message: 'root AGENTS.md should require TDD'
      },
      {
        path: 'commands/tdd.md',
        ok: files['commands/tdd.md'].exists,
        message: 'Claude TDD command should exist'
      },
      {
        path: 'agents/tdd-guide.md',
        ok: files['agents/tdd-guide.md'].exists,
        message: 'Claude TDD guide agent should exist'
      },
      {
        path: 'skills/tdd-workflow/SKILL.md',
        ok: files['skills/tdd-workflow/SKILL.md'].exists && files['skills/tdd-workflow/SKILL.md'].content.includes('Test-Driven Development Workflow'),
        message: 'Claude TDD skill should exist and describe the workflow'
      }
    ]
  };
}

function buildCodeReviewChecks(files) {
  return {
    workflow: 'code-review',
    checks: [
      {
        path: 'commands/code-review.md',
        ok: files['commands/code-review.md'].exists,
        message: 'Claude code-review command should exist'
      },
      {
        path: 'agents/code-reviewer.md',
        ok: files['agents/code-reviewer.md'].exists,
        message: 'Claude code-reviewer agent should exist'
      }
    ]
  };
}

function buildVerifyChecks(files) {
  return {
    workflow: 'verify',
    checks: [
      {
        path: 'commands/verify.md',
        ok: files['commands/verify.md'].exists,
        message: 'Claude verify command should exist'
      },
      {
        path: 'skills/verification-loop/SKILL.md',
        ok: files['skills/verification-loop/SKILL.md'].exists && files['skills/verification-loop/SKILL.md'].content.includes('Verification Loop'),
        message: 'Claude verification-loop skill should exist and describe the workflow'
      }
    ]
  };
}

function buildSecurityChecks(files) {
  return {
    workflow: 'security',
    checks: [
      {
        path: 'agents/security-reviewer.md',
        ok: files['agents/security-reviewer.md'].exists,
        message: 'Claude security-reviewer agent should exist'
      },
      {
        path: 'skills/security-review/SKILL.md',
        ok: files['skills/security-review/SKILL.md'].exists && files['skills/security-review/SKILL.md'].content.includes('Security Review'),
        message: 'Claude security-review skill should exist and describe the workflow'
      }
    ]
  };
}

function buildE2eChecks(files) {
  return {
    workflow: 'e2e',
    checks: [
      {
        path: 'commands/e2e.md',
        ok: files['commands/e2e.md'].exists,
        message: 'Claude e2e command should exist'
      },
      {
        path: 'agents/e2e-runner.md',
        ok: files['agents/e2e-runner.md'].exists,
        message: 'Claude e2e-runner agent should exist'
      },
      {
        path: 'skills/e2e-testing/SKILL.md',
        ok: files['skills/e2e-testing/SKILL.md'].exists && files['skills/e2e-testing/SKILL.md'].content.includes('E2E Testing'),
        message: 'Claude e2e-testing skill should exist and describe the workflow'
      }
    ]
  };
}

function buildSmokeChecks(files, options = {}) {
  const claudeSummary = summarizeTool('claude', TOOL_WORKFLOW_CONTRACT.smokeProbes.claude || [], options);
  const hasRequiredFiles = [
    files['commands/smoke.md'],
    files['docs/testing/manual-verification/claude-code.md']
  ].every(file => file && file.exists);
  const cliPass = claudeSummary.status === 'PASS';
  const cliSkip = claudeSummary.status === 'SKIP';
  const cliFail = claudeSummary.status === 'FAIL';
  const cliDetails = claudeSummary.probes.map(probe => `${probe.command} - ${probe.detail}`).join('; ');

  return {
    workflow: 'smoke',
    checks: [
      {
        path: 'commands/smoke.md',
        ok: files['commands/smoke.md'].exists,
        message: 'Claude smoke command should exist'
      },
      {
        path: 'docs/testing/manual-verification/claude-code.md',
        ok: files['docs/testing/manual-verification/claude-code.md'].exists,
        message: 'Claude manual verification guide should exist'
      },
      {
        path: 'claude-template/hooks.json',
        ok: files['claude-template/hooks.json'].exists,
        message: 'Claude hook source config should exist'
      },
      {
        path: 'claude CLI probes',
        ok: cliPass || cliSkip,
        statusOverride: cliSkip ? 'SKIP' : undefined,
        message: cliSkip
          ? `Claude CLI smoke was skipped: ${cliDetails}`
          : cliFail
            ? `Claude CLI smoke failed: ${cliDetails}`
            : 'Claude CLI smoke probes passed'
      }
    ],
    statusOverride: hasRequiredFiles && cliSkip ? 'SKIP' : undefined
  };
}

function buildWorkflowChecks(files, options = {}) {
  return [
    buildPlanChecks(files),
    buildTddChecks(files),
    buildCodeReviewChecks(files),
    buildVerifyChecks(files),
    buildSmokeChecks(files, options),
    buildSecurityChecks(files),
    buildE2eChecks(files)
  ];
}

function buildInstalledPlanChecks(files) {
  return {
    workflow: 'plan',
    checks: [
      {
        path: '.claude/commands/plan.md',
        ok: files['.claude/commands/plan.md'].exists,
        message: 'Installed Claude plan command should exist'
      },
      {
        path: '.claude/agents/planner.md',
        ok: files['.claude/agents/planner.md'].exists,
        message: 'Installed Claude planner agent should exist'
      }
    ]
  };
}

function buildInstalledTddChecks(files) {
  return {
    workflow: 'tdd',
    checks: [
      {
        path: '.claude/commands/tdd.md',
        ok: files['.claude/commands/tdd.md'].exists,
        message: 'Installed Claude TDD command should exist'
      },
      {
        path: '.claude/agents/tdd-guide.md',
        ok: files['.claude/agents/tdd-guide.md'].exists,
        message: 'Installed Claude TDD guide agent should exist'
      },
      {
        path: '.claude/skills/tdd-workflow/SKILL.md',
        ok: files['.claude/skills/tdd-workflow/SKILL.md'].exists && files['.claude/skills/tdd-workflow/SKILL.md'].content.includes('Test-Driven Development Workflow'),
        message: 'Installed Claude TDD skill should exist and describe the workflow'
      }
    ]
  };
}

function buildInstalledCodeReviewChecks(files) {
  return {
    workflow: 'code-review',
    checks: [
      {
        path: '.claude/commands/code-review.md',
        ok: files['.claude/commands/code-review.md'].exists,
        message: 'Installed Claude code-review command should exist'
      },
      {
        path: '.claude/agents/code-reviewer.md',
        ok: files['.claude/agents/code-reviewer.md'].exists,
        message: 'Installed Claude code-reviewer agent should exist'
      }
    ]
  };
}

function buildInstalledVerifyChecks(files) {
  return {
    workflow: 'verify',
    checks: [
      {
        path: '.claude/commands/verify.md',
        ok: files['.claude/commands/verify.md'].exists,
        message: 'Installed Claude verify command should exist'
      },
      {
        path: '.claude/skills/verification-loop/SKILL.md',
        ok: files['.claude/skills/verification-loop/SKILL.md'].exists && files['.claude/skills/verification-loop/SKILL.md'].content.includes('Verification Loop'),
        message: 'Installed Claude verification-loop skill should exist and describe the workflow'
      }
    ]
  };
}

function buildInstalledSecurityChecks(files) {
  return {
    workflow: 'security',
    checks: [
      {
        path: '.claude/agents/security-reviewer.md',
        ok: files['.claude/agents/security-reviewer.md'].exists,
        message: 'Installed Claude security-reviewer agent should exist'
      },
      {
        path: '.claude/skills/security-review/SKILL.md',
        ok: files['.claude/skills/security-review/SKILL.md'].exists && files['.claude/skills/security-review/SKILL.md'].content.includes('Security Review'),
        message: 'Installed Claude security-review skill should exist and describe the workflow'
      }
    ]
  };
}

function buildInstalledE2eChecks(files) {
  return {
    workflow: 'e2e',
    checks: [
      {
        path: '.claude/commands/e2e.md',
        ok: files['.claude/commands/e2e.md'].exists,
        message: 'Installed Claude e2e command should exist'
      },
      {
        path: '.claude/agents/e2e-runner.md',
        ok: files['.claude/agents/e2e-runner.md'].exists,
        message: 'Installed Claude e2e-runner agent should exist'
      },
      {
        path: '.claude/skills/e2e-testing/SKILL.md',
        ok: files['.claude/skills/e2e-testing/SKILL.md'].exists && files['.claude/skills/e2e-testing/SKILL.md'].content.includes('E2E Testing'),
        message: 'Installed Claude e2e-testing skill should exist and describe the workflow'
      }
    ]
  };
}

function buildInstalledSmokeChecks(files, options = {}) {
  const claudeSummary = summarizeTool('claude', TOOL_WORKFLOW_CONTRACT.smokeProbes.claude || [], options);
  const cliPass = claudeSummary.status === 'PASS';
  const cliSkip = claudeSummary.status === 'SKIP';
  const cliFail = claudeSummary.status === 'FAIL';
  const cliDetails = claudeSummary.probes.map(probe => `${probe.command} - ${probe.detail}`).join('; ');

  return {
    workflow: 'smoke',
    checks: [
      {
        path: '.claude/commands/smoke.md',
        ok: files['.claude/commands/smoke.md'].exists,
        message: 'Installed Claude smoke command should exist'
      },
      {
        path: '.claude/settings.json',
        ok: files['.claude/settings.json'].exists,
        message: 'Installed Claude settings.json should exist'
      },
      {
        path: '.claude/mdt/scripts/smoke-claude-workflows.js',
        ok: files['.claude/mdt/scripts/smoke-claude-workflows.js'].exists,
        message: 'Installed Claude workflow smoke script should exist'
      },
      {
        path: 'claude CLI probes',
        ok: cliPass || cliSkip,
        statusOverride: cliSkip ? 'SKIP' : undefined,
        message: cliSkip
          ? `Claude CLI smoke was skipped: ${cliDetails}`
          : cliFail
            ? `Claude CLI smoke failed: ${cliDetails}`
            : 'Claude CLI smoke probes passed'
      }
    ],
    statusOverride: cliSkip ? 'SKIP' : undefined
  };
}

function buildInstalledWorkflowChecks(files, options = {}) {
  return [
    buildInstalledPlanChecks(files),
    buildInstalledTddChecks(files),
    buildInstalledCodeReviewChecks(files),
    buildInstalledVerifyChecks(files),
    buildInstalledSmokeChecks(files, options),
    buildInstalledSecurityChecks(files),
    buildInstalledE2eChecks(files)
  ];
}

function smokeClaudeWorkflows(options = {}) {
  const rootDir = options.rootDir || resolveWorkspaceRoot(__dirname);
  const io = options.io || console;
  const installedRepoMode = !fs.existsSync(path.join(rootDir, 'commands')) && fs.existsSync(path.join(rootDir, '.claude'));
  const files = installedRepoMode
    ? {
        '.claude/commands/plan.md': readRepoFile(rootDir, path.join('.claude', 'commands', 'plan.md')),
        '.claude/agents/planner.md': readRepoFile(rootDir, path.join('.claude', 'agents', 'planner.md')),
        '.claude/commands/tdd.md': readRepoFile(rootDir, path.join('.claude', 'commands', 'tdd.md')),
        '.claude/agents/tdd-guide.md': readRepoFile(rootDir, path.join('.claude', 'agents', 'tdd-guide.md')),
        '.claude/skills/tdd-workflow/SKILL.md': readRepoFile(rootDir, path.join('.claude', 'skills', 'tdd-workflow', 'SKILL.md')),
        '.claude/commands/code-review.md': readRepoFile(rootDir, path.join('.claude', 'commands', 'code-review.md')),
        '.claude/agents/code-reviewer.md': readRepoFile(rootDir, path.join('.claude', 'agents', 'code-reviewer.md')),
        '.claude/commands/verify.md': readRepoFile(rootDir, path.join('.claude', 'commands', 'verify.md')),
        '.claude/skills/verification-loop/SKILL.md': readRepoFile(rootDir, path.join('.claude', 'skills', 'verification-loop', 'SKILL.md')),
        '.claude/commands/smoke.md': readRepoFile(rootDir, path.join('.claude', 'commands', 'smoke.md')),
        '.claude/settings.json': readRepoFile(rootDir, path.join('.claude', 'settings.json')),
        '.claude/mdt/scripts/smoke-claude-workflows.js': readRepoFile(rootDir, path.join('.claude', 'mdt', 'scripts', 'smoke-claude-workflows.js')),
        '.claude/agents/security-reviewer.md': readRepoFile(rootDir, path.join('.claude', 'agents', 'security-reviewer.md')),
        '.claude/skills/security-review/SKILL.md': readRepoFile(rootDir, path.join('.claude', 'skills', 'security-review', 'SKILL.md')),
        '.claude/commands/e2e.md': readRepoFile(rootDir, path.join('.claude', 'commands', 'e2e.md')),
        '.claude/agents/e2e-runner.md': readRepoFile(rootDir, path.join('.claude', 'agents', 'e2e-runner.md')),
        '.claude/skills/e2e-testing/SKILL.md': readRepoFile(rootDir, path.join('.claude', 'skills', 'e2e-testing', 'SKILL.md'))
      }
    : {
        'AGENTS.md': readRepoFile(rootDir, 'AGENTS.md'),
        'commands/plan.md': readRepoFile(rootDir, path.join('commands', 'plan.md')),
        'agents/planner.md': readRepoFile(rootDir, path.join('agents', 'planner.md')),
        'commands/tdd.md': readRepoFile(rootDir, path.join('commands', 'tdd.md')),
        'agents/tdd-guide.md': readRepoFile(rootDir, path.join('agents', 'tdd-guide.md')),
        'skills/tdd-workflow/SKILL.md': readRepoFile(rootDir, path.join('skills', 'tdd-workflow', 'SKILL.md')),
        'commands/code-review.md': readRepoFile(rootDir, path.join('commands', 'code-review.md')),
        'agents/code-reviewer.md': readRepoFile(rootDir, path.join('agents', 'code-reviewer.md')),
        'commands/verify.md': readRepoFile(rootDir, path.join('commands', 'verify.md')),
        'skills/verification-loop/SKILL.md': readRepoFile(rootDir, path.join('skills', 'verification-loop', 'SKILL.md')),
        'commands/smoke.md': readRepoFile(rootDir, path.join('commands', 'smoke.md')),
        'docs/testing/manual-verification/claude-code.md': readRepoFile(rootDir, path.join('docs', 'testing', 'manual-verification', 'claude-code.md')),
        'claude-template/hooks.json': readRepoFile(rootDir, path.join('claude-template', 'hooks.json')),
        'agents/security-reviewer.md': readRepoFile(rootDir, path.join('agents', 'security-reviewer.md')),
        'skills/security-review/SKILL.md': readRepoFile(rootDir, path.join('skills', 'security-review', 'SKILL.md')),
        'commands/e2e.md': readRepoFile(rootDir, path.join('commands', 'e2e.md')),
        'agents/e2e-runner.md': readRepoFile(rootDir, path.join('agents', 'e2e-runner.md')),
        'skills/e2e-testing/SKILL.md': readRepoFile(rootDir, path.join('skills', 'e2e-testing', 'SKILL.md'))
      };

  const workflows = (installedRepoMode ? buildInstalledWorkflowChecks(files, options) : buildWorkflowChecks(files, options)).map(entry => {
    const failures = entry.checks.filter(check => !check.ok);
    const skips = entry.checks.filter(check => check.statusOverride === 'SKIP');
    return {
      workflow: entry.workflow,
      status: entry.statusOverride || (failures.length === 0 ? (skips.length > 0 ? 'SKIP' : 'PASS') : 'FAIL'),
      checks: entry.checks,
      failures,
      skips
    };
  });

  const result = {
    ok: workflows.every(workflow => workflow.status !== 'FAIL'),
    workflows
  };

  if (options.format === 'json') {
    io.log(JSON.stringify(result, null, 2));
  } else {
    io.log(`Claude workflow smoke (${installedRepoMode ? 'installed-target' : 'repo-source'} mode):`);
    for (const workflow of workflows) {
      io.log(`- ${workflow.workflow}: ${workflow.status}`);
      for (const failure of workflow.failures) {
        io.log(`  FAIL ${failure.path} - ${failure.message}`);
      }
      for (const skip of workflow.skips) {
        io.log(`  SKIP ${skip.path} - ${skip.message}`);
      }
    }
  }

  return {
    exitCode: result.ok ? 0 : 1,
    result
  };
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const { exitCode } = smokeClaudeWorkflows({ format: args.format });
  process.exit(exitCode);
}

module.exports = {
  resolveWorkspaceRoot,
  smokeClaudeWorkflows
};

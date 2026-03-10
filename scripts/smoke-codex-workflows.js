#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { TOOL_WORKFLOW_CONTRACT } = require('./lib/tool-workflow-contract');
const { summarizeTool } = require('./smoke-tool-setups');

function resolveWorkspaceRoot(scriptDir) {
  const installedRepoRoot = path.join(scriptDir, '..', '..');
  if (fs.existsSync(path.join(installedRepoRoot, '.codex'))) {
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

function readUserCodexFile(relativePath, homeDir = process.env.HOME || process.env.USERPROFILE || '') {
  const absolutePath = homeDir ? path.join(homeDir, '.codex', relativePath) : '';
  return {
    relativePath: path.join('~/.codex', relativePath),
    exists: Boolean(absolutePath) && fs.existsSync(absolutePath),
    content: absolutePath && fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : ''
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
        path: 'AGENTS.md',
        ok: files['AGENTS.md'].exists && files['AGENTS.md'].content.includes('| planner |'),
        message: 'root AGENTS.md should expose the planner agent'
      },
      {
        path: 'codex-template/AGENTS.md',
        ok: files['codex-template/AGENTS.md'].exists && files['codex-template/AGENTS.md'].content.includes('Complex features, architecture'),
        message: 'Codex AGENTS should recommend the planning model path for complex work'
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
        path: 'codex-template/AGENTS.md',
        ok: files['codex-template/AGENTS.md'].exists && files['codex-template/AGENTS.md'].content.includes('tdd-workflow'),
        message: 'Codex AGENTS should advertise the tdd-workflow skill'
      },
      {
        path: 'codex-template/skills/tdd-workflow/SKILL.md',
        ok: files['codex-template/skills/tdd-workflow/SKILL.md'].exists && files['codex-template/skills/tdd-workflow/SKILL.md'].content.includes('Test-Driven Development Workflow'),
        message: 'Codex TDD skill should exist and describe the workflow'
      },
      {
        path: 'codex-template/config.toml',
        ok:
          files['codex-template/config.toml'].exists &&
          files['codex-template/config.toml'].content.includes('approval_policy = "on-request"') &&
          files['codex-template/config.toml'].content.includes('sandbox_mode = "workspace-write"'),
        message: 'Codex config should stay minimal and define approval + sandbox defaults'
      }
    ]
  };
}

function buildVerifyChecks(files) {
  return {
    workflow: 'verify',
    checks: [
      {
        path: 'codex-template/AGENTS.md',
        ok: files['codex-template/AGENTS.md'].exists && files['codex-template/AGENTS.md'].content.includes('verification-loop'),
        message: 'Codex AGENTS should advertise the verification-loop skill'
      },
      {
        path: 'codex-template/skills/verification-loop/SKILL.md',
        ok: files['codex-template/skills/verification-loop/SKILL.md'].exists && files['codex-template/skills/verification-loop/SKILL.md'].content.includes('Verification Loop Skill'),
        message: 'Codex verification skill should exist and describe the verification loop'
      },
      {
        path: 'codex-template/config.toml',
        ok:
          files['codex-template/config.toml'].exists &&
          files['codex-template/config.toml'].content.includes('sandbox_mode = "workspace-write"'),
        message: 'Codex config should stay minimal and provide the expected verification sandbox defaults'
      }
    ]
  };
}

function buildCodeReviewChecks(files) {
  return {
    workflow: 'code-review',
    checks: [
      {
        path: 'codex-template/AGENTS.md',
        ok:
          files['codex-template/AGENTS.md'].exists &&
          files['codex-template/AGENTS.md'].content.includes('Complex features, architecture'),
        message: 'Codex AGENTS should recommend the higher-reasoning review path for complex changes'
      },
      {
        path: 'codex-template/skills/coding-standards/SKILL.md',
        ok:
          files['codex-template/skills/coding-standards/SKILL.md'].exists &&
          files['codex-template/skills/coding-standards/SKILL.md'].content.includes('Universal coding standards'),
        message: 'Codex coding-standards skill should exist to support review-quality guidance'
      }
    ]
  };
}

function buildSecurityChecks(files) {
  return {
    workflow: 'security',
    checks: [
      {
        path: 'codex-template/AGENTS.md',
        ok:
          files['codex-template/AGENTS.md'].exists &&
          files['codex-template/AGENTS.md'].content.includes('security-review'),
        message: 'Codex AGENTS should advertise the security-review skill'
      },
      {
        path: 'codex-template/skills/security-review/SKILL.md',
        ok:
          files['codex-template/skills/security-review/SKILL.md'].exists &&
          files['codex-template/skills/security-review/SKILL.md'].content.includes('Security Review Skill'),
        message: 'Codex security-review skill should exist and describe the security review workflow'
      },
      {
        path: 'codex-template/config.toml',
        ok:
          files['codex-template/AGENTS.md'].exists &&
          files['codex-template/AGENTS.md'].content.includes('Since Codex lacks hooks, security enforcement is instruction-based:'),
        message: 'Codex AGENTS should carry security guidance instead of config.toml'
      }
    ]
  };
}

function buildE2eChecks(files) {
  return {
    workflow: 'e2e',
    checks: [
      {
        path: 'codex-template/AGENTS.md',
        ok:
          files['codex-template/AGENTS.md'].exists &&
          files['codex-template/AGENTS.md'].content.includes('e2e-testing'),
        message: 'Codex AGENTS should advertise the e2e-testing skill'
      },
      {
        path: 'codex-template/skills/e2e-testing/SKILL.md',
        ok:
          files['codex-template/skills/e2e-testing/SKILL.md'].exists &&
          files['codex-template/skills/e2e-testing/SKILL.md'].content.includes('E2E Testing Patterns'),
        message: 'Codex e2e-testing skill should exist and describe the E2E testing patterns'
      }
    ]
  };
}

function buildSmokeChecks(files, options = {}) {
  const codexSummary = summarizeTool('codex', TOOL_WORKFLOW_CONTRACT.smokeProbes.codex || [], options);
  const hasRequiredFiles = [
    files['codex-template/skills/tool-setup-verifier/SKILL.md'],
    files['docs/testing/manual-verification/codex.md']
  ].every(file => file && file.exists);
  const cliPass = codexSummary.status === 'PASS';
  const cliSkip = codexSummary.status === 'SKIP';
  const cliFail = codexSummary.status === 'FAIL';
  const cliDetails = codexSummary.probes.map(probe => `${probe.command} - ${probe.detail}`).join('; ');

  return {
    workflow: 'smoke',
    checks: [
      {
        path: 'codex-template/skills/tool-setup-verifier/SKILL.md',
        ok: files['codex-template/skills/tool-setup-verifier/SKILL.md'].exists,
        message: 'Codex smoke verifier skill should exist in codex-template/skills'
      },
      {
        path: 'docs/testing/manual-verification/codex.md',
        ok: files['docs/testing/manual-verification/codex.md'].exists,
        message: 'Codex manual verification guide should exist'
      },
      {
        path: 'codex CLI probes',
        ok: cliPass || cliSkip,
        statusOverride: cliSkip ? 'SKIP' : undefined,
        message: cliSkip
          ? `Codex CLI smoke was skipped: ${cliDetails}`
          : cliFail
            ? `Codex CLI smoke failed: ${cliDetails}`
            : 'Codex CLI smoke probes passed'
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
        path: '.codex/AGENTS.md',
        ok:
          files['.codex/AGENTS.md'].exists &&
          files['.codex/AGENTS.md'].content.includes('Complex features, architecture'),
        message: 'Codex project AGENTS should recommend the planning model path for complex work'
      },
      {
        path: '.codex/config.toml',
        ok: files['.codex/config.toml'].exists,
        message: 'Codex project config.toml should be installed'
      }
    ]
  };
}

function buildInstalledTddChecks(files) {
  return {
    workflow: 'tdd',
    checks: [
      {
        path: '.codex/AGENTS.md',
        ok: files['.codex/AGENTS.md'].exists && files['.codex/AGENTS.md'].content.includes('tdd-workflow'),
        message: 'Codex project AGENTS should advertise the tdd-workflow skill'
      },
      {
        path: '.codex/skills/tdd-workflow/SKILL.md',
        ok: files['.codex/skills/tdd-workflow/SKILL.md'].exists && files['.codex/skills/tdd-workflow/SKILL.md'].content.includes('Test-Driven Development Workflow'),
        message: 'Installed Codex TDD skill should exist and describe the workflow'
      }
    ]
  };
}

function buildInstalledVerifyChecks(files) {
  return {
    workflow: 'verify',
    checks: [
      {
        path: '.codex/AGENTS.md',
        ok: files['.codex/AGENTS.md'].exists && files['.codex/AGENTS.md'].content.includes('verification-loop'),
        message: 'Codex project AGENTS should advertise the verification-loop skill'
      },
      {
        path: '.codex/skills/verification-loop/SKILL.md',
        ok: files['.codex/skills/verification-loop/SKILL.md'].exists && files['.codex/skills/verification-loop/SKILL.md'].content.includes('Verification Loop Skill'),
        message: 'Installed Codex verification skill should exist and describe the verification loop'
      },
      {
        path: '.codex/config.toml',
        ok:
          files['.codex/config.toml'].exists &&
          files['.codex/config.toml'].content.includes('sandbox_mode = "workspace-write"'),
        message: 'Codex project config should provide the expected verification sandbox defaults'
      }
    ]
  };
}

function buildInstalledCodeReviewChecks(files) {
  return {
    workflow: 'code-review',
    checks: [
      {
        path: '.codex/AGENTS.md',
        ok:
          files['.codex/AGENTS.md'].exists &&
          files['.codex/AGENTS.md'].content.includes('Complex features, architecture'),
        message: 'Codex project AGENTS should recommend the higher-reasoning review path for complex changes'
      },
      {
        path: '.codex/skills/coding-standards/SKILL.md',
        ok:
          files['.codex/skills/coding-standards/SKILL.md'].exists &&
          files['.codex/skills/coding-standards/SKILL.md'].content.includes('Universal coding standards'),
        message: 'Installed Codex coding-standards skill should exist to support review-quality guidance'
      }
    ]
  };
}

function buildInstalledSecurityChecks(files) {
  return {
    workflow: 'security',
    checks: [
      {
        path: '.codex/AGENTS.md',
        ok: files['.codex/AGENTS.md'].exists && files['.codex/AGENTS.md'].content.includes('security-review'),
        message: 'Codex project AGENTS should advertise the security-review skill'
      },
      {
        path: '.codex/skills/security-review/SKILL.md',
        ok: files['.codex/skills/security-review/SKILL.md'].exists && files['.codex/skills/security-review/SKILL.md'].content.includes('Security Review Skill'),
        message: 'Installed Codex security-review skill should exist and describe the security workflow'
      }
    ]
  };
}

function buildInstalledE2eChecks(files) {
  return {
    workflow: 'e2e',
    checks: [
      {
        path: '.codex/skills/e2e-testing/SKILL.md',
        ok: files['.codex/skills/e2e-testing/SKILL.md'].exists && files['.codex/skills/e2e-testing/SKILL.md'].content.includes('E2E Testing Patterns'),
        message: 'Installed Codex e2e-testing skill should exist and describe the E2E testing patterns'
      }
    ]
  };
}

function buildInstalledSmokeChecks(files) {
  return {
    workflow: 'smoke',
    checks: [
      {
        path: '.codex/skills/tool-setup-verifier/SKILL.md',
        ok: files['.codex/skills/tool-setup-verifier/SKILL.md'].exists,
        message: 'Installed Codex smoke verifier skill should exist'
      },
      {
        path: '.codex/scripts/smoke-tool-setups.js',
        ok: files['.codex/scripts/smoke-tool-setups.js'].exists,
        message: 'Installed Codex smoke CLI probe script should exist'
      },
      {
        path: '.codex/scripts/smoke-codex-workflows.js',
        ok: files['.codex/scripts/smoke-codex-workflows.js'].exists,
        message: 'Installed Codex workflow smoke script should exist'
      }
    ]
  };
}

function buildInstalledWorkflowChecks(files, options = {}) {
  return [
    buildInstalledPlanChecks(files),
    buildInstalledTddChecks(files),
    buildInstalledCodeReviewChecks(files),
    buildInstalledVerifyChecks(files),
    buildInstalledSmokeChecks(files),
    buildInstalledSecurityChecks(files),
    buildInstalledE2eChecks(files)
  ];
}

function smokeCodexWorkflows(options = {}) {
  const rootDir = options.rootDir || resolveWorkspaceRoot(__dirname);
  const io = options.io || console;
  const installedRepoMode = !fs.existsSync(path.join(rootDir, 'codex-template', 'AGENTS.md'))
    && fs.existsSync(path.join(rootDir, '.codex', 'skills'));
  const files = installedRepoMode
    ? {
        '.codex/AGENTS.md': readRepoFile(rootDir, path.join('.codex', 'AGENTS.md')),
        '.codex/config.toml': readRepoFile(rootDir, path.join('.codex', 'config.toml')),
        '.codex/skills/tool-setup-verifier/SKILL.md': readRepoFile(
          rootDir,
          path.join('.codex', 'skills', 'tool-setup-verifier', 'SKILL.md')
        ),
        '.codex/skills/tdd-workflow/SKILL.md': readRepoFile(rootDir, path.join('.codex', 'skills', 'tdd-workflow', 'SKILL.md')),
        '.codex/skills/coding-standards/SKILL.md': readRepoFile(
          rootDir,
          path.join('.codex', 'skills', 'coding-standards', 'SKILL.md')
        ),
        '.codex/skills/verification-loop/SKILL.md': readRepoFile(
          rootDir,
          path.join('.codex', 'skills', 'verification-loop', 'SKILL.md')
        ),
        '.codex/skills/security-review/SKILL.md': readRepoFile(
          rootDir,
          path.join('.codex', 'skills', 'security-review', 'SKILL.md')
        ),
        '.codex/skills/e2e-testing/SKILL.md': readRepoFile(
          rootDir,
          path.join('.codex', 'skills', 'e2e-testing', 'SKILL.md')
        ),
        '.codex/scripts/smoke-tool-setups.js': readRepoFile(rootDir, path.join('.codex', 'scripts', 'smoke-tool-setups.js')),
        '.codex/scripts/smoke-codex-workflows.js': readRepoFile(rootDir, path.join('.codex', 'scripts', 'smoke-codex-workflows.js'))
      }
    : {
        'AGENTS.md': readRepoFile(rootDir, 'AGENTS.md'),
        'codex-template/AGENTS.md': readRepoFile(rootDir, path.join('codex-template', 'AGENTS.md')),
        'codex-template/config.toml': readRepoFile(rootDir, path.join('codex-template', 'config.toml')),
        'codex-template/skills/tool-setup-verifier/SKILL.md': readRepoFile(
          rootDir,
          path.join('codex-template', 'skills', 'tool-setup-verifier', 'SKILL.md')
        ),
        'docs/testing/manual-verification/codex.md': readRepoFile(
          rootDir,
          path.join('docs', 'testing', 'manual-verification', 'codex.md')
        ),
        'codex-template/skills/tdd-workflow/SKILL.md': readRepoFile(rootDir, path.join('codex-template', 'skills', 'tdd-workflow', 'SKILL.md')),
        'codex-template/skills/coding-standards/SKILL.md': readRepoFile(
          rootDir,
          path.join('codex-template', 'skills', 'coding-standards', 'SKILL.md')
        ),
        'codex-template/skills/verification-loop/SKILL.md': readRepoFile(
          rootDir,
          path.join('codex-template', 'skills', 'verification-loop', 'SKILL.md')
        ),
        'codex-template/skills/security-review/SKILL.md': readRepoFile(
          rootDir,
          path.join('codex-template', 'skills', 'security-review', 'SKILL.md')
        ),
        'codex-template/skills/e2e-testing/SKILL.md': readRepoFile(
          rootDir,
          path.join('codex-template', 'skills', 'e2e-testing', 'SKILL.md')
        )
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
    io.log(`Codex workflow smoke (${installedRepoMode ? 'installed-target' : 'repo-source'} mode):`);
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
  const { exitCode } = smokeCodexWorkflows({ format: args.format });
  process.exit(exitCode);
}

module.exports = {
  resolveWorkspaceRoot,
  smokeCodexWorkflows
};

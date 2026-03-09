#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function resolveWorkspaceRoot(scriptDir) {
  const installedRepoRoot = path.join(scriptDir, '..', '..');
  if (fs.existsSync(path.join(installedRepoRoot, '.agents'))) {
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
        path: '.agents/skills/tdd-workflow/SKILL.md',
        ok: files['.agents/skills/tdd-workflow/SKILL.md'].exists && files['.agents/skills/tdd-workflow/SKILL.md'].content.includes('Test-Driven Development Workflow'),
        message: 'Codex TDD skill should exist and describe the workflow'
      },
      {
        path: 'codex-template/config.toml',
        ok: files['codex-template/config.toml'].exists && files['codex-template/config.toml'].content.includes('Test-Driven Development (TDD)'),
        message: 'Codex config should reinforce TDD in persistent instructions'
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
        path: '.agents/skills/verification-loop/SKILL.md',
        ok: files['.agents/skills/verification-loop/SKILL.md'].exists && files['.agents/skills/verification-loop/SKILL.md'].content.includes('Verification Loop Skill'),
        message: 'Codex verification skill should exist and describe the verification loop'
      },
      {
        path: 'codex-template/config.toml',
        ok:
          files['codex-template/config.toml'].exists &&
          files['codex-template/config.toml'].content.includes('sandbox_mode = "workspace-write"') &&
          files['codex-template/config.toml'].content.includes('[mcp_servers.github]') &&
          files['codex-template/config.toml'].content.includes('[mcp_servers.sequential-thinking]'),
        message: 'Codex config should provide the expected verification sandbox and MCP scaffolding'
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
        path: '.agents/skills/security-review/SKILL.md',
        ok:
          files['.agents/skills/security-review/SKILL.md'].exists &&
          files['.agents/skills/security-review/SKILL.md'].content.includes('Security Review Skill'),
        message: 'Codex security-review skill should exist and describe the security review workflow'
      },
      {
        path: 'codex-template/config.toml',
        ok:
          files['codex-template/config.toml'].exists &&
          files['codex-template/config.toml'].content.includes('Security-First'),
        message: 'Codex config should reinforce Security-First in persistent instructions'
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
        path: '.agents/skills/e2e-testing/SKILL.md',
        ok:
          files['.agents/skills/e2e-testing/SKILL.md'].exists &&
          files['.agents/skills/e2e-testing/SKILL.md'].content.includes('E2E Testing Patterns'),
        message: 'Codex e2e-testing skill should exist and describe the E2E testing patterns'
      }
    ]
  };
}

function buildWorkflowChecks(files) {
  return [
    buildPlanChecks(files),
    buildTddChecks(files),
    buildVerifyChecks(files),
    buildSecurityChecks(files),
    buildE2eChecks(files)
  ];
}

function buildInstalledPlanChecks(files) {
  return {
    workflow: 'plan',
    checks: [
      {
        path: '~/.codex/AGENTS.md',
        ok:
          files['~/.codex/AGENTS.md'].exists &&
          files['~/.codex/AGENTS.md'].content.includes('Complex features, architecture'),
        message: 'Codex global AGENTS should recommend the planning model path for complex work'
      },
      {
        path: '~/.codex/config.toml',
        ok: files['~/.codex/config.toml'].exists,
        message: 'Codex global config.toml should be installed'
      }
    ]
  };
}

function buildInstalledTddChecks(files) {
  return {
    workflow: 'tdd',
    checks: [
      {
        path: '~/.codex/AGENTS.md',
        ok: files['~/.codex/AGENTS.md'].exists && files['~/.codex/AGENTS.md'].content.includes('tdd-workflow'),
        message: 'Codex global AGENTS should advertise the tdd-workflow skill'
      },
      {
        path: '.agents/skills/tdd-workflow/SKILL.md',
        ok: files['.agents/skills/tdd-workflow/SKILL.md'].exists && files['.agents/skills/tdd-workflow/SKILL.md'].content.includes('Test-Driven Development Workflow'),
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
        path: '~/.codex/AGENTS.md',
        ok: files['~/.codex/AGENTS.md'].exists && files['~/.codex/AGENTS.md'].content.includes('verification-loop'),
        message: 'Codex global AGENTS should advertise the verification-loop skill'
      },
      {
        path: '.agents/skills/verification-loop/SKILL.md',
        ok: files['.agents/skills/verification-loop/SKILL.md'].exists && files['.agents/skills/verification-loop/SKILL.md'].content.includes('Verification Loop Skill'),
        message: 'Installed Codex verification skill should exist and describe the verification loop'
      },
      {
        path: '~/.codex/config.toml',
        ok:
          files['~/.codex/config.toml'].exists &&
          files['~/.codex/config.toml'].content.includes('sandbox_mode = "workspace-write"') &&
          files['~/.codex/config.toml'].content.includes('[mcp_servers.github]') &&
          files['~/.codex/config.toml'].content.includes('[mcp_servers.sequential-thinking]'),
        message: 'Codex global config should provide the expected verification sandbox and MCP scaffolding'
      }
    ]
  };
}

function buildInstalledSecurityChecks(files) {
  return {
    workflow: 'security',
    checks: [
      {
        path: '~/.codex/AGENTS.md',
        ok: files['~/.codex/AGENTS.md'].exists && files['~/.codex/AGENTS.md'].content.includes('security-review'),
        message: 'Codex global AGENTS should advertise the security-review skill'
      },
      {
        path: '.agents/skills/security-review/SKILL.md',
        ok: files['.agents/skills/security-review/SKILL.md'].exists && files['.agents/skills/security-review/SKILL.md'].content.includes('Security Review Skill'),
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
        path: '.agents/skills/e2e-testing/SKILL.md',
        ok: files['.agents/skills/e2e-testing/SKILL.md'].exists && files['.agents/skills/e2e-testing/SKILL.md'].content.includes('E2E Testing Patterns'),
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
        path: '.agents/skills/tool-setup-verifier/SKILL.md',
        ok: files['.agents/skills/tool-setup-verifier/SKILL.md'].exists,
        message: 'Installed Codex smoke verifier skill should exist'
      },
      {
        path: '.agents/scripts/smoke-tool-setups.js',
        ok: files['.agents/scripts/smoke-tool-setups.js'].exists,
        message: 'Installed Codex smoke CLI probe script should exist'
      },
      {
        path: '.agents/scripts/smoke-codex-workflows.js',
        ok: files['.agents/scripts/smoke-codex-workflows.js'].exists,
        message: 'Installed Codex workflow smoke script should exist'
      }
    ]
  };
}

function buildInstalledWorkflowChecks(files) {
  return [
    buildInstalledPlanChecks(files),
    buildInstalledTddChecks(files),
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
    && fs.existsSync(path.join(rootDir, '.agents', 'skills'));
  const files = installedRepoMode
    ? {
        '~/.codex/AGENTS.md': readUserCodexFile('AGENTS.md', options.homeDir),
        '~/.codex/config.toml': readUserCodexFile('config.toml', options.homeDir),
        '.agents/skills/tool-setup-verifier/SKILL.md': readRepoFile(
          rootDir,
          path.join('.agents', 'skills', 'tool-setup-verifier', 'SKILL.md')
        ),
        '.agents/skills/tdd-workflow/SKILL.md': readRepoFile(rootDir, path.join('.agents', 'skills', 'tdd-workflow', 'SKILL.md')),
        '.agents/skills/verification-loop/SKILL.md': readRepoFile(
          rootDir,
          path.join('.agents', 'skills', 'verification-loop', 'SKILL.md')
        ),
        '.agents/skills/security-review/SKILL.md': readRepoFile(
          rootDir,
          path.join('.agents', 'skills', 'security-review', 'SKILL.md')
        ),
        '.agents/skills/e2e-testing/SKILL.md': readRepoFile(
          rootDir,
          path.join('.agents', 'skills', 'e2e-testing', 'SKILL.md')
        ),
        '.agents/scripts/smoke-tool-setups.js': readRepoFile(rootDir, path.join('.agents', 'scripts', 'smoke-tool-setups.js')),
        '.agents/scripts/smoke-codex-workflows.js': readRepoFile(rootDir, path.join('.agents', 'scripts', 'smoke-codex-workflows.js'))
      }
    : {
        'AGENTS.md': readRepoFile(rootDir, 'AGENTS.md'),
        'codex-template/AGENTS.md': readRepoFile(rootDir, path.join('codex-template', 'AGENTS.md')),
        'codex-template/config.toml': readRepoFile(rootDir, path.join('codex-template', 'config.toml')),
        '.agents/skills/tdd-workflow/SKILL.md': readRepoFile(rootDir, path.join('.agents', 'skills', 'tdd-workflow', 'SKILL.md')),
        '.agents/skills/verification-loop/SKILL.md': readRepoFile(
          rootDir,
          path.join('.agents', 'skills', 'verification-loop', 'SKILL.md')
        ),
        '.agents/skills/security-review/SKILL.md': readRepoFile(
          rootDir,
          path.join('.agents', 'skills', 'security-review', 'SKILL.md')
        ),
        '.agents/skills/e2e-testing/SKILL.md': readRepoFile(
          rootDir,
          path.join('.agents', 'skills', 'e2e-testing', 'SKILL.md')
        )
      };

  const workflows = (installedRepoMode ? buildInstalledWorkflowChecks(files) : buildWorkflowChecks(files)).map(entry => {
    const failures = entry.checks.filter(check => !check.ok);
    return {
      workflow: entry.workflow,
      status: failures.length === 0 ? 'PASS' : 'FAIL',
      checks: entry.checks,
      failures
    };
  });

  const result = {
    ok: workflows.every(workflow => workflow.status === 'PASS'),
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

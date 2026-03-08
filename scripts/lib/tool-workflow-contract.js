const TOOL_WORKFLOW_CONTRACT = {
  workflows: [
    {
      id: 'plan',
      title: 'Plan',
      outcome: 'Break work into phases, risks, and concrete implementation steps before execution.',
      tools: {
        claude: {
          status: 'official',
          verificationMode: 'installer-target',
          requiredFiles: ['commands/plan.md', 'agents/planner.md']
        },
        cursor: {
          status: 'repo-adapter',
          verificationMode: 'installer-target',
          requiredFiles: ['AGENTS.md', 'cursor-template/rules/common-development-workflow.md']
        },
        codex: {
          status: 'repo-adapter',
          verificationMode: 'installer-target',
          requiredFiles: ['codex-template/config.toml', 'codex-template/AGENTS.md']
        },
        opencode: {
          status: 'official',
          verificationMode: 'repo-adapter',
          requiredFiles: [
            '.opencode/opencode.json',
            '.opencode/commands/plan.md',
            '.opencode/prompts/agents/planner.txt'
          ]
        }
      }
    },
    {
      id: 'tdd',
      title: 'TDD',
      outcome: 'Write failing tests first, implement the minimum change, then refactor with verification.',
      tools: {
        claude: {
          status: 'official',
          verificationMode: 'installer-target',
          requiredFiles: ['commands/tdd.md', 'agents/tdd-guide.md', 'skills/tdd-workflow/SKILL.md']
        },
        cursor: {
          status: 'repo-adapter',
          verificationMode: 'installer-target',
          requiredFiles: ['AGENTS.md', 'cursor-template/rules/common-testing.md']
        },
        codex: {
          status: 'repo-adapter',
          verificationMode: 'installer-target',
          requiredFiles: ['codex-template/config.toml', 'codex-template/AGENTS.md', '.agents/skills/tdd-workflow/SKILL.md']
        },
        opencode: {
          status: 'official',
          verificationMode: 'repo-adapter',
          requiredFiles: [
            '.opencode/opencode.json',
            '.opencode/commands/tdd.md',
            '.opencode/prompts/agents/tdd-guide.txt'
          ]
        }
      }
    },
    {
      id: 'code-review',
      title: 'Code Review',
      outcome: 'Review changes for correctness, regressions, and missing tests before sign-off.',
      tools: {
        claude: {
          status: 'official',
          verificationMode: 'installer-target',
          requiredFiles: ['commands/code-review.md', 'agents/code-reviewer.md']
        },
        cursor: {
          status: 'repo-adapter',
          verificationMode: 'installer-target',
          requiredFiles: ['AGENTS.md', 'cursor-template/rules/common-coding-style.md']
        },
        codex: {
          status: 'repo-adapter',
          verificationMode: 'installer-target',
          requiredFiles: ['codex-template/config.toml', 'codex-template/AGENTS.md']
        },
        opencode: {
          status: 'official',
          verificationMode: 'repo-adapter',
          requiredFiles: [
            '.opencode/opencode.json',
            '.opencode/commands/code-review.md',
            '.opencode/prompts/agents/code-reviewer.txt'
          ]
        }
      }
    },
    {
      id: 'verify',
      title: 'Verify',
      outcome: 'Run targeted validation and summarize whether the current change is safe to ship.',
      tools: {
        claude: {
          status: 'official',
          verificationMode: 'installer-target',
          requiredFiles: ['commands/verify.md', 'skills/verification-loop/SKILL.md']
        },
        cursor: {
          status: 'repo-adapter',
          verificationMode: 'installer-target',
          requiredFiles: ['AGENTS.md', 'cursor-template/rules/common-testing.md']
        },
        codex: {
          status: 'repo-adapter',
          verificationMode: 'installer-target',
          requiredFiles: ['codex-template/config.toml', 'codex-template/AGENTS.md', '.agents/skills/verification-loop/SKILL.md']
        },
        opencode: {
          status: 'official',
          verificationMode: 'repo-adapter',
          requiredFiles: [
            '.opencode/opencode.json',
            '.opencode/commands/verify.md',
            '.opencode/tools/run-tests.ts'
          ]
        }
      }
    },
    {
      id: 'security',
      title: 'Security',
      outcome: 'Apply security review guidance before committing changes that touch trust boundaries or secrets.',
      tools: {
        claude: {
          status: 'official',
          verificationMode: 'installer-target',
          requiredFiles: ['agents/security-reviewer.md', 'skills/security-review/SKILL.md']
        },
        cursor: {
          status: 'repo-adapter',
          verificationMode: 'installer-target',
          requiredFiles: ['AGENTS.md', 'cursor-template/rules/common-security.md']
        },
        codex: {
          status: 'repo-adapter',
          verificationMode: 'installer-target',
          requiredFiles: ['codex-template/config.toml', 'codex-template/AGENTS.md', '.agents/skills/security-review/SKILL.md']
        },
        opencode: {
          status: 'official',
          verificationMode: 'repo-adapter',
          requiredFiles: [
            '.opencode/opencode.json',
            '.opencode/commands/security.md',
            '.opencode/prompts/agents/security-reviewer.txt',
            '.opencode/tools/security-audit.ts'
          ]
        }
      }
    },
    {
      id: 'e2e',
      title: 'E2E',
      outcome: 'Exercise critical end-to-end user flows when the change affects workflow behavior.',
      tools: {
        claude: {
          status: 'official',
          verificationMode: 'installer-target',
          requiredFiles: ['commands/e2e.md', 'agents/e2e-runner.md', 'skills/e2e-testing/SKILL.md']
        },
        cursor: {
          status: 'repo-adapter',
          verificationMode: 'installer-target',
          requiredFiles: ['AGENTS.md', 'cursor-template/rules/common-testing.md']
        },
        codex: {
          status: 'repo-adapter',
          verificationMode: 'installer-target',
          requiredFiles: ['codex-template/config.toml', 'codex-template/AGENTS.md', '.agents/skills/e2e-testing/SKILL.md']
        },
        opencode: {
          status: 'official',
          verificationMode: 'repo-adapter',
          requiredFiles: [
            '.opencode/opencode.json',
            '.opencode/commands/e2e.md',
            '.opencode/prompts/agents/e2e-runner.txt'
          ]
        }
      }
    }
  ],
  smokeProbes: {
    claude: [
      { command: 'claude', args: ['--version'] },
      { command: 'claude', args: ['--help'] }
    ],
    cursor: [
      { command: 'cursor', args: ['--version'] },
      { command: 'agent', args: ['--help'] },
      { command: 'cursor-agent', args: ['--help'] }
    ],
    codex: [
      { command: 'codex', args: ['--version'] },
      { command: 'codex', args: ['--help'] }
    ],
    opencode: [
      { command: 'opencode', args: ['--version'] },
      { command: 'opencode', args: ['--help'] }
    ]
  }
};

const TOOL_ORDER = ['claude', 'cursor', 'codex', 'opencode'];

module.exports = {
  TOOL_WORKFLOW_CONTRACT,
  TOOL_ORDER
};

#!/usr/bin/env node
const { readStdin } = require('./adapter');
readStdin().then(raw => {
  try {
    const input = JSON.parse(raw);
    const prompt = input.prompt || input.content || input.message || '';
    const secretPatterns = [
      /\bsk-[a-zA-Z0-9_-]{20,}\b/, // OpenAI-style API keys (includes sk-proj-*)
      /\b(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}\b/, // GitHub classic/fine-grained token families
      /\bgithub_pat_[a-zA-Z0-9_]{20,}\b/, // GitHub fine-grained PAT prefix
      /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/, // AWS access keys (long-term + temp)
      /\bxox[bpsa]-[a-zA-Z0-9-]{10,}\b/, // Slack tokens
      /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, // Private keys
    ];
    for (const pattern of secretPatterns) {
      if (pattern.test(prompt)) {
        console.error('[MDT] WARNING: Potential secret detected in prompt!');
        console.error('[MDT] Remove secrets before submitting. Use environment variables instead.');
        break;
      }
    }
  } catch {}
  process.stdout.write(raw);
}).catch(() => process.exit(0));

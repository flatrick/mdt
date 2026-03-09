#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { HOOK_PLATFORMS } = require('../lib/hook-platforms');

function readIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

function validatePlatformMirror(platform) {
  const issues = [];
  const source = readIfExists(platform.sourceConfig);
  const mirror = readIfExists(platform.mirrorConfig);

  if (!source) {
    issues.push(`Missing source hook config: ${platform.sourceConfig}`);
  }
  if (!mirror) {
    issues.push(`Missing mirror hook config: ${platform.mirrorConfig}`);
  }

  if (source && mirror && !source.equals(mirror)) {
    issues.push(
      `Hook mirror is out of sync for ${platform.name}: ${platform.mirrorConfig} does not match ${platform.sourceConfig}`
    );
  }

  return {
    name: platform.name,
    valid: issues.length === 0,
    issues
  };
}

function validateHookMirrors(platforms = HOOK_PLATFORMS) {
  const results = Object.values(platforms).map(validatePlatformMirror);
  const valid = results.every((result) => result.valid);

  return { valid, results };
}

function runCli(options = {}) {
  const io = options.io || console;
  const validation = validateHookMirrors(options.platforms);

  if (!validation.valid) {
    for (const result of validation.results) {
      for (const issue of result.issues) {
        io.error(`ERROR: ${issue}`);
      }
    }
    return { exitCode: 1, validation };
  }

  io.log(`Validated ${validation.results.length} hook mirror platform(s)`);
  return { exitCode: 0, validation };
}

if (require.main === module) {
  const result = runCli();
  process.exit(result.exitCode);
}

module.exports = {
  runCli,
  validatePlatformMirror,
  validateHookMirrors,
};

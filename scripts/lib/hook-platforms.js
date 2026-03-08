'use strict';

const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');

const HOOK_PLATFORMS = Object.freeze({
  claude: Object.freeze({
    name: 'claude',
    sourceConfig: path.join(REPO_ROOT, 'hooks', 'claude', 'hooks.json'),
    mirrorConfig: path.join(REPO_ROOT, 'hooks', 'hooks.json'),
    sourceScriptsDir: null,
    mirrorScriptsDir: null
  }),
  cursor: Object.freeze({
    name: 'cursor',
    sourceConfig: path.join(REPO_ROOT, 'hooks', 'cursor', 'hooks.json'),
    mirrorConfig: path.join(REPO_ROOT, 'cursor-template', 'hooks.json'),
    sourceScriptsDir: path.join(REPO_ROOT, 'hooks', 'cursor', 'scripts'),
    mirrorScriptsDir: path.join(REPO_ROOT, 'cursor-template', 'hooks')
  })
});

function getHookPlatform(name) {
  const platform = HOOK_PLATFORMS[name];
  if (!platform) {
    throw new Error(`Unknown hook platform: ${name}`);
  }
  return platform;
}

module.exports = {
  HOOK_PLATFORMS,
  REPO_ROOT,
  getHookPlatform
};

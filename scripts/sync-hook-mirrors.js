'use strict';

const fs = require('fs');
const path = require('path');
const { HOOK_PLATFORMS } = require('./lib/hook-platforms');

function copyFileSync(sourcePath, mirrorPath) {
  fs.mkdirSync(path.dirname(mirrorPath), { recursive: true });
  fs.copyFileSync(sourcePath, mirrorPath);
}

function syncDirectory(sourceDir, mirrorDir) {
  if (!sourceDir || !mirrorDir) return;

  fs.rmSync(mirrorDir, { recursive: true, force: true });
  fs.mkdirSync(mirrorDir, { recursive: true });

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const mirrorPath = path.join(mirrorDir, entry.name);
    if (entry.isDirectory()) {
      syncDirectory(sourcePath, mirrorPath);
    } else if (entry.isFile()) {
      copyFileSync(sourcePath, mirrorPath);
    }
  }
}

function syncPlatformHookMirror(platform) {
  if (!fs.existsSync(platform.sourceConfig)) {
    throw new Error(`Missing hook source config: ${platform.sourceConfig}`);
  }

  if (platform.mirrorConfig) {
    copyFileSync(platform.sourceConfig, platform.mirrorConfig);
  }

  if (platform.sourceScriptsDir && platform.mirrorScriptsDir) {
    if (!fs.existsSync(platform.sourceScriptsDir)) {
      throw new Error(`Missing hook source scripts directory: ${platform.sourceScriptsDir}`);
    }
    syncDirectory(platform.sourceScriptsDir, platform.mirrorScriptsDir);
  }
}

function syncHookMirrors(options = {}) {
  const platforms = options.platforms || HOOK_PLATFORMS;
  for (const platform of Object.values(platforms)) {
    syncPlatformHookMirror(platform);
  }
}

if (require.main === module) {
  syncHookMirrors();
}

module.exports = {
  syncDirectory,
  syncPlatformHookMirror,
  syncHookMirrors
};

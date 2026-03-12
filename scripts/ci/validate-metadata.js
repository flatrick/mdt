#!/usr/bin/env node
/**
 * Validate metadata consistency across shipped manifests.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { safeJsonParse } = require('../lib/runtime-utils');

const REPO_ROOT = path.join(__dirname, '../..');
const DEFAULT_IO = { log: console.log, error: console.error };

function getManifestPaths(repoRoot) {
  return {
    packageJson: path.join(repoRoot, 'package.json'),
    pluginJson: path.join(repoRoot, '.claude-plugin', 'plugin.json'),
    marketplaceJson: path.join(repoRoot, '.claude-plugin', 'marketplace.json')
  };
}

function readJsonFile(filePath, label, io) {
  if (!fs.existsSync(filePath)) {
    io.error(`ERROR: Missing ${label}: ${filePath}`);
    return null;
  }

  const parsed = safeJsonParse(fs.readFileSync(filePath, 'utf8'));
  if (!parsed.ok) {
    io.error(`ERROR: Invalid JSON in ${label}: ${parsed.error.message}`);
    return null;
  }

  return parsed.data;
}

function normalizeUrl(value) {
  if (!value) return '';

  const rawValue = typeof value === 'string' ? value : value.url;
  return String(rawValue || '')
    .trim()
    .replace(/^git\+/, '')
    .replace(/\.git$/i, '')
    .replace(/#readme$/i, '')
    .replace(/\/$/, '');
}

function compareValue(label, actual, expected, io) {
  if (actual === expected) {
    return false;
  }

  io.error(`ERROR: ${label} mismatch. Expected "${expected}" but found "${actual}"`);
  return true;
}

function comparePluginMetadata(pluginJson, expected, io) {
  let hasErrors = false;
  hasErrors = compareValue('plugin.json name', pluginJson.name, expected.name, io) || hasErrors;
  hasErrors = compareValue('plugin.json version', pluginJson.version, expected.version, io) || hasErrors;
  hasErrors = compareValue('plugin.json repository', normalizeUrl(pluginJson.repository), expected.repository, io) || hasErrors;
  hasErrors = compareValue('plugin.json homepage', normalizeUrl(pluginJson.homepage), expected.homepage, io) || hasErrors;
  return hasErrors;
}

function compareMarketplaceMetadata(marketplaceJson, expected, io) {
  let hasErrors = false;

  hasErrors = compareValue('marketplace.json name', marketplaceJson.name, expected.name, io) || hasErrors;

  const plugins = Array.isArray(marketplaceJson.plugins) ? marketplaceJson.plugins : [];
  if (plugins.length === 0) {
    io.error('ERROR: marketplace.json must contain at least one plugin entry');
    return true;
  }

  for (let index = 0; index < plugins.length; index++) {
    const plugin = plugins[index];
    const prefix = `marketplace.json plugins[${index}]`;
    hasErrors = compareValue(`${prefix} name`, plugin.name, expected.name, io) || hasErrors;
    hasErrors = compareValue(`${prefix} version`, plugin.version, expected.version, io) || hasErrors;
    hasErrors = compareValue(`${prefix} repository`, normalizeUrl(plugin.repository), expected.repository, io) || hasErrors;
    hasErrors = compareValue(`${prefix} homepage`, normalizeUrl(plugin.homepage), expected.homepage, io) || hasErrors;
  }

  return hasErrors;
}

function validateMetadata(options = {}) {
  const repoRoot = options.repoRoot || REPO_ROOT;
  const io = options.io || DEFAULT_IO;
  const manifestPaths = getManifestPaths(repoRoot);

  const packageJson = readJsonFile(manifestPaths.packageJson, 'package.json', io);
  const pluginJson = readJsonFile(manifestPaths.pluginJson, '.claude-plugin/plugin.json', io);
  const marketplaceJson = readJsonFile(manifestPaths.marketplaceJson, '.claude-plugin/marketplace.json', io);

  if (!packageJson || !pluginJson || !marketplaceJson) {
    return { exitCode: 1, hasErrors: true };
  }

  const expected = {
    name: packageJson.name,
    version: packageJson.version,
    repository: normalizeUrl(packageJson.repository),
    homepage: normalizeUrl(packageJson.homepage)
  };

  let hasErrors = false;
  hasErrors = comparePluginMetadata(pluginJson, expected, io) || hasErrors;
  hasErrors = compareMarketplaceMetadata(marketplaceJson, expected, io) || hasErrors;

  if (hasErrors) {
    return { exitCode: 1, hasErrors: true };
  }

  io.log('Validated metadata consistency across package, plugin, and marketplace manifests');
  return { exitCode: 0, hasErrors: false };
}

if (require.main === module) {
  const result = validateMetadata();
  process.exit(result.exitCode);
}

module.exports = {
  normalizeUrl,
  validateMetadata
};

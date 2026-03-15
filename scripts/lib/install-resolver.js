'use strict';

/**
 * Dependency resolver for MDT install. Computes install closure from selected
 * packages, validates capability requirements against tool support maps, and
 * detects cycles. Used when install-mdt.js is run with --new-resolver.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');
const METADATA_TOOLS_DIR = path.join(REPO_ROOT, 'metadata', 'tools');

const TOOL_IDS = new Set(['claude', 'cursor', 'codex']);

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function isValidPackageName(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9_-]+$/.test(name);
}

function loadPackageManifest(packageName) {
  if (!isValidPackageName(packageName)) return null;
  const manifestPath = path.join(PACKAGES_DIR, packageName, 'package.json');
  if (!manifestPath.startsWith(PACKAGES_DIR + path.sep)) return null;
  return readJsonFile(manifestPath);
}

function loadToolSupportMap(toolId) {
  const mapPath = path.join(METADATA_TOOLS_DIR, `${toolId}.json`);
  return readJsonFile(mapPath);
}

function buildExtendsGraph(packageNames, visited = new Set(), graph = new Map()) {
  for (const name of packageNames) {
    if (visited.has(name)) continue;
    visited.add(name);
    const manifest = loadPackageManifest(name);
    if (!manifest || !Array.isArray(manifest.extends)) continue;
    if (!graph.has(name)) graph.set(name, []);
    for (const ext of manifest.extends) {
      if (!isValidPackageName(ext)) continue;
      graph.get(name).push(ext);
      buildExtendsGraph([ext], visited, graph);
    }
  }
  return graph;
}

function findCyclesInGraph(graph) {
  const cycles = [];
  const visited = new Set();
  const stack = new Set();

  function dfs(node, trail) {
    visited.add(node);
    stack.add(node);
    const nextTrail = [...trail, node];

    const edges = graph.get(node) || [];
    for (const next of edges) {
      if (!visited.has(next)) {
        const found = dfs(next, nextTrail);
        if (found) return true;
      } else if (stack.has(next)) {
        const cycle = [...nextTrail.slice(nextTrail.indexOf(next)), next];
        cycles.push(cycle);
      }
    }
    stack.delete(node);
    return false;
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) dfs(node, []);
  }
  return cycles;
}

function normalizePackageRequires(requires) {
  if (!requires || typeof requires !== 'object' || Array.isArray(requires)) {
    return { hooks: false, runtimeScripts: false, sessionData: false, tools: [] };
  }
  const tools = Array.isArray(requires.tools)
    ? requires.tools.filter((t) => typeof t === 'string' && TOOL_IDS.has(t))
    : [];
  return {
    hooks: requires.hooks === true,
    runtimeScripts: requires.runtimeScripts === true,
    sessionData: requires.sessionData === true,
    tools
  };
}

function checkHooksCapability(req, toolId, featureStatus, experimental, errors, warnings) {
  if (!req.hooks) return;
  const status = featureStatus.hooks?.status;
  if (status === 'unsupported') {
    errors.push(`Required capability 'hooks' is unsupported for target '${toolId}'`);
  } else if (status === 'experimental' && !experimental) {
    errors.push(`Required capability 'hooks' is experimental for target '${toolId}'; pass --experimental to install`);
  } else if (status === 'experimental') {
    warnings.push(`Capability 'hooks' is experimental for target '${toolId}'`);
  }
}

function getFeatureStatus(supportMap) {
  return (supportMap && supportMap.featureStatus) || {};
}

function checkCapabilitiesAgainstSupportMap(req, toolId, supportMap, options = {}) {
  const errors = [];
  const warnings = [];
  const featureStatus = getFeatureStatus(supportMap);
  const experimental = options.experimental === true;

  checkHooksCapability(req, toolId, featureStatus, experimental, errors, warnings);

  if (req.runtimeScripts && featureStatus.runtimeScripts?.status === 'unsupported') {
    errors.push(`Required capability 'runtimeScripts' is unsupported for target '${toolId}'`);
  }
  if (req.sessionData && featureStatus.sessionData?.status === 'unsupported') {
    errors.push(`Required capability 'sessionData' is unsupported for target '${toolId}'`);
  }
  if (req.tools.length > 0 && !req.tools.includes(toolId)) {
    errors.push(`Package requires tools [${req.tools.join(', ')}] but install target is '${toolId}'`);
  }
  if (featureStatus.mcp) {
    warnings.push(`MCP capability is tool-dependent; installer never hard-fails on MCP`);
  }
  return { errors, warnings };
}

function expandPackageSet(packageNames, manifests, errors) {
  const expandedNames = new Set(packageNames);
  for (const name of packageNames) {
    const manifest = loadPackageManifest(name);
    if (!manifest) {
      errors.push(`Package not found: ${name}`);
      continue;
    }
    manifests.push(manifest);
    if (Array.isArray(manifest.extends)) {
      manifest.extends.forEach((e) => { if (isValidPackageName(e)) expandedNames.add(e); });
    }
  }
  for (const name of expandedNames) {
    if (packageNames.includes(name)) continue;
    const manifest = loadPackageManifest(name);
    if (!manifest) {
      errors.push(`Extended package not found: ${name}`);
    } else {
      manifests.push(manifest);
    }
  }
  return expandedNames;
}

function checkAllCapabilities(manifests, targetTool, supportMap, options, errors, warnings) {
  for (const manifest of manifests) {
    const req = normalizePackageRequires(manifest.requires);
    const { errors: capErrors, warnings: capWarnings } = checkCapabilitiesAgainstSupportMap(
      req, targetTool, supportMap, options
    );
    errors.push(...capErrors);
    warnings.push(...capWarnings);
  }
}

function resolveInstallClosure(packageNames, targetTool, options = {}) {
  const errors = [];
  const warnings = [];
  if (!TOOL_IDS.has(targetTool)) {
    return { success: false, errors: [`Unknown target tool: ${targetTool}`], warnings, closure: null };
  }

  const manifests = [];
  const expandedNames = expandPackageSet(packageNames, manifests, errors);
  if (errors.length > 0) {
    return { success: false, errors, warnings, closure: null };
  }

  const cycles = findCyclesInGraph(buildExtendsGraph([...expandedNames]));
  for (const cycle of cycles) {
    errors.push(`Dependency cycle: ${cycle.join(' -> ')} -> ${cycle[0]}`);
  }
  if (errors.length > 0) {
    return { success: false, errors, warnings, closure: null };
  }

  checkAllCapabilities(manifests, targetTool, loadToolSupportMap(targetTool), options, errors, warnings);
  const dedupedWarnings = [...new Set(warnings)];

  const closure = {
    target: targetTool,
    packages: [...expandedNames].sort(),
    errors: errors.length > 0 ? errors : undefined,
    warnings: dedupedWarnings.length > 0 ? dedupedWarnings : undefined
  };
  return { success: errors.length === 0, errors, warnings: dedupedWarnings, closure };
}

module.exports = {
  resolveInstallClosure,
  isValidPackageName,
  loadPackageManifest,
  loadToolSupportMap,
  buildExtendsGraph,
  findCyclesInGraph,
  normalizePackageRequires,
  checkCapabilitiesAgainstSupportMap
};

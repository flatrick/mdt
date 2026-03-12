'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

function createInstinctCliRuntime(options = {}) {
  const skillDir = path.resolve(options.skillDir || path.join(options.entrypointDir || process.cwd(), '..'));
  const detectProject = options.detectProject;
  const getHomunculusDir = options.getHomunculusDir;
  const inferInstalledConfigDir = options.inferInstalledConfigDir;

  if (typeof detectProject !== 'function' || typeof getHomunculusDir !== 'function') {
    throw new Error('createInstinctCliRuntime requires detectProject and getHomunculusDir');
  }

  function resolveProjectRoot() {
    const candidates = [
      path.resolve(skillDir, '..', '..'),
      path.resolve(skillDir, '..', '..', '..')
    ];

    for (const candidate of candidates) {
      const baseName = path.basename(candidate).toLowerCase();
      if (baseName === '.codex' || baseName === '.cursor' || baseName === '.claude' || baseName === '.agents') {
        continue;
      }
      if (
        fs.existsSync(path.join(candidate, '.git')) ||
        fs.existsSync(path.join(candidate, 'package.json')) ||
        fs.existsSync(path.join(candidate, 'AGENTS.md'))
      ) {
        return candidate;
      }
    }

    return null;
  }

  const TOOL_ENV_MAP = {
    '.cursor': { envKey: 'CURSOR_AGENT', observerTool: 'cursor' },
    '.claude': { envKey: 'CLAUDE_CODE', observerTool: 'claude' },
    '.codex': { envKey: 'CODEX_AGENT', observerTool: 'codex' }
  };

  function buildToolEnv(env = process.env) {
    const projectRoot = resolveProjectRoot();
    const nextEnv = { ...env };
    const homeDir = nextEnv.HOME || nextEnv.USERPROFILE || process.env.HOME || process.env.USERPROFILE || '';

    const installedDir = typeof inferInstalledConfigDir === 'function'
      ? inferInstalledConfigDir(path.join(skillDir, 'scripts'))
      : null;
    const toolName = installedDir ? path.basename(installedDir).toLowerCase() : '.codex';
    const toolInfo = TOOL_ENV_MAP[toolName] || TOOL_ENV_MAP['.codex'];

    const configDir = nextEnv.CONFIG_DIR || (installedDir || path.join(homeDir, '.codex'));
    const dataDir = nextEnv.DATA_DIR || path.join(configDir, 'mdt');
    fs.mkdirSync(dataDir, { recursive: true });

    nextEnv[toolInfo.envKey] = '1';
    nextEnv.MDT_OBSERVER_TOOL = toolInfo.observerTool;
    nextEnv.CONFIG_DIR = configDir;
    nextEnv.DATA_DIR = dataDir;
    if (projectRoot) {
      nextEnv.MDT_PROJECT_ROOT = nextEnv.MDT_PROJECT_ROOT || projectRoot;
    }

    return nextEnv;
  }

  function buildCodexEnv(env) {
    return buildToolEnv(env);
  }

  function withToolEnv(fn) {
    const nextEnv = buildToolEnv();
    const previous = {};

    for (const [key, value] of Object.entries(nextEnv)) {
      previous[key] = process.env[key];
      process.env[key] = value;
    }

    try {
      return fn();
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  }

  function getCliPaths() {
    const homunculusDir = withToolEnv(() => getHomunculusDir());
    return {
      // Project-scoped state now lives directly under homunculus/<project-id>/.
      PROJECTS_DIR: homunculusDir,
      REGISTRY_FILE: path.join(homunculusDir, 'projects.json'),
      GLOBAL_PERSONAL: path.join(homunculusDir, 'instincts', 'personal'),
      GLOBAL_INHERITED: path.join(homunculusDir, 'instincts', 'inherited')
    };
  }

  const ALLOWED_EXT = ['.yaml', '.yml', '.md'];

  function parseInstinctFile(content) {
    const instincts = [];
    let current = {};
    let inFrontmatter = false;
    const contentLines = [];

    for (const line of content.split('\n')) {
      if (line.trim() === '---') {
        if (inFrontmatter) {
          inFrontmatter = false;
          if (current && current.id) {
            current.content = contentLines.join('\n').trim();
            instincts.push(current);
          }
          current = {};
          contentLines.length = 0;
        } else {
          inFrontmatter = true;
          current = {};
          contentLines.length = 0;
        }
        continue;
      }
      if (inFrontmatter && line.includes(':')) {
        const idx = line.indexOf(':');
        const key = line.slice(0, idx).trim();
        let value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (key === 'confidence') current[key] = parseFloat(value) || 0.5;
        else current[key] = value;
      } else if (!inFrontmatter) {
        contentLines.push(line);
      }
    }
    if (current && current.id) {
      current.content = contentLines.join('\n').trim();
      instincts.push(current);
    }
    return instincts;
  }

  function loadInstinctsFromDir(dirPath, sourceType, scopeLabel) {
    const instincts = [];
    if (!dirPath || !fs.existsSync(dirPath)) return instincts;
    const files = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(e => e.isFile() && ALLOWED_EXT.some(ext => e.name.toLowerCase().endsWith(ext)))
      .map(e => path.join(dirPath, e.name))
      .sort();

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const parsed = parseInstinctFile(content);
        for (const inst of parsed) {
          inst._source_file = file;
          inst._source_type = sourceType;
          inst._scope_label = scopeLabel;
          if (!inst.scope) inst.scope = scopeLabel;
          instincts.push(inst);
        }
      } catch (err) {
        console.error(`Warning: Failed to parse ${file}:`, err.message);
      }
    }
    return instincts;
  }

  function loadAllInstincts(project, includeGlobal = true) {
    const { GLOBAL_PERSONAL, GLOBAL_INHERITED } = getCliPaths();
    const instincts = [];

    if (project.id !== 'global') {
      instincts.push(...loadInstinctsFromDir(project.instincts_personal, 'personal', 'project'));
      instincts.push(...loadInstinctsFromDir(project.instincts_inherited, 'inherited', 'project'));
    }

    if (includeGlobal) {
      const globalInstincts = [];
      globalInstincts.push(...loadInstinctsFromDir(GLOBAL_PERSONAL, 'personal', 'global'));
      globalInstincts.push(...loadInstinctsFromDir(GLOBAL_INHERITED, 'inherited', 'global'));
      const projectIds = new Set(instincts.map(i => i.id));
      for (const gi of globalInstincts) {
        if (!projectIds.has(gi.id)) instincts.push(gi);
      }
    }

    return instincts;
  }

  function loadProjectOnlyInstincts(project) {
    const { GLOBAL_PERSONAL, GLOBAL_INHERITED } = getCliPaths();
    if (project.id === 'global') {
      return [
        ...loadInstinctsFromDir(GLOBAL_PERSONAL, 'personal', 'global'),
        ...loadInstinctsFromDir(GLOBAL_INHERITED, 'inherited', 'global')
      ];
    }
    return loadAllInstincts(project, false);
  }

  function validateInstinctId(id) {
    if (!id || id.length > 128) return false;
    if (/[/\\.]\.|^\./.test(id) || id.includes('..')) return false;
    return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id);
  }

  function cmdStatus() {
    const { GLOBAL_PERSONAL } = getCliPaths();
    const project = withToolEnv(() => detectProject(process.cwd()));
    const instincts = loadAllInstincts(project);

    if (instincts.length === 0) {
      console.log('No instincts found.');
      console.log(`\nProject: ${project.name} (${project.id})`);
      console.log(`  Project instincts:  ${project.instincts_personal}`);
      console.log(`  Global instincts:   ${GLOBAL_PERSONAL}`);
      return 0;
    }

    const projectInstincts = instincts.filter(i => i._scope_label === 'project');
    const globalInstincts = instincts.filter(i => i._scope_label === 'global');

    console.log('\n' + '='.repeat(60));
    console.log(`  INSTINCT STATUS - ${instincts.length} total`);
    console.log('='.repeat(60) + '\n');
    console.log(`  Project:  ${project.name} (${project.id})`);
    console.log(`  Project instincts: ${projectInstincts.length}`);
    console.log(`  Global instincts:  ${globalInstincts.length}\n`);

    const byDomain = {};
    for (const inst of instincts) {
      const domain = inst.domain || 'general';
      if (!byDomain[domain]) byDomain[domain] = [];
      byDomain[domain].push(inst);
    }

    for (const domain of Object.keys(byDomain).sort()) {
      const list = byDomain[domain].sort((a, b) => (b.confidence || 0.5) - (a.confidence || 0.5));
      console.log(`  ### ${domain.toUpperCase()} (${list.length})\n`);
      for (const inst of list) {
        const conf = (inst.confidence || 0.5) * 100;
        console.log(`    ${inst.id} [${inst.scope || '?'}] ${Math.round(conf)}%`);
        console.log(`              trigger: ${inst.trigger || 'unknown'}\n`);
      }
    }

    if (fs.existsSync(project.observations_file)) {
      const lines = fs.readFileSync(project.observations_file, 'utf8').split('\n').filter(Boolean).length;
      console.log('-'.repeat(60));
      console.log(`  Observations: ${lines} events logged`);
      console.log(`  File: ${project.observations_file}`);
    }
    console.log('\n' + '='.repeat(60) + '\n');
    return 0;
  }

  function cmdProjects() {
    const { PROJECTS_DIR, REGISTRY_FILE, GLOBAL_PERSONAL, GLOBAL_INHERITED } = getCliPaths();
    let registry = {};
    try {
      if (fs.existsSync(REGISTRY_FILE)) {
        registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
      }
    } catch {
      registry = {};
    }

    if (Object.keys(registry).length === 0) {
      console.log('No projects registered yet.');
      console.log('Projects are auto-detected when you use Claude Code in a git repo.');
      return 0;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`  KNOWN PROJECTS - ${Object.keys(registry).length} total`);
    console.log('='.repeat(60) + '\n');

    const entries = Object.entries(registry).sort((a, b) => (b[1].last_seen || '').localeCompare(a[1].last_seen || ''));

    for (const [pid, info] of entries) {
      const projectDir = path.join(PROJECTS_DIR, pid);
      const personalCount = loadInstinctsFromDir(path.join(projectDir, 'instincts', 'personal'), 'personal', 'project').length;
      const inheritedCount = loadInstinctsFromDir(path.join(projectDir, 'instincts', 'inherited'), 'inherited', 'project').length;
      const obsFile = path.join(projectDir, 'observations.jsonl');
      const obsCount = fs.existsSync(obsFile) ? fs.readFileSync(obsFile, 'utf8').split('\n').filter(Boolean).length : 0;
      console.log(`  ${info.name || pid} [${pid}]`);
      console.log(`    Root: ${info.root || 'unknown'}`);
      if (info.remote) console.log(`    Remote: ${info.remote}`);
      console.log(`    Instincts: ${personalCount} personal, ${inheritedCount} inherited`);
      console.log(`    Observations: ${obsCount} events`);
      console.log(`    Last seen: ${info.last_seen || 'unknown'}\n`);
    }

    const globalPersonal = loadInstinctsFromDir(GLOBAL_PERSONAL, 'personal', 'global').length;
    const globalInherited = loadInstinctsFromDir(GLOBAL_INHERITED, 'inherited', 'global').length;
    console.log('  GLOBAL');
    console.log(`    Instincts: ${globalPersonal} personal, ${globalInherited} inherited`);
    console.log('\n' + '='.repeat(60) + '\n');
    return 0;
  }

  function cmdExport(args) {
    const { GLOBAL_PERSONAL, GLOBAL_INHERITED } = getCliPaths();
    const project = withToolEnv(() => detectProject(process.cwd()));
    const scope = args.scope || 'all';
    let instincts;
    if (scope === 'project') instincts = loadProjectOnlyInstincts(project);
    else if (scope === 'global') {
      instincts = [...loadInstinctsFromDir(GLOBAL_PERSONAL, 'personal', 'global'), ...loadInstinctsFromDir(GLOBAL_INHERITED, 'inherited', 'global')];
    } else instincts = loadAllInstincts(project);

    if (args.domain) instincts = instincts.filter(i => i.domain === args.domain);
    if (instincts.length === 0) {
      console.log('No instincts to export.');
      return 1;
    }

    let out = `# Instincts export\n# Date: ${new Date().toISOString()}\n# Total: ${instincts.length}\n\n`;
    for (const inst of instincts) {
      out += '---\n';
      out += `id: ${inst.id}\n`;
      out += `trigger: "${inst.trigger || 'unknown'}"\n`;
      out += `confidence: ${inst.confidence ?? 0.5}\n`;
      out += `domain: ${inst.domain || 'general'}\n`;
      out += '---\n\n' + (inst.content || '') + '\n\n';
    }

    if (args.output) {
      fs.writeFileSync(args.output, out, 'utf8');
      console.log(`Exported ${instincts.length} instincts to ${args.output}`);
    } else {
      process.stdout.write(out);
    }
    return 0;
  }

  function cmdEvolve() {
    const project = withToolEnv(() => detectProject(process.cwd()));
    const instincts = loadAllInstincts(project);

    if (instincts.length < 3) {
      console.log('Need at least 3 instincts to analyze patterns.');
      console.log(`Currently have: ${instincts.length}`);
      return 1;
    }

    const projectInstincts = instincts.filter(i => i._scope_label === 'project');
    const globalInstincts = instincts.filter(i => i._scope_label === 'global');

    console.log('\n' + '='.repeat(60));
    console.log(`  EVOLVE ANALYSIS - ${instincts.length} instincts`);
    console.log(`  Project: ${project.name} (${project.id})`);
    console.log(`  Project-scoped: ${projectInstincts.length} | Global: ${globalInstincts.length}`);
    console.log('='.repeat(60) + '\n');

    const highConf = instincts.filter(i => (i.confidence || 0) >= 0.8);
    console.log(`High confidence instincts (>=80%): ${highConf.length}`);

    const triggerClusters = {};
    for (const inst of instincts) {
      let key = (inst.trigger || '').toLowerCase().replace(/\b(when|creating|writing|adding|implementing|testing)\b/g, '').trim();
      if (!key) key = 'general';
      if (!triggerClusters[key]) triggerClusters[key] = [];
      triggerClusters[key].push(inst);
    }

    const skillCandidates = Object.entries(triggerClusters)
      .filter(([, cluster]) => cluster.length >= 2)
      .map(([trigger, cluster]) => ({
        trigger,
        instincts: cluster,
        avg_confidence: cluster.reduce((sum, inst) => sum + (inst.confidence || 0.5), 0) / cluster.length
      }))
      .sort((a, b) => b.instincts.length - a.instincts.length);

    console.log(`\nPotential skill clusters found: ${skillCandidates.length}`);
    if (skillCandidates.length > 0) {
      console.log('\n## SKILL CANDIDATES\n');
      skillCandidates.slice(0, 5).forEach((candidate, index) => {
        console.log(`${index + 1}. Cluster: "${candidate.trigger}"`);
        console.log(`   Instincts: ${candidate.instincts.length}, Avg confidence: ${(candidate.avg_confidence * 100).toFixed(0)}%`);
      });
    }
    console.log('\n' + '='.repeat(60) + '\n');
    return 0;
  }

  function cmdImport(args) {
    const { GLOBAL_INHERITED } = getCliPaths();
    const project = withToolEnv(() => detectProject(process.cwd()));
    const source = args.source;
    let content;

    if (source.startsWith('http://') || source.startsWith('https://')) {
      console.log(`Fetching from URL: ${source}`);
      content = new Promise((resolve, reject) => {
        const mod = source.startsWith('https') ? https : http;
        mod.get(source, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
          res.on('error', reject);
        }).on('error', reject);
      });
    } else {
      const absPath = path.resolve(source);
      if (!fs.existsSync(absPath)) {
        console.error(`Invalid path: ${source}`);
        return 1;
      }
      content = Promise.resolve(fs.readFileSync(absPath, 'utf8'));
    }

    return content.then((text) => {
      const newInstincts = parseInstinctFile(text);
      if (newInstincts.length === 0) {
        console.log('No valid instincts found in source.');
        return 1;
      }
      const targetScope = args.scope || 'project';
      console.log(`\nFound ${newInstincts.length} instincts to import. Target scope: ${targetScope}`);
      const existing = loadAllInstincts(project);
      const existingIds = new Set(existing.map(i => i.id));
      const toAdd = newInstincts.filter(i => !existingIds.has(i.id));
      const toUpdate = newInstincts.filter(i => {
        const existingInstinct = existing.find(e => e.id === i.id);
        return existingInstinct && (i.confidence || 0) > (existingInstinct.confidence || 0);
      });
      if (args.dry_run) {
        console.log('[DRY RUN] No changes made.');
        return 0;
      }
      const outDir = targetScope === 'global' ? GLOBAL_INHERITED : project.instincts_inherited;
      fs.mkdirSync(outDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const outFile = path.join(outDir, `import-${stamp}.yaml`);
      let out = `# Imported from ${source}\n# Date: ${new Date().toISOString()}\n# Scope: ${targetScope}\n\n`;
      for (const inst of [...toAdd, ...toUpdate]) {
        out += '---\n';
        out += `id: ${inst.id}\ntrigger: "${inst.trigger || 'unknown'}"\nconfidence: ${inst.confidence ?? 0.5}\n`;
        out += `domain: ${inst.domain || 'general'}\nsource: inherited\nscope: ${targetScope}\n`;
        out += '---\n\n' + (inst.content || '') + '\n\n';
      }
      fs.writeFileSync(outFile, out, 'utf8');
      console.log(`Import complete! Saved to: ${outFile}`);
      return 0;
    }).catch(err => {
      console.error('Error:', err.message);
      return 1;
    });
  }

  function cmdPromote(args) {
    const { GLOBAL_PERSONAL, GLOBAL_INHERITED } = getCliPaths();
    const project = withToolEnv(() => detectProject(process.cwd()));
    const instinctId = args.instinct_id;

    if (instinctId) {
      if (!validateInstinctId(instinctId)) {
        console.error(`Invalid instinct ID: '${instinctId}'`);
        return 1;
      }
      const projectInstincts = loadProjectOnlyInstincts(project);
      const target = projectInstincts.find(i => i.id === instinctId);
      if (!target) {
        console.error(`Instinct '${instinctId}' not found in project ${project.name}.`);
        return 1;
      }
      const globalInstincts = [...loadInstinctsFromDir(GLOBAL_PERSONAL, 'personal', 'global'), ...loadInstinctsFromDir(GLOBAL_INHERITED, 'inherited', 'global')];
      if (globalInstincts.some(i => i.id === instinctId)) {
        console.error(`Instinct '${instinctId}' already exists in global scope.`);
        return 1;
      }
      fs.mkdirSync(GLOBAL_PERSONAL, { recursive: true });
      const outFile = path.join(GLOBAL_PERSONAL, `${instinctId}.yaml`);
      const out = '---\nid: ' + target.id + '\ntrigger: "' + (target.trigger || 'unknown') + '"\nconfidence: ' + (target.confidence ?? 0.5) + '\ndomain: ' + (target.domain || 'general') + '\nsource: promoted\nscope: global\npromoted_from: ' + project.id + '\n---\n\n' + (target.content || '');
      fs.writeFileSync(outFile, out, 'utf8');
      console.log(`Promoted '${instinctId}' to global scope. Saved to: ${outFile}`);
      return 0;
    }

    console.log('No instincts qualify for auto-promotion.');
    return 0;
  }

  function main(argv = process.argv.slice(2)) {
    const cmd = argv[0];
    const rest = argv.slice(1);

    const args = { scope: 'all', output: null, dry_run: false, source: rest[0], instinct_id: rest[0] };
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '--scope' && rest[i + 1]) args.scope = rest[i + 1];
      if (rest[i] === '--output' && rest[i + 1]) args.output = rest[i + 1];
      if (rest[i] === '-o' && rest[i + 1]) args.output = rest[i + 1];
      if (rest[i] === '--domain' && rest[i + 1]) args.domain = rest[i + 1];
      if (rest[i] === '--dry-run') args.dry_run = true;
      if (rest[i] === '--force') args.force = true;
      if (rest[i] === '--min-confidence' && rest[i + 1]) args.min_confidence = parseFloat(rest[i + 1]);
    }

    let exitCode = 0;
    switch (cmd) {
      case 'status':
        exitCode = cmdStatus();
        break;
      case 'projects':
        exitCode = cmdProjects();
        break;
      case 'export':
        exitCode = cmdExport(args);
        break;
      case 'evolve':
        exitCode = cmdEvolve(args);
        break;
      case 'import':
        if (!args.source) {
          console.error('Usage: instinct-cli.js import <file|url> [--scope project|global] [--dry-run]');
          exitCode = 1;
        } else {
          cmdImport(args).then(code => process.exit(code));
          return;
        }
        break;
      case 'promote':
        exitCode = cmdPromote(args);
        break;
      default:
        console.log('Instinct CLI for Continuous Learning v2.1');
        console.log('Commands: status, import, export, evolve, promote, projects');
        console.log('Usage: node instinct-cli.js <command> [options]');
        exitCode = cmd ? 1 : 0;
    }
    process.exit(exitCode);
  }

  return {
    buildCodexEnv,
    getCliPaths,
    main
  };
}

module.exports = {
  createInstinctCliRuntime
};

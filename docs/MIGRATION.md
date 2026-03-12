# Migration: Reset and reinstall ModelDev Toolkit (Node-only)

After the ModelDev Toolkit Node-only migration, skills and hooks run only via Node.js. Use this guide to reset and reinstall from the repo.

## Current status

- **Done:** Installer and runtime are **Node-only**. `node scripts/install-mdt.js` installs to Claude Code, Cursor, Codex, or Gemini. No PowerShell or Bash scripts remain; skills and hooks run via Node.js. CI guard (`validate-no-hardcoded-paths.js`) enforces no `.sh`/`.ps1` in the repo.
- **Pre-v1 install policy:** Until a commit is tagged `v1.0.0`, install layout and package composition are allowed to change. Do not rely on in-place migration steps between intermediate revisions. The expected workflow is to start fresh and re-run `node scripts/install-mdt.js`.

## Steps

1. **Back up** (optional) your existing configs:
   - `~/.claude` (Claude Code)
   - `~/.cursor` (Cursor)
   - `~/.codex` (Codex)

2. **Remove or archive** old skill/hook directories where `.sh`/`.ps1` scripts might still be referenced, if you want a clean state.

   Pre-v1 guidance: prefer a clean reinstall over trying to preserve an older
   partial install layout. Until `v1.0.0`, MDT does not promise upgrade/migration
   workflows between intermediate installer layouts.

3. **Re-run the installer** from the ModelDev Toolkit repo (Node only):
   ```bash
   cd /path/to/modeldev-toolkit
   node scripts/install-mdt.js typescript
   ```
   For Cursor:
   ```bash
   node scripts/install-mdt.js --target cursor typescript
   ```
   For Codex only:
   ```bash
   node scripts/install-mdt.js --target codex typescript continuous-learning
   ```

   Scope rule reminder:
   - installs are global-only now
   - `--global` is only a compatibility alias
   - `--project-dir` is retired
   - MDT-owned state now lives under `~/.{tool}/mdt/`

4. **Verify** (optional): run a quick smoke check that env detection works:
   ```bash
   node -e "const d=require('./scripts/lib/detect-env.js').detectEnv(); console.log('tool:', d.tool, 'configDir:', d.getConfigDir(), 'dataDir:', d.getDataDir());"
   ```

Hooks installed from the repo now use `node "…/script.js"` (and `node -e "…"` for inline hooks). No Bash or PowerShell scripts are invoked by ModelDev Toolkit skills or hooks.

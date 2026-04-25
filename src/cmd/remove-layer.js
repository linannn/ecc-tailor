import { unlink } from 'node:fs/promises';
import log from '../core/logger.js';
import { loadState, saveState } from '../core/state.js';
import { loadConfig } from '../core/config.js';
import { writeJsonAtomic } from '../util/json.js';
import { removeEccTailorHooks } from '../hooks/index.js';
import { paths } from '../core/paths.js';

/**
 * Parse layer-remove flags from args.
 *
 * @param {string[]} args
 * @returns {{ mode: 'project'|'global'|'all', projectPath: string|null }}
 */
function parseFlags(args) {
  let mode = null;
  let projectPath = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--all') {
      mode = 'all';
    } else if (arg === '--global') {
      mode = 'global';
    } else if (arg === '--project') {
      mode = 'project';
      projectPath = args[++i] ?? null;
    } else if (arg.startsWith('--project=')) {
      mode = 'project';
      projectPath = arg.slice('--project='.length);
    }
  }

  return { mode, projectPath };
}

/**
 * ecc-tailor remove --project <path> | --global | --all
 *
 * Removes symlinks owned by the specified layer and, where applicable,
 * cleans up hooks and the slash command.
 *
 * @param {string[]} args
 */
export async function removeLayerCmd(args) {
  const { mode, projectPath } = parseFlags(args);

  if (!mode) {
    log.err('Usage: ecc-tailor remove --project <path> | --global | --all');
    process.exitCode = 2;
    return;
  }

  if (mode === 'project' && !projectPath) {
    log.err('--project requires a path argument');
    process.exitCode = 2;
    return;
  }

  let state = loadState();
  let newSymlinks = { ...state.symlinks };
  let removed = 0;

  // Determine which symlink entries match the requested layer
  for (const [dst, entry] of Object.entries(state.symlinks)) {
    const { ownedBy } = entry;

    // Skip ephemeral entries unless removing everything
    if (mode !== 'all' && ownedBy && ownedBy.startsWith('scan:')) {
      continue;
    }

    let matches = false;
    if (mode === 'all') {
      matches = true;
    } else if (mode === 'global') {
      matches = ownedBy === 'global';
    } else if (mode === 'project') {
      matches = ownedBy === `proj:${projectPath}`;
    }

    if (!matches) continue;

    // Unlink the destination (ignore if already gone)
    try {
      await unlink(dst);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    const { [dst]: _removed, ...rest } = newSymlinks;
    newSymlinks = rest;
    removed++;
  }

  // Build updated state with new symlinks map
  state = { ...state, symlinks: newSymlinks };

  // For --global and --all: remove hooks and slash command
  if (mode === 'global' || mode === 'all') {
    const { removed: hooksRemoved } = await removeEccTailorHooks({ settingsFile: paths.claudeSettings() });
    state = {
      ...state,
      hooks: {
        installed: false,
        settingsBackup: null,
        addedEntries: {},
        markerId: 'ecc-tailor',
      },
    };
    if (hooksRemoved > 0) {
      log.ok(`removed ${hooksRemoved} hook entries + env.CLAUDE_PLUGIN_ROOT from settings.json`);
    }

    try {
      await unlink(paths.claudeCommand('ecc-tailor'));
      log.ok('removed /ecc-tailor slash command');
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  saveState(state);

  if (mode === 'project') {
    const cfg = loadConfig();
    const updated = { ...cfg, projects: cfg.projects.filter(p => p.path !== projectPath) };
    writeJsonAtomic(paths.configFile(), updated);
    log.ok('cleaned project entry from config');
  } else if (mode === 'all') {
    const cfg = loadConfig();
    const updated = { ...cfg, projects: [] };
    writeJsonAtomic(paths.configFile(), updated);
    log.ok('cleared all project entries from config');
  }

  const kind = mode === 'project' ? `project:${projectPath}` : mode;
  log.ok(`removed ${removed} symlinks (layer: ${kind})`);
}

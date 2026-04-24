import { unlink } from 'node:fs/promises';
import log from './logger.js';
import { loadState, saveState } from './state.js';
import { removeEccTailorHooks } from './hooks-merge.js';
import { paths } from './paths.js';

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

  const state = loadState();
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

    delete state.symlinks[dst];
    removed++;
  }

  // For --global and --all: remove hooks and slash command
  if (mode === 'global' || mode === 'all') {
    await removeEccTailorHooks({ settingsFile: paths.claudeSettings() });
    state.hooks = {
      installed: false,
      settingsBackup: null,
      addedEntries: {},
      markerId: 'ecc-tailor',
    };

    try {
      await unlink(paths.claudeCommand('ecc-tailor'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  saveState(state);

  const kind = mode === 'project' ? `project:${projectPath}` : mode;
  log.ok(`removed ${removed} symlinks (layer: ${kind})`);
}

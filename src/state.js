import { homedir } from 'node:os';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from './util/json.js';
import { paths } from './paths.js';

export const EMPTY_STATE = {
  version: 1,
  eccRef: null,
  lastApply: null,
  symlinks: {},           // dstAbsPath → { eccSrc, kind, ownedBy, ephemeral }
  forks: {},              // dstAbsPath → { forkedAt, originalEccSrc }
  ignored: { skills: [], agents: [] },
  ephemeralScans: {},     // projectPath → { bundle, attachedAt }
  hooks: {
    installed: false,
    settingsBackup: null,
    addedEntries: {},
    markerId: 'ecc-tailor',
  },
};

/**
 * Return a deep clone of EMPTY_STATE, filling in any missing top-level keys
 * from the given raw object.
 *
 * @param {object|null} raw
 * @returns {object}
 */
function mergeWithDefaults(raw) {
  if (!raw) return JSON.parse(JSON.stringify(EMPTY_STATE));
  const merged = JSON.parse(JSON.stringify(EMPTY_STATE));
  for (const key of Object.keys(EMPTY_STATE)) {
    if (key in raw) {
      merged[key] = raw[key];
    }
  }
  return merged;
}

/**
 * Resolve the state file path given an optional home override.
 * When `home` is provided it is treated as the user's HOME directory,
 * and the XDG default path (~/.local/state/ecc-tailor/state.json) is used
 * relative to it.
 *
 * @param {string|undefined} home
 * @returns {string}
 */
function resolveStateFile(home) {
  if (!home) return paths.stateFile();
  return join(home, '.local', 'state', 'ecc-tailor', 'state.json');
}

/**
 * Load state from disk. Returns a deep clone of EMPTY_STATE (with forward-compat
 * defaults filled in) if the file is missing.
 *
 * @param {{ home?: string }} [opts]
 * @returns {object}
 */
export function loadState({ home } = {}) {
  const file = resolveStateFile(home);
  const raw = readJson(file);
  return mergeWithDefaults(raw);
}

/**
 * Atomically write state to disk.
 *
 * @param {object} state
 * @param {{ home?: string }} [opts]
 */
export function saveState(state, { home } = {}) {
  const file = resolveStateFile(home);
  writeJsonAtomic(file, state);
}

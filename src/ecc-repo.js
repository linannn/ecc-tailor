import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { git, headSha } from './util/git.js';

const ECC_REMOTE = 'https://github.com/affaan-m/everything-claude-code.git';

/**
 * Resolve the ECC checkout root.
 *
 * Resolution order:
 *  1. config.eccPath — if set and exists, use it.
 *  2. Default clone location (~/.local/share/ecc-tailor/ecc) — if .git exists, use it.
 *  3. If opts.clone === true, perform a shallow clone and return the path.
 *  4. Otherwise throw "ECC clone not found".
 *
 * @param {{ eccPath?: string|null }} config
 * @param {{ clone?: boolean, home?: string }} [opts]
 * @returns {string}
 */
export function resolveEccRoot(config, opts = {}) {
  // 1. Explicit override
  if (config.eccPath && existsSync(config.eccPath)) {
    return config.eccPath;
  }

  // 2. Default location
  const home = opts.home ?? (process.env.HOME || homedir());
  const defaultPath = join(home, '.local', 'share', 'ecc-tailor', 'ecc');

  if (existsSync(join(defaultPath, '.git'))) {
    return defaultPath;
  }

  // 3. Auto-clone
  if (opts.clone === true) {
    git(
      ['clone', '--depth', '1', '--branch', 'main', ECC_REMOTE, defaultPath],
    );
    return defaultPath;
  }

  // 4. Not found
  throw new Error('ECC clone not found');
}

/**
 * Return the HEAD SHA of the ECC repo.
 *
 * @param {string} eccRoot
 * @returns {string}
 */
export function getEccRef(eccRoot) {
  return headSha(eccRoot);
}

/**
 * Fetch latest refs from origin main (non-fatal on error).
 *
 * @param {string} eccRoot
 * @returns {{ stdout: string, stderr: string, status: number }}
 */
export function fetchEcc(eccRoot) {
  return git(['fetch', 'origin', 'main', '--quiet'], {
    cwd: eccRoot,
    throwOnError: false,
  });
}

/**
 * Pull latest changes with fast-forward only.
 *
 * @param {string} eccRoot
 */
export function pullEcc(eccRoot) {
  git(['pull', '--ff-only', 'origin', 'main'], { cwd: eccRoot });
}

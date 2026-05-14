import { copyFileSync, readdirSync, unlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const MAX_BACKUPS = 3;

/**
 * Create a timestamped backup of `srcPath` and prune old backups,
 * keeping only the most recent MAX_BACKUPS copies.
 *
 * @param {string} srcPath
 * @returns {string} path to the new backup (or '' if source didn't exist)
 */
export function backupFile(srcPath) {
  const dir = dirname(srcPath);
  const base = basename(srcPath);
  const prefix = `${base}.bak.`;

  const backupName = `${prefix}${Date.now()}`;
  const backupPath = join(dir, backupName);

  try {
    copyFileSync(srcPath, backupPath);
  } catch (err) {
    if (err.code === 'ENOENT') return backupPath;
    throw err;
  }

  try {
    const entries = readdirSync(dir)
      .filter(f => f.startsWith(prefix))
      .sort();

    const toRemove = entries.slice(0, -MAX_BACKUPS);
    for (const old of toRemove) {
      try { unlinkSync(join(dir, old)); } catch { /* best effort */ }
    }
  } catch {
    /* best effort — dir unreadable is fine */
  }

  return backupPath;
}

import { stat, unlink, copyFile, cp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { loadState, saveState } from './state.js';
import { loadConfig } from './config.js';
import { resolveEccRoot } from './ecc-repo.js';
import log from './logger.js';

/**
 * Convert a managed symlink into a real local file or directory.
 * After forking, apply will leave the target alone.
 *
 * @param {string[]} args  - CLI args; args[0] is the target path to fork
 */
export async function forkCmd(args) {
  const rawPath = args[0];
  if (!rawPath) {
    throw new Error('Usage: ecc-tailor fork <path>');
  }

  const target = resolve(rawPath);

  // Load state and verify the target is managed
  const state = loadState();
  const entry = state.symlinks[target];
  if (!entry) {
    throw new Error(`${target}: not managed by ecc-tailor`);
  }

  // Load config and resolve ECC root
  const config = loadConfig();
  const eccRoot = resolveEccRoot(config);

  // Resolve source path in ECC
  const srcPath = join(eccRoot, entry.eccSrc);

  // Determine if the ECC source is a file or directory
  const srcStat = await stat(srcPath);

  // Remove the symlink
  await unlink(target);

  // Copy from ECC source
  if (srcStat.isDirectory()) {
    await cp(srcPath, target, { recursive: true });
  } else {
    await copyFile(srcPath, target);
  }

  // Update state: move from symlinks → forks
  state.forks[target] = {
    forkedAt: new Date().toISOString(),
    originalEccSrc: entry.eccSrc,
  };
  delete state.symlinks[target];

  saveState(state);

  log.ok(`forked: ${target}`);
  log.dim(`  source: ${srcPath}`);
  log.dim(`  apply will no longer manage this file`);
}

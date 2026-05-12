import { lstat, mkdir, symlink, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Compute what needs to be added, removed, kept, or is in conflict.
 *
 * @param {Array<{
 *   dst: string,
 *   eccSrc: string,
 *   kind: string,
 *   ownedBy: string,
 *   ephemeral: boolean,
 * }>} desired
 * @param {object} state  - state object (from state.js)
 * @param {{ ecc: string }} opts
 * @returns {Promise<{
 *   toAdd:     Array<object>,
 *   toRemove:  Array<{ dst: string, owned: object }>,
 *   toKeep:    Array<object>,
 *   conflicts: Array<object>,
 * }>}
 */
export async function planApply(desired, state, { ecc }) {
  const symlinkMap = state.symlinks ?? {};
  const forkMap    = state.forks    ?? {};

  const desiredByDst = new Map(desired.map(item => [item.dst, item]));

  const toAdd     = [];
  const toRemove  = [];
  const toKeep    = [];
  const conflicts = [];

  // Determine toAdd and toKeep
  for (const item of desired) {
    const { dst, eccSrc } = item;

    // Skip if already forked — the user owns that file
    if (dst in forkMap) continue;

    if (dst in symlinkMap && symlinkMap[dst].eccSrc === eccSrc) {
      // Already tracked with same source → keep
      toKeep.push({ ...item, absEccSrc: join(ecc, eccSrc) });
    } else {
      // Not yet tracked (or tracked with a different source) → add
      const entry = { ...item, absEccSrc: join(ecc, eccSrc) };
      toAdd.push(entry);

      // Conflict check: does the destination already exist on disk
      // and is it NOT already managed by us and NOT forked?
      if (!(dst in symlinkMap) && !(dst in forkMap)) {
        try {
          await lstat(dst);
          // File exists and is not in our state — conflict
          conflicts.push(entry);
        } catch (err) {
          if (err.code !== 'ENOENT') throw err;
          // ENOENT → no conflict
        }
      }
    }
  }

  // Determine toRemove: symlinks we track that are no longer desired
  for (const dst of Object.keys(symlinkMap)) {
    if (!desiredByDst.has(dst)) {
      toRemove.push({ dst, owned: symlinkMap[dst] });
    }
  }

  // Remove false conflicts: files reachable only through a stale dir symlink
  // that will be removed (e.g. rules-dir → rules-file migration)
  const removeDsts = new Set(toRemove.map(r => r.dst));
  const realConflicts = conflicts.filter(
    c => !removeDsts.has(dirname(c.dst)),
  );

  return { toAdd, toRemove, toKeep, conflicts: realConflicts };
}

/**
 * Execute a plan produced by `planApply`.
 *
 * Each symlink creation/removal is followed by an `onProgress` callback so the
 * caller can flush state to disk incrementally — if the process is killed
 * mid-apply, state.json already records every symlink created so far.
 *
 * @param {{ toAdd: Array<object>, toRemove: Array<object> }} plan
 * @param {object} state  - state object (not mutated)
 * @param {{ ecc: string, onProgress?: (state: object) => void }} opts
 * @returns {Promise<object>} new state object with updated symlinks
 */
export async function executeApply(plan, state, { ecc, onProgress }) {
  const { toAdd = [], toRemove = [] } = plan;
  const flush = onProgress ?? (() => {});

  let symlinks = { ...state.symlinks };

  // 1. Remove stale symlinks
  for (const { dst } of toRemove) {
    try {
      await unlink(dst);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    const { [dst]: _, ...rest } = symlinks;
    symlinks = rest;
    flush({ ...state, symlinks });
  }

  // 2. Add new symlinks
  for (const item of toAdd) {
    const { dst, eccSrc, kind, ownedBy, ephemeral, absEccSrc } = item;

    await mkdir(dirname(dst), { recursive: true });

    try {
      await unlink(dst);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    await symlink(absEccSrc, dst);

    symlinks = { ...symlinks, [dst]: { eccSrc, kind, ownedBy, ephemeral } };
    flush({ ...state, symlinks });
  }

  return { ...state, symlinks };
}

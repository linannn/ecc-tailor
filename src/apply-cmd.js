import { loadConfig } from './config.js';
import { loadState, saveState } from './state.js';
import { loadBundles } from './bundles.js';
import { resolveEccRoot, getEccRef } from './ecc-repo.js';
import { scanEcc } from './fs-scan.js';
import { resolveDesired } from './resolve.js';
import { planApply, executeApply } from './apply.js';
import log from './logger.js';

/**
 * End-to-end apply flow.
 *
 * @param {string[]} args  - CLI args (may include --dry-run)
 */
export async function applyCmd(args) {
  const dryRun = args.includes('--dry-run');

  // 1. Load config, state
  const config = loadConfig();
  const state  = loadState();

  // 2. Resolve ECC root (clone if needed)
  const eccRoot = resolveEccRoot(config, { clone: true });

  // 3. Load bundles, scan ECC fs
  const bundles = loadBundles();
  const inv     = scanEcc(eccRoot);

  // 4. Resolve desired symlinks
  const home    = process.env.HOME;
  const desired = resolveDesired(config, bundles, inv, { home });

  // 5. Plan
  const plan = await planApply(desired, state, { ecc: eccRoot });

  // 6. If conflicts → print them all, exit code 1, return
  if (plan.conflicts.length > 0) {
    log.err('Conflicts detected — aborting apply:');
    for (const c of plan.conflicts) {
      log.dim(`  conflict: ${c.dst}`);
    }
    process.exit(1);
    return;
  }

  // 7. Print plan summary
  const addCount    = plan.toAdd.length;
  const removeCount = plan.toRemove.length;
  const keepCount   = plan.toKeep.length;

  log.info(`Plan: ${addCount} to add, ${removeCount} to remove, ${keepCount} to keep`);
  for (const item of plan.toAdd) {
    log.dim(`  + ${item.dst}`);
  }
  for (const item of plan.toRemove) {
    log.dim(`  - ${item.dst}`);
  }
  for (const item of plan.toKeep) {
    log.dim(`  = ${item.dst}`);
  }

  // 8. If dry-run → return (don't execute)
  if (dryRun) {
    return;
  }

  // 9. Execute
  await executeApply(plan, state, { ecc: eccRoot });

  // 10. Update state metadata
  state.eccRef    = getEccRef(eccRoot);
  state.lastApply = new Date().toISOString();

  // 11. Save state
  saveState(state);

  // 12/13. Print outcome
  if (addCount === 0 && removeCount === 0) {
    log.info('Nothing to do.');
  } else {
    log.ok('apply complete');

    // Print rules notice if any rules-dir items were added
    const addedRules = plan.toAdd.filter(item => item.kind === 'rules-dir');
    if (addedRules.length > 0) {
      log.info('');
      log.warn('rules installed — NOT auto-loaded by Claude Code');
      log.info('To activate, add to ~/.claude/CLAUDE.md:');
      for (const item of addedRules) {
        // Extract language from eccSrc, e.g. "rules/common" → "common"
        const lang = item.eccSrc.split('/')[1];
        log.dim(`  @rules/${lang}/<file>.md`);
      }
    }
  }
}

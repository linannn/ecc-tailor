import { mkdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { loadConfig } from './config.js';
import { loadState, saveState } from './state.js';
import { loadBundles, resolveBundle } from './bundles.js';
import { resolveEccRoot } from './ecc-repo.js';
import { scanEcc } from './fs-scan.js';
import log from './logger.js';

/**
 * Implement `ecc-tailor scan attach <path>` and `ecc-tailor scan detach <path>`.
 *
 * @param {string[]} args
 */
export async function scanCmd(args) {
  const [subcmd, rawPath] = args;

  if (subcmd === 'attach') {
    await scanAttach(rawPath);
  } else if (subcmd === 'detach') {
    await scanDetach(rawPath);
  } else {
    log.err(`Unknown scan subcommand: ${subcmd ?? '(none)'}`);
    log.dim('Usage: ecc-tailor scan attach [path]');
    log.dim('       ecc-tailor scan detach [path]');
    process.exit(2);
  }
}

async function scanAttach(rawPath) {
  const target = resolve(rawPath ?? '.');

  // 1. Load state; check for duplicate attach
  const state = loadState();
  if (state.ephemeralScans[target]) {
    throw new Error(`already attached: scan is already active for ${target}`);
  }

  // 2. Load config, resolve ECC root, load bundles, scan ECC
  const config = loadConfig();
  const eccRoot = resolveEccRoot(config);
  const bundles = loadBundles();
  const inv = scanEcc(eccRoot);

  // 3. Resolve the `scan` bundle and get its skills list
  const scanBundle = resolveBundle(bundles, 'scan');
  const skillNames = scanBundle.skills;

  // 4. For each skill: create symlink at <target>/.claude/skills/<name> → <eccRoot>/skills/<name>
  const skillsDstDir = join(target, '.claude', 'skills');

  for (const name of skillNames) {
    // Verify the skill exists in the ECC inventory
    const skillEntry = inv.skills.find(s => s.name === name);
    if (!skillEntry) {
      throw new Error(`skill "${name}" listed in scan bundle not found in ECC inventory`);
    }

    const dst = join(skillsDstDir, name);
    const src = join(eccRoot, 'skills', name);

    // mkdir -p parent
    mkdirSync(dirname(dst), { recursive: true });

    // Unlink dst if it already exists (stale symlink or leftover)
    try {
      unlinkSync(dst);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    symlinkSync(src, dst);

    // Record in state.symlinks
    state.symlinks[dst] = {
      eccSrc: `skills/${name}`,
      kind: 'skill-dir',
      ownedBy: `scan:${target}`,
      ephemeral: true,
    };
  }

  // 5. Record ephemeral scan entry
  state.ephemeralScans[target] = {
    bundle: 'scan',
    attachedAt: new Date().toISOString(),
  };

  // 6. Save state
  saveState(state);

  // 7. Log success + hint
  log.ok(`scan attached to ${target}`);
  log.info('Run /agent-sort in Claude Code, then: ecc-tailor scan detach');
}

async function scanDetach(rawPath) {
  const target = resolve(rawPath ?? '.');

  // 1. Load state; verify active scan
  const state = loadState();
  if (!state.ephemeralScans[target]) {
    throw new Error(`no active scan: scan is not attached to ${target}`);
  }

  // 2. Find all symlinks owned by this scan
  const prefix = `scan:${target}`;
  const toRemove = Object.keys(state.symlinks).filter(
    dst => state.symlinks[dst].ownedBy === prefix,
  );

  // 3. Unlink each; remove from state.symlinks
  for (const dst of toRemove) {
    try {
      unlinkSync(dst);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    delete state.symlinks[dst];
  }

  // 4. Remove ephemeral scan entry
  delete state.ephemeralScans[target];

  // 5. Save state
  saveState(state);

  // 6. Log success
  log.ok(`scan detached from ${target}`);
}

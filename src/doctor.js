import { readlink, access } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { loadConfig } from './config.js';
import { loadState } from './state.js';
import { resolveEccRoot } from './ecc-repo.js';
import { paths } from './paths.js';
import log from './logger.js';

/**
 * Run health checks and report any problems.
 * Exits with code 1 when problems are found.
 */
export async function doctorCmd() {
  let problems = 0;

  // 1. Load config
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    log.err(`config load failed: ${err.message}`);
    problems++;
    config = null;
  }

  // 2. Load state (state is always readable; missing → empty defaults)
  const state = loadState();

  // 3. Check ECC clone exists
  if (config) {
    try {
      resolveEccRoot(config, { clone: false });
    } catch (err) {
      log.err(`ECC clone not found: ${err.message}`);
      problems++;
    }
  }

  // 4. Check every symlink in state
  for (const [dst, entry] of Object.entries(state.symlinks ?? {})) {
    try {
      const target = await readlink(dst);
      await access(target);
    } catch (err) {
      log.err(`broken symlink: ${dst} → ${entry.eccSrc ?? '?'} (${err.message})`);
      problems++;
    }
  }

  // 5. Check ~/.claude/settings.json readable + parseable (ignore ENOENT)
  const settingsFile = paths.claudeSettings();
  try {
    const raw = readFileSync(settingsFile, 'utf8');
    JSON.parse(raw);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      log.err(`settings.json unreadable or invalid JSON: ${err.message}`);
      problems++;
    }
  }

  // Report outcome
  if (problems === 0) {
    log.ok('all checks passed');
  } else {
    log.err(`${problems} problem${problems !== 1 ? 's' : ''} found`);
    process.exit(1);
  }
}

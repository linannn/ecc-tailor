import { git } from './util/git.js';
import log from './logger.js';

const MS_24H = 24 * 60 * 60 * 1000;

/**
 * Returns true if a fetch should be performed — i.e., lastFetchISO is null
 * or the timestamp is more than 24 hours ago.
 *
 * @param {string|null} lastFetchISO
 * @returns {boolean}
 */
export function shouldFetch(lastFetchISO) {
  if (!lastFetchISO) return true;
  return Date.now() - new Date(lastFetchISO).getTime() > MS_24H;
}

/**
 * Best-effort: check if origin/main has new skills or agents since the last
 * apply, and print a non-blocking hint if so.
 *
 * @param {string} eccRoot - absolute path to the ECC clone
 * @param {object} state   - mutable state object (lastFetch may be updated)
 */
export async function checkForUpdates(eccRoot, state) {
  // 1. Throttle: skip if fetched recently
  if (!shouldFetch(state.lastFetch ?? null)) return;

  // 2. Fetch (best-effort — ignore failures)
  git(['fetch', 'origin', 'main', '--quiet'], { cwd: eccRoot, throwOnError: false });
  state.lastFetch = new Date().toISOString();

  // 3. Need a baseline ref to diff against
  if (!state.eccRef) return;

  // 4. Get remote ref
  const { stdout: remoteRaw, status: revStatus } = git(
    ['rev-parse', 'origin/main'],
    { cwd: eccRoot, throwOnError: false },
  );
  if (revStatus !== 0) return;

  const remoteRef = remoteRaw.trim();
  if (!remoteRef || remoteRef === state.eccRef) return;

  // 5. Diff for added files under skills/ and agents/
  const { stdout: diffRaw, status: diffStatus } = git(
    ['diff', '--name-status', `${state.eccRef}..${remoteRef}`, '--', 'skills/', 'agents/'],
    { cwd: eccRoot, throwOnError: false },
  );
  if (diffStatus !== 0 || !diffRaw.trim()) return;

  // 6. Collect only added files (status starts with 'A')
  const addedSkills = [];
  const addedAgents = [];

  for (const line of diffRaw.trim().split('\n')) {
    const parts = line.split('\t');
    if (parts.length < 2) continue;
    const [status, filePath] = parts;
    if (!status.startsWith('A')) continue;

    const segments = filePath.split('/');
    // skills/<name>/... or agents/<name>/...
    if (segments[0] === 'skills' && segments[1]) {
      addedSkills.push(segments[1]);
    } else if (segments[0] === 'agents' && segments[1]) {
      addedAgents.push(segments[1]);
    }
  }

  // Deduplicate
  const uniqueSkills = [...new Set(addedSkills)];
  const uniqueAgents = [...new Set(addedAgents)];

  // 7. Filter out ignored items
  const ignoredSkills = new Set(state.ignored?.skills ?? []);
  const ignoredAgents = new Set(state.ignored?.agents ?? []);

  const newSkills = uniqueSkills.filter(s => !ignoredSkills.has(s));
  const newAgents = uniqueAgents.filter(a => !ignoredAgents.has(a));

  if (newSkills.length === 0 && newAgents.length === 0) return;

  // 8. Print hint
  const shortSha = state.eccRef.slice(0, 7);
  log.h1('ECC Update Available');
  log.info(`  Since last apply (${shortSha}), ECC changed:`);
  if (newSkills.length > 0) {
    log.info(`    + ${newSkills.length} skills: ${newSkills.join(', ')}`);
  }
  if (newAgents.length > 0) {
    log.info(`    + ${newAgents.length} agents: ${newAgents.join(', ')}`);
  }
  log.info('  Run `ecc-tailor upgrade` to review and opt-in.');
}

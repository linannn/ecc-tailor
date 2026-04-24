import { createInterface } from 'node:readline';
import log from './logger.js';
import { loadConfig } from './config.js';
import { loadState, saveState } from './state.js';
import { resolveEccRoot, getEccRef, pullEcc } from './ecc-repo.js';
import { git } from './util/git.js';
import { writeJsonAtomic } from './util/json.js';
import { paths } from './paths.js';
import { scanEcc } from './fs-scan.js';
import { applyCmd } from './apply-cmd.js';

/**
 * Pure function: filter out items already in the ignored lists.
 *
 * @param {{ kind: 'skill'|'agent', name: string, description: string }[]} newItems
 * @param {{ skills: string[], agents: string[] }} ignored
 * @returns {{ kind: 'skill'|'agent', name: string, description: string }[]}
 */
export function buildUpgradePlan(newItems, ignored) {
  const ignoredSkills = new Set(ignored?.skills ?? []);
  const ignoredAgents = new Set(ignored?.agents ?? []);

  return newItems.filter(item => {
    if (item.kind === 'skill') return !ignoredSkills.has(item.name);
    if (item.kind === 'agent') return !ignoredAgents.has(item.name);
    return true;
  });
}

/**
 * Ask a question via readline and return the trimmed answer.
 *
 * @param {import('node:readline').Interface} rl
 * @param {string} question
 * @returns {Promise<string>}
 */
function ask(rl, question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim()));
  });
}

/**
 * Main upgrade flow:
 *  1. Load config, state, resolve ECC root
 *  2. Fetch + compare refs
 *  3. Diff for new skills/agents
 *  4. Build upgrade plan (filter ignored)
 *  5. Interactive per-item prompt: [a]pprove / [i]gnore / [s]kip / [d]etail / [q]uit
 *  6. Pull ECC, update eccRef, apply approved items
 *
 * @param {string[]} _args
 */
export async function upgradeCmd(_args) {
  // 1. Load config, state, resolve ECC root
  const config = loadConfig();
  const state = loadState();
  const eccRoot = resolveEccRoot(config, { clone: false });

  // 2. Require a baseline ref
  if (!state.eccRef) {
    log.err('No eccRef in state — run "ecc-tailor apply" first');
    process.exitCode = 1;
    return;
  }

  // 3. Fetch
  log.dim('Fetching origin main…');
  git(['fetch', 'origin', 'main', '--quiet'], { cwd: eccRoot, throwOnError: false });

  // 4. Get remote ref
  const { stdout: remoteRaw, status: revStatus } = git(
    ['rev-parse', 'origin/main'],
    { cwd: eccRoot, throwOnError: false },
  );
  if (revStatus !== 0) {
    log.err('Could not resolve origin/main — is the remote reachable?');
    process.exitCode = 1;
    return;
  }

  const remoteRef = remoteRaw.trim();

  // 5. Already up to date?
  if (remoteRef === state.eccRef) {
    log.ok('Already up to date.');
    return;
  }

  // 6. Diff for added files
  const { stdout: diffRaw, status: diffStatus } = git(
    ['diff', '--name-status', `${state.eccRef}..${remoteRef}`, '--', 'skills/', 'agents/'],
    { cwd: eccRoot, throwOnError: false },
  );

  // 7. Parse new skills and agents from diff output
  const rawSkills = [];
  const rawAgents = [];

  if (diffStatus === 0 && diffRaw.trim()) {
    for (const line of diffRaw.trim().split('\n')) {
      const parts = line.split('\t');
      if (parts.length < 2) continue;
      const [status, filePath] = parts;
      if (!status.startsWith('A')) continue;

      const segments = filePath.split('/');
      // skills/<name>/SKILL.md
      if (segments[0] === 'skills' && segments[1] && segments[2] === 'SKILL.md') {
        rawSkills.push(segments[1]);
      }
      // agents/<name>.md
      if (segments[0] === 'agents' && segments[1] && segments[1].endsWith('.md')) {
        rawAgents.push(segments[1].slice(0, -3));
      }
    }
  }

  const uniqueSkills = [...new Set(rawSkills)];
  const uniqueAgents = [...new Set(rawAgents)];

  // 8. Look up descriptions from ECC inventory (checkout origin/main)
  git(['checkout', 'origin/main', '--detach', '--quiet'], { cwd: eccRoot, throwOnError: false });

  let inv;
  try {
    inv = scanEcc(eccRoot);
  } finally {
    // We'll pull properly later; for now leave detached HEAD
  }

  const skillMap = new Map(inv.skills.map(s => [s.name, s.description]));
  const agentMap = new Map(inv.agents.map(a => [a.name, a.description]));

  const newItems = [
    ...uniqueSkills.map(name => ({
      kind: 'skill',
      name,
      description: skillMap.get(name) ?? '',
    })),
    ...uniqueAgents.map(name => ({
      kind: 'agent',
      name,
      description: agentMap.get(name) ?? '',
    })),
  ];

  // 9. Build upgrade plan (filter ignored)
  const plan = buildUpgradePlan(newItems, state.ignored);

  // 10. Nothing new after filtering?
  if (plan.length === 0) {
    log.info('No new items to review.');
    pullEcc(eccRoot);
    state.eccRef = getEccRef(eccRoot);
    saveState(state);
    log.ok('ECC updated.');
    return;
  }

  // 11. Interactive per-item prompt
  log.info('');
  log.h1(`ECC Upgrade — ${plan.length} new item(s) to review`);
  log.info('');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const approved = [];
  let quit = false;

  for (const item of plan) {
    if (quit) break;

    log.info(`  [${item.kind}] ${item.name}`);
    if (item.description) {
      log.dim(`    ${item.description}`);
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const answer = await ask(
        rl,
        '  [a]pprove / [i]gnore / [s]kip / [d]etail / [q]uit > ',
      );
      const key = answer.toLowerCase()[0];

      if (key === 'a') {
        // Ask scope
        const scopeAnswer = await ask(
          rl,
          '  Scope — enter "global" or an absolute project path > ',
        );
        const scope = scopeAnswer.trim() || 'global';
        approved.push({ item, scope });
        log.ok(`  Will add ${item.name} to ${scope}`);
        break;
      } else if (key === 'i') {
        if (item.kind === 'skill') {
          if (!state.ignored.skills.includes(item.name)) {
            state.ignored.skills.push(item.name);
          }
        } else {
          if (!state.ignored.agents.includes(item.name)) {
            state.ignored.agents.push(item.name);
          }
        }
        log.dim(`  Ignored ${item.name}`);
        break;
      } else if (key === 's') {
        log.dim(`  Skipped ${item.name}`);
        break;
      } else if (key === 'd') {
        log.dim('  Use `ecc-tailor inventory --detail` for full content');
        // loop again for same item
      } else if (key === 'q') {
        quit = true;
        break;
      } else {
        log.warn('  Unknown key — use a / i / s / d / q');
      }
    }

    log.info('');
  }

  rl.close();

  // 12. Pull ECC and update eccRef
  pullEcc(eccRoot);
  state.eccRef = getEccRef(eccRoot);

  // 13. If any approved: update config extras + write + apply
  if (approved.length > 0) {
    const cfg = loadConfig();

    for (const { item, scope } of approved) {
      const isGlobal = scope === 'global' || scope === '';
      const key = item.kind === 'skill' ? 'skills' : 'agents';

      if (isGlobal) {
        if (!cfg.global.extras[key]) cfg.global.extras[key] = [];
        if (!cfg.global.extras[key].includes(item.name)) {
          cfg.global.extras[key].push(item.name);
        }
      } else {
        // Project scope — scope is an absolute path
        let entry = cfg.projects.find(p => p.path === scope);
        if (!entry) {
          entry = {
            path: scope,
            bundles: [],
            extras: { agents: [], skills: [], rulesLanguages: [] },
          };
          cfg.projects.push(entry);
        }
        if (!entry.extras) entry.extras = {};
        if (!Array.isArray(entry.extras[key])) entry.extras[key] = [];
        if (!entry.extras[key].includes(item.name)) {
          entry.extras[key].push(item.name);
        }
      }
    }

    writeJsonAtomic(paths.configFile(), cfg);
    await applyCmd([]);
  }

  // 14. Save state
  saveState(state);

  // 15. Summary
  const approvedCount = approved.length;
  const ignoredCount = plan.filter(item => {
    if (item.kind === 'skill') return state.ignored.skills.includes(item.name);
    return state.ignored.agents.includes(item.name);
  }).length;

  log.ok(
    `Upgrade complete — ${approvedCount} approved, ${ignoredCount} ignored, ECC ref updated`,
  );
}

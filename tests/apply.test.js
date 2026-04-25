import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { makeTmpEnv }  from './helpers/tmp-env.js';
import { makeFakeEcc } from './helpers/fake-ecc.js';
import { scanEcc }     from '../src/core/fs-scan.js';
import { resolveDesired } from '../src/core/resolve.js';
import { EMPTY_STATE }    from '../src/core/state.js';
import { planApply, executeApply } from '../src/apply/apply.js';

// ---------------------------------------------------------------------------
// Shared bundle + config helpers (mirrors resolve.test.js style)
// ---------------------------------------------------------------------------
const BUNDLES = {
  core: { agents: ['planner'], skills: ['coding-standards'] },
};

function makeConfig(overrides = {}) {
  return {
    global: {
      bundles: ['core'],
      extras:  { agents: [], skills: [], rulesLanguages: [] },
      excludes: { agents: [], skills: [] },
      ...overrides,
    },
    projects: [],
  };
}

// ---------------------------------------------------------------------------
// planApply: fresh install — everything in toAdd, nothing in toRemove
// ---------------------------------------------------------------------------
test('planApply: fresh install — all desired go to toAdd, nothing in toRemove or conflicts', async () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    const inv = scanEcc(ecc);
    const config  = makeConfig();
    const desired = resolveDesired(config, BUNDLES, inv, { home: env.home });
    const state   = structuredClone(EMPTY_STATE);

    const plan = await planApply(desired, state, { ecc });

    assert.equal(plan.toAdd.length, desired.length, 'all desired items should be in toAdd');
    assert.equal(plan.toRemove.length, 0, 'nothing to remove on fresh install');
    assert.equal(plan.toKeep.length, 0, 'nothing to keep on fresh install');
    assert.equal(plan.conflicts.length, 0, 'no conflicts on fresh install to empty dirs');

    // Spot-check that absEccSrc is populated
    const plannerEntry = plan.toAdd.find(e => e.eccSrc === 'agents/planner.md');
    assert.ok(plannerEntry, 'planner entry should be in toAdd');
    assert.equal(plannerEntry.absEccSrc, join(ecc, 'agents/planner.md'));
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// executeApply: creates symlinks + updates state
// ---------------------------------------------------------------------------
test('executeApply: creates symlinks on disk and records them in state', async () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    const inv = scanEcc(ecc);
    const config  = makeConfig();
    const desired = resolveDesired(config, BUNDLES, inv, { home: env.home });
    const state   = structuredClone(EMPTY_STATE);

    const plan = await planApply(desired, state, { ecc });
    await executeApply(plan, state, { ecc });

    // Check planner.md symlink
    const plannerDst = join(env.home, '.claude', 'agents', 'planner.md');
    const target = readlinkSync(plannerDst);
    assert.equal(target, join(ecc, 'agents/planner.md'), 'symlink should point to absolute ECC path');

    // Check state was updated
    assert.ok(plannerDst in state.symlinks, 'state.symlinks should contain planner dst');
    assert.equal(state.symlinks[plannerDst].eccSrc, 'agents/planner.md');
    assert.equal(state.symlinks[plannerDst].kind, 'agent');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// planApply: detects conflicts
// ---------------------------------------------------------------------------
test('planApply: detects conflicts when a real file already exists at dst', async () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    const inv = scanEcc(ecc);
    const config  = makeConfig();
    const desired = resolveDesired(config, BUNDLES, inv, { home: env.home });
    const state   = structuredClone(EMPTY_STATE);

    // Pre-create a file at the planner agent destination
    const plannerDst = join(env.home, '.claude', 'agents', 'planner.md');
    mkdirSync(join(env.home, '.claude', 'agents'), { recursive: true });
    writeFileSync(plannerDst, '# manually created\n', 'utf8');

    const plan = await planApply(desired, state, { ecc });

    assert.equal(plan.conflicts.length, 1, 'exactly one conflict should be detected');
    assert.equal(plan.conflicts[0].dst, plannerDst, 'conflict dst should be the planner path');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// planApply: removes stale items
// ---------------------------------------------------------------------------
test('planApply: stale state entry not in desired goes to toRemove', async () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    const inv = scanEcc(ecc);
    const config  = makeConfig();
    const desired = resolveDesired(config, BUNDLES, inv, { home: env.home });
    const state   = structuredClone(EMPTY_STATE);

    // Add a stale entry to state.symlinks that is not in desired
    const staleDst = join(env.home, '.claude', 'agents', 'old-agent.md');
    state.symlinks[staleDst] = {
      eccSrc: 'agents/old-agent.md',
      kind: 'agent',
      ownedBy: 'global',
      ephemeral: false,
    };

    const plan = await planApply(desired, state, { ecc });

    const staleEntry = plan.toRemove.find(e => e.dst === staleDst);
    assert.ok(staleEntry, 'stale entry should appear in toRemove');
    assert.equal(staleEntry.owned.eccSrc, 'agents/old-agent.md');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// executeApply: idempotent — second apply returns empty toAdd/toRemove
// ---------------------------------------------------------------------------
test('executeApply: idempotent — second apply leaves nothing to add or remove', async () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    const inv = scanEcc(ecc);
    const config  = makeConfig();
    const desired = resolveDesired(config, BUNDLES, inv, { home: env.home });
    const state   = structuredClone(EMPTY_STATE);

    // First apply
    const plan1 = await planApply(desired, state, { ecc });
    await executeApply(plan1, state, { ecc });

    // Second plan (same desired, state now updated)
    const plan2 = await planApply(desired, state, { ecc });

    assert.equal(plan2.toAdd.length, 0, 'nothing to add on second apply');
    assert.equal(plan2.toRemove.length, 0, 'nothing to remove on second apply');
    assert.equal(plan2.toKeep.length, desired.length, 'all items kept on second apply');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// executeApply: onProgress called once per symlink add/remove
// ---------------------------------------------------------------------------
test('executeApply: onProgress called for each symlink operation', async () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    const inv = scanEcc(ecc);
    const config  = makeConfig();
    const desired = resolveDesired(config, BUNDLES, inv, { home: env.home });
    const state   = structuredClone(EMPTY_STATE);

    const plan = await planApply(desired, state, { ecc });
    let progressCalls = 0;
    await executeApply(plan, state, { ecc, onProgress: () => { progressCalls++; } });

    assert.equal(progressCalls, plan.toAdd.length, 'onProgress should be called once per added symlink');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// planApply: skips fork entries
// ---------------------------------------------------------------------------
test('planApply: forked entry is not in toAdd and not in conflicts', async () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    const inv = scanEcc(ecc);
    const config  = makeConfig();
    const desired = resolveDesired(config, BUNDLES, inv, { home: env.home });
    const state   = structuredClone(EMPTY_STATE);

    // Mark the planner agent dst as forked
    const plannerDst = join(env.home, '.claude', 'agents', 'planner.md');
    state.forks[plannerDst] = {
      forkedAt: new Date().toISOString(),
      originalEccSrc: 'agents/planner.md',
    };

    // Also create the file at dst (simulating a real fork)
    mkdirSync(join(env.home, '.claude', 'agents'), { recursive: true });
    writeFileSync(plannerDst, '# forked content\n', 'utf8');

    const plan = await planApply(desired, state, { ecc });

    const plannerInToAdd = plan.toAdd.find(e => e.dst === plannerDst);
    assert.equal(plannerInToAdd, undefined, 'forked entry should not appear in toAdd');

    const plannerInConflicts = plan.conflicts.find(e => e.dst === plannerDst);
    assert.equal(plannerInConflicts, undefined, 'forked entry should not appear in conflicts');
  } finally {
    env.cleanup();
  }
});

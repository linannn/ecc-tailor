import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { makeTmpEnv } from './helpers/tmp-env.js';
import { makeFakeEcc } from './helpers/fake-ecc.js';
import { scanEcc } from '../src/fs-scan.js';
import { resolveDesired } from '../src/resolve.js';

// Inline bundle definitions used across tests (no dependency on bundles.json)
const BUNDLES = {
  global:      { agents: ['planner'], skills: ['coding-standards'] },
  'java-proj': { agents: [],          skills: ['coding-standards'] },
};

// Minimal config helper
function makeConfig({ globalOverrides = {}, projects = [] } = {}) {
  return {
    global: {
      bundles: ['global'],
      extras:  { agents: [], skills: [], rulesLanguages: [] },
      excludes: { agents: [], skills: [] },
      ...globalOverrides,
    },
    projects,
  };
}

// ---------------------------------------------------------------------------
// resolveDesired: global + one project
// ---------------------------------------------------------------------------
test('resolveDesired: global + one project — global gets 1 agent + 1 skill + 1 rule, project gets 1 skill', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const projPath = join(tmp.root, 'my-project');

    const config = makeConfig({
      globalOverrides: {
        extras: { agents: [], skills: [], rulesLanguages: ['common'] },
      },
      projects: [
        {
          path: projPath,
          bundles: ['java-proj'],
          extras:  { agents: [], skills: [] },
          excludes: { agents: [], skills: [] },
        },
      ],
    });

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home });

    // Global: 1 agent (planner)
    const plannerLink = links.find(
      l => l.dst === join(tmp.home, '.claude', 'agents', 'planner.md'),
    );
    assert.ok(plannerLink, 'global planner agent link should exist');
    assert.equal(plannerLink.eccSrc, 'agents/planner.md');
    assert.equal(plannerLink.kind, 'agent');
    assert.equal(plannerLink.ownedBy, 'global');

    // Global: 1 skill (coding-standards)
    const csLink = links.find(
      l => l.dst === join(tmp.home, '.claude', 'skills', 'coding-standards'),
    );
    assert.ok(csLink, 'global coding-standards skill link should exist');
    assert.equal(csLink.eccSrc, 'skills/coding-standards');
    assert.equal(csLink.kind, 'skill-dir');
    assert.equal(csLink.ownedBy, 'global');

    // Global: 1 rule (common)
    const ruleLink = links.find(
      l => l.dst === join(tmp.home, '.claude', 'rules', 'common'),
    );
    assert.ok(ruleLink, 'global common rule link should exist');
    assert.equal(ruleLink.eccSrc, 'rules/common');
    assert.equal(ruleLink.kind, 'rules-dir');
    assert.equal(ruleLink.ownedBy, 'global');

    // Project: 1 skill (coding-standards) under project path
    const projCsLink = links.find(
      l => l.dst === join(projPath, '.claude', 'skills', 'coding-standards'),
    );
    assert.ok(projCsLink, 'project coding-standards skill link should exist');
    assert.equal(projCsLink.ownedBy, `proj:${projPath}`);
    assert.equal(projCsLink.kind, 'skill-dir');
  } finally {
    tmp.cleanup();
  }
});

// ---------------------------------------------------------------------------
// resolveDesired: excludes filter
// ---------------------------------------------------------------------------
test('resolveDesired: excludes filter — exclude planner agent, verify not in output', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const config = makeConfig({
      globalOverrides: {
        excludes: { agents: ['planner'], skills: [] },
      },
    });

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home });

    const plannerLink = links.find(
      l => l.dst === join(tmp.home, '.claude', 'agents', 'planner.md'),
    );
    assert.equal(plannerLink, undefined, 'planner agent should be excluded');

    // coding-standards skill should still be present
    const csLink = links.find(
      l => l.dst === join(tmp.home, '.claude', 'skills', 'coding-standards'),
    );
    assert.ok(csLink, 'coding-standards skill should still be present after excluding planner');
  } finally {
    tmp.cleanup();
  }
});

// ---------------------------------------------------------------------------
// resolveDesired: throws on missing asset
// ---------------------------------------------------------------------------
test('resolveDesired: throws on missing asset — bundle references nonexistent-skill', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const badBundles = {
      global: { agents: ['planner'], skills: ['nonexistent-skill'] },
    };

    const config = makeConfig();

    assert.throws(
      () => resolveDesired(config, badBundles, inv, { home: tmp.home }),
      /not found in ECC/,
    );
  } finally {
    tmp.cleanup();
  }
});

// ---------------------------------------------------------------------------
// resolveDesired: extras add beyond bundle
// ---------------------------------------------------------------------------
test('resolveDesired: extras add beyond bundle — add agent-sort skill, verify present in output', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const config = makeConfig({
      globalOverrides: {
        extras: { agents: [], skills: ['agent-sort'], rulesLanguages: [] },
      },
    });

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home });

    const agentSortLink = links.find(
      l => l.dst === join(tmp.home, '.claude', 'skills', 'agent-sort'),
    );
    assert.ok(agentSortLink, 'agent-sort skill added via extras should be in output');
    assert.equal(agentSortLink.eccSrc, 'skills/agent-sort');
    assert.equal(agentSortLink.kind, 'skill-dir');
    assert.equal(agentSortLink.ownedBy, 'global');

    // Original coding-standards skill should also still be present
    const csLink = links.find(
      l => l.dst === join(tmp.home, '.claude', 'skills', 'coding-standards'),
    );
    assert.ok(csLink, 'coding-standards skill should still be present');
  } finally {
    tmp.cleanup();
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { makeTmpEnv } from './helpers/tmp-env.js';
import { makeFakeEcc } from './helpers/fake-ecc.js';
import { scanEcc } from '../src/core/fs-scan.js';
import { resolveDesired, resolveMcp } from '../src/core/resolve.js';

// Inline bundle definitions used across tests (no dependency on bundles.json)
const BUNDLES = {
  global:      { agents: ['planner'], skills: ['coding-standards'], mcp: ['context7'] },
  'java-proj': { agents: [],          skills: ['coding-standards'] },
  'research':  { agents: [],          skills: [], mcp: ['exa-web-search'] },
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

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });

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

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });

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
      () => resolveDesired(config, badBundles, inv, { home: tmp.home, eccRoot }),
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

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });

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

// ---------------------------------------------------------------------------
// resolveMcp: global bundle contributes MCP servers
// ---------------------------------------------------------------------------
test('resolveMcp: global bundle contributes MCP servers', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const config = makeConfig();
    const result = resolveMcp(config, BUNDLES, inv.mcpServers);

    assert.ok(result.some(s => s.name === 'context7'), 'context7 should be in result from global bundle');
    assert.ok(result.every(s => s.config !== undefined), 'every server should have config');
  } finally {
    tmp.cleanup();
  }
});

// ---------------------------------------------------------------------------
// resolveMcp: project bundle contributes MCP servers to global set
// ---------------------------------------------------------------------------
test('resolveMcp: project bundle contributes MCP servers to global set', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const config = makeConfig({
      projects: [
        {
          path: join(tmp.root, 'my-project'),
          bundles: ['research'],
          extras: { agents: [], skills: [], mcp: [] },
          excludes: { agents: [], skills: [], mcp: [] },
        },
      ],
    });

    const result = resolveMcp(config, BUNDLES, inv.mcpServers);

    assert.ok(result.some(s => s.name === 'context7'), 'context7 from global should be present');
    assert.ok(result.some(s => s.name === 'exa-web-search'), 'exa-web-search from project bundle should be present');
  } finally {
    tmp.cleanup();
  }
});

// ---------------------------------------------------------------------------
// resolveMcp: global extras.mcp adds servers
// ---------------------------------------------------------------------------
test('resolveMcp: global extras.mcp adds servers beyond bundles', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const config = makeConfig({
      globalOverrides: {
        extras: { agents: [], skills: [], rulesLanguages: [], mcp: ['memory'] },
      },
    });

    const result = resolveMcp(config, BUNDLES, inv.mcpServers);

    assert.ok(result.some(s => s.name === 'memory'), 'memory from extras should be present');
    assert.ok(result.some(s => s.name === 'context7'), 'context7 from bundle should still be present');
  } finally {
    tmp.cleanup();
  }
});

// ---------------------------------------------------------------------------
// resolveMcp: global excludes.mcp removes servers
// ---------------------------------------------------------------------------
test('resolveMcp: global excludes.mcp removes servers', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const config = makeConfig({
      globalOverrides: {
        excludes: { agents: [], skills: [], mcp: ['context7'] },
      },
    });

    const result = resolveMcp(config, BUNDLES, inv.mcpServers);

    assert.ok(!result.some(s => s.name === 'context7'), 'context7 should be excluded');
  } finally {
    tmp.cleanup();
  }
});

// ---------------------------------------------------------------------------
// resolveMcp: throws on unknown server name
// ---------------------------------------------------------------------------
test('resolveMcp: throws on unknown MCP server name', () => {
  const tmp = makeTmpEnv();
  try {
    const config = makeConfig({
      globalOverrides: {
        extras: { agents: [], skills: [], rulesLanguages: [], mcp: ['nonexistent-server'] },
      },
    });

    assert.throws(
      () => resolveMcp(config, BUNDLES, []),
      /not found in ECC catalog/,
    );
  } finally {
    tmp.cleanup();
  }
});

// ---------------------------------------------------------------------------
// resolveDesired: auto command dependency scanning
// ---------------------------------------------------------------------------
test('resolveDesired: auto-detects /docs command from planner agent', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const config = makeConfig();

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });

    const docsLink = links.find(
      l => l.dst === join(tmp.home, '.claude', 'commands', 'docs.md'),
    );
    assert.ok(docsLink, '/docs command should be auto-detected from planner agent');
    assert.equal(docsLink.autoDep, true);
    assert.ok(docsLink.requiredBy.includes('agent:planner'));
    assert.equal(docsLink.kind, 'command');
    assert.equal(docsLink.ownedBy, 'global');
  } finally {
    tmp.cleanup();
  }
});

test('resolveDesired: excludes.commands suppresses auto-detected command', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const config = makeConfig({
      globalOverrides: {
        excludes: { agents: [], skills: [], mcp: [], commands: ['docs'] },
      },
    });

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });

    const docsLink = links.find(
      l => l.eccSrc === 'commands/docs.md',
    );
    assert.equal(docsLink, undefined, '/docs should be excluded by excludes.commands');
  } finally {
    tmp.cleanup();
  }
});

test('resolveDesired: manual extras.commands not duplicated by auto-detection', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const config = makeConfig({
      globalOverrides: {
        extras: { agents: [], skills: [], rulesLanguages: [], commands: ['docs'] },
      },
    });

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });

    const docsLinks = links.filter(l => l.eccSrc === 'commands/docs.md');
    assert.equal(docsLinks.length, 1, '/docs should appear exactly once (manual wins)');
    assert.equal(docsLinks[0].autoDep, undefined, 'should be manual entry without autoDep');
  } finally {
    tmp.cleanup();
  }
});

test('resolveDesired: without eccRoot, no auto-detection occurs', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const config = makeConfig();

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home });

    const commandLinks = links.filter(l => l.kind === 'command');
    assert.equal(commandLinks.length, 0, 'no commands when eccRoot not provided');
  } finally {
    tmp.cleanup();
  }
});

// ---------------------------------------------------------------------------
// resolveDesired: bundleOverrides excludes skill from global bundle
// ---------------------------------------------------------------------------
test('resolveDesired: bundleOverrides excludes skill from global bundle', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const config = makeConfig();
    config.bundleOverrides = { global: { exclude: { skills: ['coding-standards'] } } };

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });

    const csLink = links.find(
      l => l.dst === join(tmp.home, '.claude', 'skills', 'coding-standards'),
    );
    assert.equal(csLink, undefined, 'coding-standards should be excluded by bundleOverrides');
  } finally {
    tmp.cleanup();
  }
});

// ---------------------------------------------------------------------------
// resolveDesired: bundleOverrides adds skill to global bundle
// ---------------------------------------------------------------------------
test('resolveDesired: bundleOverrides adds skill to global bundle', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const config = makeConfig();
    config.bundleOverrides = { global: { add: { skills: ['agent-sort'] } } };

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });

    const agentSortLink = links.find(
      l => l.dst === join(tmp.home, '.claude', 'skills', 'agent-sort'),
    );
    assert.ok(agentSortLink, 'agent-sort should be added by bundleOverrides');
    assert.equal(agentSortLink.kind, 'skill-dir');
    assert.equal(agentSortLink.ownedBy, 'global');
  } finally {
    tmp.cleanup();
  }
});

// ---------------------------------------------------------------------------
// resolveDesired: bundleOverrides excludes agent from global bundle
// ---------------------------------------------------------------------------
test('resolveDesired: bundleOverrides excludes agent from global bundle', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const config = makeConfig();
    config.bundleOverrides = { global: { exclude: { agents: ['planner'] } } };

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });

    const plannerLink = links.find(
      l => l.dst === join(tmp.home, '.claude', 'agents', 'planner.md'),
    );
    assert.equal(plannerLink, undefined, 'planner should be excluded by bundleOverrides');
  } finally {
    tmp.cleanup();
  }
});

// ---------------------------------------------------------------------------
// resolveMcp: bundleOverrides excludes MCP from bundle
// ---------------------------------------------------------------------------
test('resolveMcp: bundleOverrides excludes MCP from bundle', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const config = makeConfig();
    config.bundleOverrides = { global: { exclude: { mcp: ['context7'] } } };

    const result = resolveMcp(config, BUNDLES, inv.mcpServers);

    assert.ok(!result.some(s => s.name === 'context7'), 'context7 should be excluded by bundleOverrides');
  } finally {
    tmp.cleanup();
  }
});

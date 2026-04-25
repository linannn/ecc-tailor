import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProvenance } from '../src/provenance.js';

const BUNDLES = {
  global:     { agents: ['planner'], skills: ['coding-standards'], mcp: ['context7'] },
  research:   { agents: [], skills: [], mcp: ['exa-web-search'] },
  dev:        { agents: [], skills: [], mcp: ['context7', 'memory'] },
};

function makeConfig(overrides = {}) {
  return {
    global: {
      bundles: ['global'],
      extras: { agents: [], skills: [], commands: [], mcp: [] },
      excludes: { agents: [], skills: [], mcp: [], commands: [] },
      ...overrides.global,
    },
    projects: overrides.projects ?? [],
  };
}

test('buildProvenance: auto command shows auto=true and requiredBy sources', () => {
  const config = makeConfig();
  const desired = [
    {
      kind: 'command',
      eccSrc: 'commands/docs.md',
      autoDep: true,
      requiredBy: ['agent:planner'],
    },
  ];
  const mcp = [];

  const report = buildProvenance(config, BUNDLES, desired, mcp);

  assert.equal(report.commands.length, 1);
  const cmd = report.commands[0];
  assert.equal(cmd.name, 'docs');
  assert.equal(cmd.auto, true);
  assert.deepEqual(cmd.sources, ['agent:planner']);
});

test('buildProvenance: manual command shows auto=false with extras source', () => {
  const config = makeConfig();
  const desired = [
    {
      kind: 'command',
      eccSrc: 'commands/eval.md',
      autoDep: false,
      requiredBy: [],
    },
  ];
  const mcp = [];

  const report = buildProvenance(config, BUNDLES, desired, mcp);

  assert.equal(report.commands.length, 1);
  const cmd = report.commands[0];
  assert.equal(cmd.name, 'eval');
  assert.equal(cmd.auto, false);
  assert.deepEqual(cmd.sources, ['extras (manual)']);
});

test('buildProvenance: ecc-tailor command is excluded from report', () => {
  const config = makeConfig();
  const desired = [
    {
      kind: 'command',
      eccSrc: 'commands/ecc-tailor.md',
      autoDep: false,
      requiredBy: [],
    },
  ];
  const mcp = [];

  const report = buildProvenance(config, BUNDLES, desired, mcp);

  assert.equal(report.commands.length, 0, 'ecc-tailor command should be excluded');
});

test('buildProvenance: MCP from global bundle shows correct source', () => {
  const config = makeConfig();
  const desired = [];
  const mcp = [{ name: 'context7', config: {} }];

  const report = buildProvenance(config, BUNDLES, desired, mcp);

  assert.equal(report.mcp.length, 1);
  assert.equal(report.mcp[0].name, 'context7');
  assert.ok(report.mcp[0].sources.includes('bundle:global'));
});

test('buildProvenance: MCP from project bundle shows correct source', () => {
  const config = makeConfig({
    projects: [{ path: '/some/proj', bundles: ['research'] }],
  });
  const desired = [];
  const mcp = [{ name: 'exa-web-search', config: {} }];

  const report = buildProvenance(config, BUNDLES, desired, mcp);

  const entry = report.mcp.find(m => m.name === 'exa-web-search');
  assert.ok(entry, 'exa-web-search should appear in mcp provenance');
  assert.ok(entry.sources.includes('bundle:research'));
});

test('buildProvenance: MCP from extras shows extras source', () => {
  const config = makeConfig({
    global: {
      bundles: [],
      extras: { agents: [], skills: [], commands: [], mcp: ['memory'] },
      excludes: { agents: [], skills: [], mcp: [], commands: [] },
    },
  });
  const desired = [];
  const mcp = [{ name: 'memory', config: {} }];

  const report = buildProvenance(config, BUNDLES, desired, mcp);

  const entry = report.mcp.find(m => m.name === 'memory');
  assert.ok(entry, 'memory should appear');
  assert.ok(entry.sources.includes('extras (manual)'));
});

test('buildProvenance: deduplicates MCP sources', () => {
  const config = makeConfig({
    global: {
      bundles: ['dev'],
      extras: { agents: [], skills: [], commands: [], mcp: ['context7'] },
      excludes: { agents: [], skills: [], mcp: [], commands: [] },
    },
  });
  const desired = [];
  const mcp = [{ name: 'context7', config: {} }];

  const report = buildProvenance(config, BUNDLES, desired, mcp);

  const entry = report.mcp.find(m => m.name === 'context7');
  assert.ok(entry);
  const bundleCount = entry.sources.filter(s => s === 'bundle:dev').length;
  assert.equal(bundleCount, 1, 'bundle:dev should not appear twice even if context7 is in bundle and extras');
});

test('buildProvenance: non-command entries are ignored', () => {
  const config = makeConfig();
  const desired = [
    { kind: 'agent', eccSrc: 'agents/planner.md' },
    { kind: 'skill-dir', eccSrc: 'skills/coding-standards' },
  ];
  const mcp = [];

  const report = buildProvenance(config, BUNDLES, desired, mcp);

  assert.equal(report.commands.length, 0);
  assert.equal(report.mcp.length, 0);
});

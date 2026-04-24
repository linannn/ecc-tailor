import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUpgradePlan } from '../src/upgrade.js';

// ---------------------------------------------------------------------------
// buildUpgradePlan: filters out ignored items
// ---------------------------------------------------------------------------
test('buildUpgradePlan: filters ignored skills and agents', () => {
  const newItems = [
    { kind: 'skill', name: 'typescript', description: 'TS skill' },
    { kind: 'skill', name: 'python',     description: 'Py skill' },
    { kind: 'agent', name: 'researcher', description: 'Research agent' },
    { kind: 'agent', name: 'coder',      description: 'Coding agent' },
  ];

  const ignored = {
    skills: ['python'],
    agents: ['researcher'],
  };

  const plan = buildUpgradePlan(newItems, ignored);

  assert.equal(plan.length, 2);
  assert.equal(plan[0].name, 'typescript');
  assert.equal(plan[1].name, 'coder');
});

// ---------------------------------------------------------------------------
// buildUpgradePlan: empty when everything is ignored
// ---------------------------------------------------------------------------
test('buildUpgradePlan: empty when all items are ignored', () => {
  const newItems = [
    { kind: 'skill', name: 'typescript', description: 'TS skill' },
    { kind: 'agent', name: 'coder',      description: 'Coding agent' },
  ];

  const ignored = {
    skills: ['typescript'],
    agents: ['coder'],
  };

  const plan = buildUpgradePlan(newItems, ignored);
  assert.equal(plan.length, 0);
});

// ---------------------------------------------------------------------------
// buildUpgradePlan: returns all items when ignored is empty
// ---------------------------------------------------------------------------
test('buildUpgradePlan: returns all items when nothing is ignored', () => {
  const newItems = [
    { kind: 'skill', name: 'go',   description: 'Go skill' },
    { kind: 'agent', name: 'planner', description: 'Planner' },
  ];

  const ignored = { skills: [], agents: [] };

  const plan = buildUpgradePlan(newItems, ignored);
  assert.deepEqual(plan, newItems);
});

// ---------------------------------------------------------------------------
// buildUpgradePlan: empty when nothing new
// ---------------------------------------------------------------------------
test('buildUpgradePlan: empty when newItems is empty', () => {
  const plan = buildUpgradePlan([], { skills: ['x'], agents: ['y'] });
  assert.equal(plan.length, 0);
});

// ---------------------------------------------------------------------------
// buildUpgradePlan: handles missing ignored sub-keys gracefully
// ---------------------------------------------------------------------------
test('buildUpgradePlan: tolerates missing ignored.skills / ignored.agents', () => {
  const newItems = [
    { kind: 'skill', name: 'rust', description: '' },
  ];

  // ignored with no sub-keys
  const plan = buildUpgradePlan(newItems, {});
  assert.equal(plan.length, 1);
  assert.equal(plan[0].name, 'rust');
});

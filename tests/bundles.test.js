import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBundles, resolveBundle, resolveBundles } from '../src/bundles.js';

// ---------------------------------------------------------------------------
// loadBundles: reads JSON file
// ---------------------------------------------------------------------------
test('loadBundles: reads JSON and contains expected bundles', () => {
  const bundles = loadBundles();
  assert.ok('global' in bundles, 'global bundle should exist');
  assert.ok('java-proj' in bundles, 'java-proj bundle should exist');
});

// ---------------------------------------------------------------------------
// resolveBundle: flat bundle (no extends)
// ---------------------------------------------------------------------------
test('resolveBundle: flat bundle resolves correctly', () => {
  const bundles = loadBundles();
  const result = resolveBundle(bundles, 'java-proj');
  assert.ok(result.agents.includes('java-reviewer'), 'should include java-reviewer');
  assert.ok(result.agents.includes('java-build-resolver'), 'should include java-build-resolver');
  assert.ok(result.skills.includes('springboot-patterns'), 'should include springboot-patterns');
  assert.ok(result.skills.includes('java-coding-standards'), 'should include java-coding-standards');
});

// ---------------------------------------------------------------------------
// resolveBundle: extends merges parent fields
// ---------------------------------------------------------------------------
test('resolveBundle: extends merges parent agents and skills', () => {
  const bundles = loadBundles();
  const result = resolveBundle(bundles, 'ts-nestjs-proj');
  // Parent (ts-backend-proj) agent should be present
  assert.ok(result.agents.includes('typescript-reviewer'), 'should include parent agent');
  // Both parent and child skills should be present
  assert.ok(result.skills.includes('backend-patterns'), 'should include parent skill');
  assert.ok(result.skills.includes('nestjs-patterns'), 'should include child skill');
});

// ---------------------------------------------------------------------------
// resolveBundles: unions multiple bundles with dedup
// ---------------------------------------------------------------------------
test('resolveBundles: unions multiple bundles without duplicates', () => {
  const bundles = loadBundles();
  const result = resolveBundles(bundles, ['ts-backend-proj', 'java-proj']);
  assert.ok(result.agents.includes('typescript-reviewer'), 'should include ts agent');
  assert.ok(result.agents.includes('java-reviewer'), 'should include java agent');
  // No duplicates in agents
  const agentSet = new Set(result.agents);
  assert.equal(agentSet.size, result.agents.length, 'agents should have no duplicates');
  // No duplicates in skills
  const skillSet = new Set(result.skills);
  assert.equal(skillSet.size, result.skills.length, 'skills should have no duplicates');
});

// ---------------------------------------------------------------------------
// resolveBundle: throws on unknown bundle name
// ---------------------------------------------------------------------------
test('resolveBundle: throws on unknown bundle name', () => {
  const bundles = loadBundles();
  assert.throws(
    () => resolveBundle(bundles, 'nonexistent'),
    /unknown bundle/i,
  );
});

// ---------------------------------------------------------------------------
// resolveBundle: ephemeral flag preserved
// ---------------------------------------------------------------------------
test('resolveBundle: ephemeral flag is true for scan bundle', () => {
  const bundles = loadBundles();
  const result = resolveBundle(bundles, 'scan');
  assert.equal(result.ephemeral, true);
});

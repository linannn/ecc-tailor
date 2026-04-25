import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBundles, resolveBundle, resolveBundles, applyBundleOverride } from '../src/core/bundles.js';

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

// ---------------------------------------------------------------------------
// applyBundleOverride: no-op when override is absent
// ---------------------------------------------------------------------------
test('applyBundleOverride: returns unchanged when no override', () => {
  const resolved = { agents: ['planner'], skills: ['coding-standards'], mcp: ['context7'], ephemeral: false, description: '' };

  assert.deepEqual(applyBundleOverride(resolved, undefined), resolved);
  assert.deepEqual(applyBundleOverride(resolved, null), resolved);
});

// ---------------------------------------------------------------------------
// applyBundleOverride: exclude removes agents and skills
// ---------------------------------------------------------------------------
test('applyBundleOverride: excludes agents and skills', () => {
  const resolved = { agents: ['planner', 'architect'], skills: ['coding-standards', 'tdd-workflow'], mcp: [], ephemeral: false, description: '' };

  const result = applyBundleOverride(resolved, {
    exclude: { agents: ['planner'], skills: ['tdd-workflow'] },
  });

  assert.ok(!result.agents.includes('planner'), 'planner should be excluded');
  assert.ok(result.agents.includes('architect'), 'architect should remain');
  assert.ok(!result.skills.includes('tdd-workflow'), 'tdd-workflow should be excluded');
  assert.ok(result.skills.includes('coding-standards'), 'coding-standards should remain');
});

// ---------------------------------------------------------------------------
// applyBundleOverride: add appends agents and skills
// ---------------------------------------------------------------------------
test('applyBundleOverride: adds agents and skills', () => {
  const resolved = { agents: ['planner'], skills: ['coding-standards'], mcp: [], ephemeral: false, description: '' };

  const result = applyBundleOverride(resolved, {
    add: { agents: ['architect'], skills: ['tdd-workflow'] },
  });

  assert.ok(result.agents.includes('planner'), 'original planner should remain');
  assert.ok(result.agents.includes('architect'), 'architect should be added');
  assert.ok(result.skills.includes('coding-standards'), 'original coding-standards should remain');
  assert.ok(result.skills.includes('tdd-workflow'), 'tdd-workflow should be added');
});

// ---------------------------------------------------------------------------
// applyBundleOverride: exclude + add applied together (exclude first, then add)
// ---------------------------------------------------------------------------
test('applyBundleOverride: exclude + add combined', () => {
  const resolved = { agents: ['planner', 'architect'], skills: ['coding-standards'], mcp: [], ephemeral: false, description: '' };

  const result = applyBundleOverride(resolved, {
    exclude: { agents: ['planner'] },
    add: { agents: ['code-reviewer'], skills: ['tdd-workflow'] },
  });

  assert.ok(!result.agents.includes('planner'), 'planner should be excluded');
  assert.ok(result.agents.includes('architect'), 'architect should remain');
  assert.ok(result.agents.includes('code-reviewer'), 'code-reviewer should be added');
  assert.ok(result.skills.includes('coding-standards'), 'original coding-standards should remain');
  assert.ok(result.skills.includes('tdd-workflow'), 'tdd-workflow should be added');
});

// ---------------------------------------------------------------------------
// applyBundleOverride: MCP exclude and add
// ---------------------------------------------------------------------------
test('applyBundleOverride: handles MCP overrides', () => {
  const resolved = { agents: [], skills: [], mcp: ['context7', 'memory'], ephemeral: false, description: '' };

  const result = applyBundleOverride(resolved, {
    exclude: { mcp: ['context7'] },
    add: { mcp: ['exa-web-search'] },
  });

  assert.ok(!result.mcp.includes('context7'), 'context7 should be excluded');
  assert.ok(result.mcp.includes('memory'), 'memory should remain');
  assert.ok(result.mcp.includes('exa-web-search'), 'exa-web-search should be added');
});

// ---------------------------------------------------------------------------
// resolveBundle: includes rules field
// ---------------------------------------------------------------------------
test('resolveBundle: includes rules field', () => {
  const bundles = loadBundles();
  const result = resolveBundle(bundles, 'java-proj');
  assert.ok(Array.isArray(result.rules), 'rules should be an array');
  assert.ok(result.rules.includes('java'), 'should include java rule');
});

// ---------------------------------------------------------------------------
// resolveBundles: unions rules from multiple bundles
// ---------------------------------------------------------------------------
test('resolveBundles: unions rules from multiple bundles', () => {
  const bundles = loadBundles();
  const result = resolveBundles(bundles, ['java-proj', 'ts-backend-proj']);
  assert.ok(result.rules.includes('java'), 'should include java rule');
  assert.ok(result.rules.includes('typescript'), 'should include typescript rule');
  const ruleSet = new Set(result.rules);
  assert.equal(ruleSet.size, result.rules.length, 'rules should have no duplicates');
});

// ---------------------------------------------------------------------------
// resolveBundle: extends inherits parent rules
// ---------------------------------------------------------------------------
test('resolveBundle: extends inherits parent rules', () => {
  const bundles = loadBundles();
  const result = resolveBundle(bundles, 'ts-nestjs-proj');
  assert.ok(result.rules.includes('typescript'), 'should inherit typescript rule from ts-backend-proj parent');
});

// ---------------------------------------------------------------------------
// applyBundleOverride: handles rules overrides
// ---------------------------------------------------------------------------
test('applyBundleOverride: handles rules overrides', () => {
  const resolved = { agents: [], skills: [], mcp: [], rules: ['java', 'kotlin'], ephemeral: false, description: '' };

  const result = applyBundleOverride(resolved, {
    exclude: { rules: ['kotlin'] },
    add: { rules: ['python'] },
  });

  assert.ok(!result.rules.includes('kotlin'), 'kotlin should be excluded');
  assert.ok(result.rules.includes('java'), 'java should remain');
  assert.ok(result.rules.includes('python'), 'python should be added');
});

// ---------------------------------------------------------------------------
// resolveBundles: per-bundle override is applied
// ---------------------------------------------------------------------------
test('resolveBundles: applies per-bundle overrides', () => {
  const bundles = loadBundles();
  const overrides = {
    'java-proj': { exclude: { skills: ['springboot-patterns'] } },
  };

  const result = resolveBundles(bundles, ['java-proj'], overrides);

  assert.ok(!result.skills.includes('springboot-patterns'), 'springboot-patterns should be excluded by override');
  assert.ok(result.skills.includes('java-coding-standards'), 'java-coding-standards should still be present');
});

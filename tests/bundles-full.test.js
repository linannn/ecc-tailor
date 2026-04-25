import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadBundles, resolveBundle, resolveBundles } from '../src/core/bundles.js';

const ECC = process.env.ECC_PATH;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Collect all agent names from ECC agents/*.md
 * @param {string} eccRoot
 * @returns {Set<string>}
 */
function eccAgentNames(eccRoot) {
  const agentsDir = join(eccRoot, 'agents');
  if (!existsSync(agentsDir)) return new Set();
  return new Set(
    readdirSync(agentsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.slice(0, -3)),
  );
}

/**
 * Collect all skill names from ECC skills/ subdirectories.
 * @param {string} eccRoot
 * @returns {Set<string>}
 */
function eccSkillNames(eccRoot) {
  const skillsDir = join(eccRoot, 'skills');
  if (!existsSync(skillsDir)) return new Set();
  return new Set(
    readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name),
  );
}

/**
 * Collect every agent name referenced across all bundles (raw, no extends resolution).
 * @param {object} bundles
 * @returns {string[]}
 */
function allReferencedAgents(bundles) {
  const names = new Set();
  for (const def of Object.values(bundles)) {
    for (const a of def.agents ?? []) names.add(a);
  }
  return [...names];
}

/**
 * Collect every skill name referenced across all bundles (raw, no extends resolution).
 * @param {object} bundles
 * @returns {string[]}
 */
function allReferencedSkills(bundles) {
  const names = new Set();
  for (const def of Object.values(bundles)) {
    for (const s of def.skills ?? []) names.add(s);
  }
  return [...names];
}

// ---------------------------------------------------------------------------
// Integration tests — only run when ECC_PATH is set
// ---------------------------------------------------------------------------

test('all referenced agents exist in ECC', { skip: !ECC && 'ECC_PATH not set' }, () => {
  const bundles = loadBundles();
  const agentNames = eccAgentNames(ECC);
  const referenced = allReferencedAgents(bundles);

  const missing = referenced.filter(a => !agentNames.has(a));
  assert.deepEqual(
    missing,
    [],
    `Missing agents in ECC: ${missing.join(', ')}`,
  );
});

test('all referenced skills exist in ECC', { skip: !ECC && 'ECC_PATH not set' }, () => {
  const bundles = loadBundles();
  const skillNames = eccSkillNames(ECC);
  const referenced = allReferencedSkills(bundles);

  const missing = referenced.filter(s => !skillNames.has(s));
  assert.deepEqual(
    missing,
    [],
    `Missing skills in ECC: ${missing.join(', ')}`,
  );
});

// ---------------------------------------------------------------------------
// Unit tests — no ECC needed
// ---------------------------------------------------------------------------

test('extends chains resolve without error', () => {
  const bundles = loadBundles();
  const bundleNames = Object.keys(bundles);

  // Resolve every bundle — any cycle or missing parent throws
  for (const name of bundleNames) {
    assert.doesNotThrow(
      () => resolveBundle(bundles, name),
      `resolveBundle threw for bundle "${name}"`,
    );
  }
});

test('ts-nestjs-proj inherits ts-backend-proj', () => {
  const bundles = loadBundles();
  const result = resolveBundle(bundles, 'ts-nestjs-proj');
  const parent = resolveBundle(bundles, 'ts-backend-proj');

  // Every agent from the parent must appear in the child
  for (const agent of parent.agents) {
    assert.ok(
      result.agents.includes(agent),
      `ts-nestjs-proj should inherit agent "${agent}" from ts-backend-proj`,
    );
  }

  // Every skill from the parent must appear in the child
  for (const skill of parent.skills) {
    assert.ok(
      result.skills.includes(skill),
      `ts-nestjs-proj should inherit skill "${skill}" from ts-backend-proj`,
    );
  }

  // Child's own skill must also be present
  assert.ok(
    result.skills.includes('nestjs-patterns'),
    'ts-nestjs-proj should have its own nestjs-patterns skill',
  );
});

test('py-django-proj inherits py-proj', () => {
  const bundles = loadBundles();
  const result = resolveBundle(bundles, 'py-django-proj');
  const parent = resolveBundle(bundles, 'py-proj');

  for (const agent of parent.agents) {
    assert.ok(result.agents.includes(agent), `should inherit agent "${agent}"`);
  }
  for (const skill of parent.skills) {
    assert.ok(result.skills.includes(skill), `should inherit skill "${skill}"`);
  }
  assert.ok(result.skills.includes('django-patterns'), 'should have django-patterns');
  assert.ok(result.skills.includes('django-tdd'), 'should have django-tdd');
  assert.ok(result.skills.includes('django-verification'), 'should have django-verification');
});

test('resolveBundles: union of core + scan has no duplicates', () => {
  const bundles = loadBundles();
  const result = resolveBundles(bundles, ['core', 'scan']);

  const agentSet = new Set(result.agents);
  assert.equal(agentSet.size, result.agents.length, 'agents should have no duplicates');

  const skillSet = new Set(result.skills);
  assert.equal(skillSet.size, result.skills.length, 'skills should have no duplicates');
});

test('scan bundle is ephemeral', () => {
  const bundles = loadBundles();
  const result = resolveBundle(bundles, 'scan');
  assert.equal(result.ephemeral, true);
});

test('core bundle has 15 agents and 9 skills', () => {
  const bundles = loadBundles();
  assert.equal(bundles.core.agents.length, 15);
  assert.equal(bundles.core.skills.length, 9);
});

test('all 33 bundles are present', () => {
  const bundles = loadBundles();
  const expected = [
    'core', 'java-proj', 'py-proj', 'py-django-proj', 'py-ml-proj',
    'ts-backend-proj', 'ts-frontend-proj', 'ts-nestjs-proj', 'nuxt-proj',
    'go-proj', 'rust-proj', 'kotlin-proj', 'cpp-proj', 'csharp-proj',
    'swift-proj', 'dart-flutter-proj', 'laravel-proj', 'perl-proj',
    'ai-app-dev', 'security', 'database', 'devops',
    'healthcare', 'opensource', 'a11y', 'seo', 'gan-harness',
    'agent-dev', 'research', 'content', 'ops', 'crypto', 'scan',
  ];
  for (const name of expected) {
    assert.ok(name in bundles, `bundle "${name}" should exist`);
  }
  assert.equal(Object.keys(bundles).length, expected.length, `should have exactly ${expected.length} bundles`);
});

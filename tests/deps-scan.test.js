import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { makeTmpEnv } from './helpers/tmp-env.js';
import { makeFakeEcc } from './helpers/fake-ecc.js';
import { scanCommandDeps } from '../src/core/deps-scan.js';

test('scanCommandDeps: finds /docs in planner agent', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const knownCommands = new Set(['docs', 'update-docs', 'eval', 'update-codemaps']);

    const deps = scanCommandDeps(['planner'], [], eccRoot, knownCommands);

    assert.ok(deps.has('docs'), 'should detect /docs reference in planner');
    const sources = deps.get('docs');
    assert.ok(sources.has('agent:planner'), 'source should be agent:planner');
  } finally {
    tmp.cleanup();
  }
});

test('scanCommandDeps: finds /update-docs and /update-codemaps in doc-updater agent', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const knownCommands = new Set(['docs', 'update-docs', 'eval', 'update-codemaps']);

    const deps = scanCommandDeps(['doc-updater'], [], eccRoot, knownCommands);

    assert.ok(deps.has('update-docs'), 'should detect /update-docs reference');
    assert.ok(deps.has('update-codemaps'), 'should detect /update-codemaps reference');
    assert.ok(deps.get('update-docs').has('agent:doc-updater'));
    assert.ok(deps.get('update-codemaps').has('agent:doc-updater'));
  } finally {
    tmp.cleanup();
  }
});

test('scanCommandDeps: ignores unknown commands not in knownCommands', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const knownCommands = new Set(['eval']);

    const deps = scanCommandDeps(['planner', 'doc-updater'], [], eccRoot, knownCommands);

    assert.ok(!deps.has('docs'), '/docs should be ignored — not in knownCommands');
    assert.ok(!deps.has('update-docs'), '/update-docs should be ignored — not in knownCommands');
    assert.ok(!deps.has('update-codemaps'), '/update-codemaps should be ignored');
  } finally {
    tmp.cleanup();
  }
});

test('scanCommandDeps: tracks multiple sources for same command', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const knownCommands = new Set(['docs', 'update-docs', 'eval', 'update-codemaps']);

    const deps = scanCommandDeps(['planner', 'doc-updater'], [], eccRoot, knownCommands);

    assert.ok(deps.has('docs'), '/docs should be detected');
    assert.ok(deps.has('update-docs'), '/update-docs should be detected');
    const docsSources = deps.get('docs');
    assert.equal(docsSources.size, 1, '/docs referenced only by planner');
  } finally {
    tmp.cleanup();
  }
});

test('scanCommandDeps: empty result when no agents or skills selected', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const knownCommands = new Set(['docs', 'update-docs']);

    const deps = scanCommandDeps([], [], eccRoot, knownCommands);

    assert.equal(deps.size, 0, 'no deps when nothing selected');
  } finally {
    tmp.cleanup();
  }
});

test('scanCommandDeps: gracefully handles missing agent file', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const knownCommands = new Set(['docs']);

    assert.doesNotThrow(() => {
      scanCommandDeps(['nonexistent-agent'], [], eccRoot, knownCommands);
    });
  } finally {
    tmp.cleanup();
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

import { makeTmpEnv }  from './helpers/tmp-env.js';
import { makeFakeEcc } from './helpers/fake-ecc.js';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'ecc-tailor');

function runCli(args, env) {
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function writeConfig(xdgConfig, eccPath, overrides) {
  const configDir = join(xdgConfig, 'ecc-tailor');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(
    join(configDir, 'config.json'),
    JSON.stringify({
      eccPath,
      global: {
        bundles: ['core'],
        extras: { agents: [], skills: [], rulesLanguages: [] },
      },
      projects: [],
      hooks: { install: false },
      ...overrides,
    }),
    'utf8',
  );
}

function readConfig(xdgConfig) {
  return JSON.parse(
    readFileSync(join(xdgConfig, 'ecc-tailor', 'config.json'), 'utf8'),
  );
}

function setup() {
  const env = makeTmpEnv();
  const eccRoot = makeFakeEcc(join(env.root, 'fake-ecc'));
  const envVars = env.env();
  writeConfig(env.xdgConfig, eccRoot);
  return { env, envVars, eccRoot, readCfg: () => readConfig(env.xdgConfig) };
}

// ---------------------------------------------------------------------------
// show: displays bundle info without error
// ---------------------------------------------------------------------------
test('customize show: displays bundle info', () => {
  const { env, envVars } = setup();
  try {
    const result = runCli(['customize', 'core'], envVars);
    assert.equal(result.status, 0, `exit 0, got ${result.status}: ${result.stderr}`);
    assert.ok(result.stdout.includes('core'), 'output should mention bundle name');
    assert.ok(result.stdout.includes('Resolved'), 'output should show resolved section');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// show: unknown bundle exits with code 2
// ---------------------------------------------------------------------------
test('customize show: unknown bundle exits 2', () => {
  const { env, envVars } = setup();
  try {
    const result = runCli(['customize', 'nonexistent-bundle'], envVars);
    assert.equal(result.status, 2, `expected exit 2, got ${result.status}`);
    assert.ok(result.stderr.includes('Unknown bundle'), 'should print unknown bundle error');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// no args: prints usage and exits 2
// ---------------------------------------------------------------------------
test('customize: no args prints usage and exits 2', () => {
  const { env, envVars } = setup();
  try {
    const result = runCli(['customize'], envVars);
    assert.equal(result.status, 2, `expected exit 2, got ${result.status}`);
    assert.ok(result.stderr.includes('Missing bundle name'), 'should mention missing bundle name');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// exclude: adds to bundleOverrides.exclude
// ---------------------------------------------------------------------------
test('customize exclude: writes exclusion to config', () => {
  const { env, envVars, readCfg } = setup();
  try {
    const result = runCli(['customize', 'core', 'exclude', 'skills', 'coding-standards'], envVars);
    assert.equal(result.status, 0, `exit 0, got ${result.status}: ${result.stderr}`);

    const cfg = readCfg();
    assert.ok(
      cfg.bundleOverrides?.core?.exclude?.skills?.includes('coding-standards'),
      'config should contain the exclusion',
    );
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// add: adds to bundleOverrides.add
// ---------------------------------------------------------------------------
test('customize add: writes addition to config', () => {
  const { env, envVars, readCfg } = setup();
  try {
    const result = runCli(['customize', 'core', 'add', 'skills', 'api-design'], envVars);
    assert.equal(result.status, 0, `exit 0, got ${result.status}: ${result.stderr}`);

    const cfg = readCfg();
    assert.ok(
      cfg.bundleOverrides?.core?.add?.skills?.includes('api-design'),
      'config should contain the addition',
    );
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// add: is idempotent — duplicate adds don't create duplicates
// ---------------------------------------------------------------------------
test('customize add: idempotent — no duplicates on repeated add', () => {
  const { env, envVars, readCfg } = setup();
  try {
    runCli(['customize', 'core', 'add', 'skills', 'api-design'], envVars);
    runCli(['customize', 'core', 'add', 'skills', 'api-design'], envVars);

    const cfg = readCfg();
    const added = cfg.bundleOverrides.core.add.skills.filter(s => s === 'api-design');
    assert.equal(added.length, 1, 'should not duplicate on repeated add');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// reset: clears bundleOverrides for a bundle
// ---------------------------------------------------------------------------
test('customize reset: removes override from config', () => {
  const { env, envVars, readCfg } = setup();
  try {
    runCli(['customize', 'core', 'exclude', 'skills', 'coding-standards'], envVars);
    let cfg = readCfg();
    assert.ok(cfg.bundleOverrides?.core, 'override should exist before reset');

    const result = runCli(['customize', 'core', 'reset'], envVars);
    assert.equal(result.status, 0, `exit 0, got ${result.status}: ${result.stderr}`);

    cfg = readCfg();
    assert.equal(cfg.bundleOverrides?.core, undefined, 'override should be removed after reset');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// reset: no-op when no override exists
// ---------------------------------------------------------------------------
test('customize reset: no-op when no override exists', () => {
  const { env, envVars } = setup();
  try {
    const result = runCli(['customize', 'core', 'reset'], envVars);
    assert.equal(result.status, 0, `exit 0, got ${result.status}: ${result.stderr}`);
    assert.ok(result.stdout.includes('nothing to reset'), 'should indicate nothing to reset');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// invalid type: exits 2
// ---------------------------------------------------------------------------
test('customize add: invalid type exits 2', () => {
  const { env, envVars } = setup();
  try {
    const result = runCli(['customize', 'core', 'add', 'bananas', 'something'], envVars);
    assert.equal(result.status, 2, `expected exit 2, got ${result.status}`);
    assert.ok(result.stderr.includes('Invalid type'), 'should mention invalid type');
  } finally {
    env.cleanup();
  }
});

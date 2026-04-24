import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

import { makeTmpEnv }  from './helpers/tmp-env.js';
import { makeFakeEcc } from './helpers/fake-ecc.js';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'ecc-tailor');

/**
 * Spawn the CLI binary with the given args and env overrides.
 */
function runCli(args, env) {
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

/**
 * Write a config that puts coding-standards in global.extras.skills.
 */
function writeConfig(xdgConfig, eccPath) {
  const configDir = join(xdgConfig, 'ecc-tailor');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(
    join(configDir, 'config.json'),
    JSON.stringify({
      eccPath,
      global: {
        bundles: [],
        extras: { agents: [], skills: ['coding-standards'], rulesLanguages: [] },
      },
      projects: [],
      hooks: { install: false },
    }),
    'utf8',
  );
}

// ---------------------------------------------------------------------------
// Test 1: inventory --type skill shows [✓] for selected skill (coding-standards)
// ---------------------------------------------------------------------------
test('inventory --type skill: shows selected marker for coding-standards', () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    writeConfig(env.xdgConfig, ecc);

    const result = runCli(['inventory', '--type', 'skill'], env.env());

    assert.equal(result.status, 0, `CLI exited with ${result.status}: ${result.stderr}`);

    const combined = result.stdout + result.stderr;
    // Should list coding-standards with a selected marker
    assert.match(combined, /coding-standards/, 'output should list coding-standards');
    assert.match(combined, /\[✓\]/, 'output should show [✓] for selected skill');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: inventory --type skill --state unselected: does NOT show coding-standards
// ---------------------------------------------------------------------------
test('inventory --type skill --state unselected: does not show coding-standards', () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    writeConfig(env.xdgConfig, ecc);

    const result = runCli(['inventory', '--type', 'skill', '--state', 'unselected'], env.env());

    assert.equal(result.status, 0, `CLI exited with ${result.status}: ${result.stderr}`);

    const combined = result.stdout + result.stderr;
    // coding-standards is selected, so it should NOT appear in unselected output
    assert.doesNotMatch(
      combined,
      /coding-standards/,
      'selected skill should not appear in --state unselected output',
    );
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: inventory --detail coding-standards: prints SKILL.md content
// ---------------------------------------------------------------------------
test('inventory --detail coding-standards: prints SKILL.md content', () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    writeConfig(env.xdgConfig, ecc);

    const result = runCli(['inventory', '--detail', 'coding-standards'], env.env());

    assert.equal(result.status, 0, `CLI exited with ${result.status}: ${result.stderr}`);

    const combined = result.stdout + result.stderr;
    assert.match(combined, /fake coding standards/, 'output should contain SKILL.md content');
  } finally {
    env.cleanup();
  }
});

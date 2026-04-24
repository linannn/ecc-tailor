import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync, readlinkSync } from 'node:fs';

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
 * Write a minimal config.json that uses the fake ECC path and only references
 * assets that exist in makeFakeEcc() (planner agent + coding-standards skill).
 */
async function installMinimalConfig(env, ecc) {
  await mkdir(join(env.xdgConfig, 'ecc-tailor'), { recursive: true });
  await writeFile(
    join(env.xdgConfig, 'ecc-tailor', 'config.json'),
    JSON.stringify({
      eccPath: ecc,
      global: {
        bundles: [],
        extras: { agents: ['planner'], skills: ['coding-standards'], rulesLanguages: [] },
      },
      projects: [],
      hooks: { install: false },
    }),
  );
}

// ---------------------------------------------------------------------------
// Test 1: apply --dry-run prints plan but does NOT create symlinks
// ---------------------------------------------------------------------------
test('apply --dry-run: prints plan summary, does not create symlinks', async () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    await installMinimalConfig(env, ecc);

    const result = runCli(['apply', '--dry-run'], env.env());

    assert.equal(result.status, 0, `CLI exited with ${result.status}: ${result.stderr}`);
    assert.match(result.stdout + result.stderr, /to add/i, 'output should mention "to add"');

    // Symlink should NOT have been created
    const plannerDst = join(env.home, '.claude', 'agents', 'planner.md');
    assert.ok(!existsSync(plannerDst), 'planner.md symlink must not exist after --dry-run');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: apply creates symlinks and persists state
// ---------------------------------------------------------------------------
test('apply: creates symlinks and persists state with eccRef', async () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    await installMinimalConfig(env, ecc);

    const result = runCli(['apply'], env.env());

    assert.equal(result.status, 0, `CLI exited with ${result.status}: ${result.stderr}`);

    // Symlink should exist and point into the fake ECC
    const plannerDst = join(env.home, '.claude', 'agents', 'planner.md');
    assert.ok(existsSync(plannerDst), 'planner.md symlink should exist after apply');
    const target = readlinkSync(plannerDst);
    assert.equal(target, join(ecc, 'agents/planner.md'), 'symlink should point to ECC source');

    // State file should have been written
    const stateFile = join(env.xdgState, 'ecc-tailor', 'state.json');
    assert.ok(existsSync(stateFile), 'state.json should exist');
    const state = JSON.parse(await readFile(stateFile, 'utf8'));

    assert.ok(plannerDst in state.symlinks, 'state.symlinks should contain planner dst');

    // eccRef should be a 40-character hex SHA
    assert.ok(state.eccRef, 'state.eccRef should be set');
    assert.match(state.eccRef, /^[0-9a-f]{40}$/, 'eccRef should be a 40-char hex SHA');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: apply aborts on conflict (pre-existing real file at destination)
// ---------------------------------------------------------------------------
test('apply: aborts with non-zero exit and prints conflict when real file exists', async () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    await installMinimalConfig(env, ecc);

    // Pre-create a real file at the planner destination
    const agentsDir  = join(env.home, '.claude', 'agents');
    const plannerDst = join(agentsDir, 'planner.md');
    await mkdir(agentsDir, { recursive: true });
    await writeFile(plannerDst, '# manually created\n');

    const result = runCli(['apply'], env.env());

    assert.notEqual(result.status, 0, 'apply should exit non-zero on conflict');
    const combined = result.stdout + result.stderr;
    assert.match(combined, /conflict/i, 'output should mention "conflict"');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: second apply is a no-op ("Nothing to do.")
// ---------------------------------------------------------------------------
test('apply: second run is a no-op — prints "Nothing to do"', async () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    await installMinimalConfig(env, ecc);

    // First apply
    const first = runCli(['apply'], env.env());
    assert.equal(first.status, 0, `First apply failed: ${first.stderr}`);

    // Second apply
    const second = runCli(['apply'], env.env());
    assert.equal(second.status, 0, `Second apply failed: ${second.stderr}`);
    assert.match(second.stdout + second.stderr, /nothing to do/i, 'second run should say "Nothing to do"');
  } finally {
    env.cleanup();
  }
});

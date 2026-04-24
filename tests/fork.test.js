import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { lstatSync } from 'node:fs';

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
 * Write a minimal config.json that uses the fake ECC path with extras agents.
 */
async function installConfig(env, ecc, extras = {}) {
  await mkdir(join(env.xdgConfig, 'ecc-tailor'), { recursive: true });
  await writeFile(
    join(env.xdgConfig, 'ecc-tailor', 'config.json'),
    JSON.stringify({
      eccPath: ecc,
      global: {
        bundles: [],
        extras: {
          agents: extras.agents ?? [],
          skills: extras.skills ?? [],
          rulesLanguages: [],
        },
      },
      projects: [],
      hooks: { install: false },
    }),
  );
}

// ---------------------------------------------------------------------------
// Test 1: fork converts symlink → real file, records in state.forks
// ---------------------------------------------------------------------------
test('fork: converts symlink to real file and records in state.forks', async () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    await installConfig(env, ecc, { agents: ['planner'] });

    // First apply to create the symlink
    const applyResult = runCli(['apply'], env.env());
    assert.equal(applyResult.status, 0, `apply failed: ${applyResult.stderr}`);

    const plannerDst = join(env.home, '.claude', 'agents', 'planner.md');

    // Verify it's currently a symlink
    assert.ok(lstatSync(plannerDst).isSymbolicLink(), 'planner.md should be a symlink before fork');

    // Fork it
    const forkResult = runCli(['fork', plannerDst], env.env());
    assert.equal(forkResult.status, 0, `fork failed: ${forkResult.stderr}`);

    // Verify it's no longer a symlink
    const afterStat = lstatSync(plannerDst);
    assert.ok(!afterStat.isSymbolicLink(), 'planner.md should not be a symlink after fork');

    // Verify content matches ECC source
    const forkedContent = await readFile(plannerDst, 'utf8');
    const eccContent    = await readFile(join(ecc, 'agents', 'planner.md'), 'utf8');
    assert.equal(forkedContent, eccContent, 'forked content should match ECC source');

    // Verify state.forks has the entry and state.symlinks does not
    const stateFile = join(env.xdgState, 'ecc-tailor', 'state.json');
    const state     = JSON.parse(await readFile(stateFile, 'utf8'));

    assert.ok(plannerDst in state.forks, 'state.forks should contain the forked path');
    assert.ok(!(plannerDst in state.symlinks), 'state.symlinks should not contain the forked path');

    const forkEntry = state.forks[plannerDst];
    assert.ok(forkEntry.forkedAt, 'forks entry should have forkedAt');
    assert.equal(forkEntry.originalEccSrc, 'agents/planner.md', 'forks entry should record originalEccSrc');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: fork rejects unmanaged path
// ---------------------------------------------------------------------------
test('fork: rejects unmanaged path with non-zero exit', async () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    await installConfig(env, ecc, {});

    const result = runCli(['fork', '/tmp/nope-ecc-tailor-test'], env.env());

    assert.notEqual(result.status, 0, 'fork of unmanaged path should exit non-zero');
    const combined = result.stdout + result.stderr;
    assert.match(combined, /not managed/i, 'output should mention "not managed"');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: apply after fork leaves the forked file alone
// ---------------------------------------------------------------------------
test('apply after fork: leaves forked file with custom content intact', async () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    await installConfig(env, ecc, { agents: ['planner'] });

    // Apply to create symlink
    const firstApply = runCli(['apply'], env.env());
    assert.equal(firstApply.status, 0, `first apply failed: ${firstApply.stderr}`);

    const plannerDst = join(env.home, '.claude', 'agents', 'planner.md');

    // Fork the file
    const forkResult = runCli(['fork', plannerDst], env.env());
    assert.equal(forkResult.status, 0, `fork failed: ${forkResult.stderr}`);

    // Write custom content to the forked file
    const customContent = '# My custom planner — do not overwrite!\n';
    await writeFile(plannerDst, customContent, 'utf8');

    // Apply again
    const secondApply = runCli(['apply'], env.env());
    assert.equal(secondApply.status, 0, `second apply failed: ${secondApply.stderr}`);

    // Custom content must be preserved
    const afterContent = await readFile(plannerDst, 'utf8');
    assert.equal(afterContent, customContent, 'apply should not overwrite a forked file');

    // File must still be a real file, not a symlink
    assert.ok(!lstatSync(plannerDst).isSymbolicLink(), 'forked file must remain a real file after re-apply');
  } finally {
    env.cleanup();
  }
});

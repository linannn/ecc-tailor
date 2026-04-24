import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';

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
 * Write a minimal extras-only config.json.
 */
function installExtrasConfig(env, eccPath) {
  mkdirSync(join(env.xdgConfig, 'ecc-tailor'), { recursive: true });
  writeFileSync(
    join(env.xdgConfig, 'ecc-tailor', 'config.json'),
    JSON.stringify({
      eccPath,
      global: {
        bundles: [],
        extras: { agents: ['planner'], skills: [], rulesLanguages: [] },
      },
      projects: [],
      hooks: { install: false },
    }),
  );
}

// ---------------------------------------------------------------------------
// Test 1: status prints layer summary after apply
// ---------------------------------------------------------------------------
test('status: prints layer summary with agent count after apply', () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    installExtrasConfig(env, ecc);

    // Apply first
    const applyResult = runCli(['apply'], env.env());
    assert.equal(applyResult.status, 0, `apply failed: ${applyResult.stderr}`);

    // Run status
    const result = runCli(['status'], env.env());
    assert.equal(result.status, 0, `status exited with ${result.status}: ${result.stderr}`);

    const combined = result.stdout + result.stderr;
    assert.match(combined, /global.*1 agent/i, 'status should show "global: 1 agent"');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: doctor exits 0 and reports "all checks passed" when healthy
// ---------------------------------------------------------------------------
test('doctor: exits 0 and says "all checks passed" when healthy', () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    installExtrasConfig(env, ecc);

    // Apply first so there are symlinks to check
    const applyResult = runCli(['apply'], env.env());
    assert.equal(applyResult.status, 0, `apply failed: ${applyResult.stderr}`);

    // Run doctor
    const result = runCli(['doctor'], env.env());
    assert.equal(result.status, 0, `doctor exited with ${result.status}: ${result.stderr}`);

    const combined = result.stdout + result.stderr;
    assert.match(combined, /all checks passed/i, 'doctor should say "all checks passed"');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: doctor reports broken symlink when ECC source file is deleted
// ---------------------------------------------------------------------------
test('doctor: reports broken symlink when ECC source file is deleted', () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    installExtrasConfig(env, ecc);

    // Apply first
    const applyResult = runCli(['apply'], env.env());
    assert.equal(applyResult.status, 0, `apply failed: ${applyResult.stderr}`);

    // Delete the source file in the ECC to break the symlink
    const plannerSrc = join(ecc, 'agents', 'planner.md');
    unlinkSync(plannerSrc);

    // Run doctor — should exit non-zero and mention "broken"
    const result = runCli(['doctor'], env.env());
    assert.notEqual(result.status, 0, 'doctor should exit non-zero when there is a broken symlink');

    const combined = result.stdout + result.stderr;
    assert.match(combined, /broken/i, 'doctor should report "broken" symlink');
  } finally {
    env.cleanup();
  }
});

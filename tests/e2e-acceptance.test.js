/**
 * MVP E2E acceptance test — §16 lifecycle against the REAL ECC checkout.
 *
 * Only runs when ECC_PATH env var is set, e.g.:
 *   ECC_PATH=/path/to/everything-claude-code node --test tests/e2e-acceptance.test.js
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, existsSync, readlinkSync, readFileSync } from 'node:fs';

import { makeTmpEnv } from './helpers/tmp-env.js';

const ECC = process.env.ECC_PATH;
const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'ecc-tailor');

/**
 * Spawn the CLI binary with the given args and env overrides.
 */
function runCli(args, envVars) {
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...envVars },
  });
}

/**
 * Write config.json for the E2E suite.
 * Uses the real ECC with global bundle + hooks enabled.
 */
function writeE2EConfig(xdgConfig, eccPath) {
  const configDir = join(xdgConfig, 'ecc-tailor');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(
    join(configDir, 'config.json'),
    JSON.stringify({
      eccPath,
      global: {
        bundles: ['core'],
        extras: { agents: [], skills: [], rulesLanguages: ['common', 'java'] },
      },
      projects: [],
      hooks: {
        install: true,
        profile: 'standard',
        claudeMemCompat: true,
        disabled: [],
      },
    }),
    'utf8',
  );
}

describe('MVP E2E', { skip: !ECC && 'ECC_PATH not set' }, () => {
  // Shared state across all tests in this describe block
  let env;
  let projectDir;

  before(() => {
    env = makeTmpEnv();
    writeE2EConfig(env.xdgConfig, ECC);
    projectDir = join(env.root, 'test-project');
    mkdirSync(projectDir, { recursive: true });
  });

  after(() => {
    env.cleanup();
  });

  // ---------------------------------------------------------------------------
  // Test 1: apply --dry-run prints plan
  // ---------------------------------------------------------------------------
  test('1. apply --dry-run prints plan', () => {
    const result = runCli(['apply', '--dry-run'], env.env());

    assert.equal(
      result.status,
      0,
      `apply --dry-run should exit 0; got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );

    const combined = result.stdout + result.stderr;
    assert.match(combined, /to add/i, `output should mention "to add"; got: ${combined}`);

    // Dry-run must NOT create symlinks
    const plannerDst = join(env.home, '.claude', 'agents', 'planner.md');
    assert.ok(
      !existsSync(plannerDst),
      'planner.md symlink must not exist after --dry-run',
    );
  });

  // ---------------------------------------------------------------------------
  // Test 2: apply creates symlinks + hooks
  // ---------------------------------------------------------------------------
  test('2. apply creates symlinks + hooks', () => {
    const result = runCli(['apply'], env.env());

    assert.equal(
      result.status,
      0,
      `apply should exit 0; got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );

    // planner.md symlink should point into ECC
    const plannerDst = join(env.home, '.claude', 'agents', 'planner.md');
    assert.ok(existsSync(plannerDst), `planner.md symlink should exist at ${plannerDst}`);

    const target = readlinkSync(plannerDst);
    assert.equal(
      target,
      join(ECC, 'agents/planner.md'),
      `planner.md symlink should point to ECC; got: ${target}`,
    );

    // settings.json should have at least one [ecc-tailor]-prefixed hook entry
    const settingsFile = join(env.home, '.claude', 'settings.json');
    assert.ok(existsSync(settingsFile), 'settings.json should exist after apply with hooks.install=true');
    const settings = JSON.parse(readFileSync(settingsFile, 'utf8'));

    // Find any hook event that has an [ecc-tailor] entry
    const allEntries = Object.values(settings.hooks ?? {}).flat();
    const tailorEntries = allEntries.filter(e => e.description?.startsWith('[ecc-tailor]'));
    assert.ok(
      tailorEntries.length > 0,
      `settings.json should have at least one [ecc-tailor] hook entry; hooks: ${JSON.stringify(settings.hooks)}`,
    );

    // state.json should have eccRef (40-char hex SHA)
    const stateFile = join(env.xdgState, 'ecc-tailor', 'state.json');
    assert.ok(existsSync(stateFile), 'state.json should exist');
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));

    assert.ok(state.eccRef, 'state.eccRef should be set');
    assert.match(state.eccRef, /^[0-9a-f]{40}$/, `eccRef should be a 40-char hex SHA; got: ${state.eccRef}`);

    // Slash command should exist
    const slashCmd = join(env.home, '.claude', 'commands', 'ecc-tailor.md');
    assert.ok(existsSync(slashCmd), `slash command should exist at ${slashCmd}`);
  });

  // ---------------------------------------------------------------------------
  // Test 3: status outputs layer info
  // ---------------------------------------------------------------------------
  test('3. status outputs layer info', () => {
    const result = runCli(['status'], env.env());

    assert.equal(
      result.status,
      0,
      `status should exit 0; got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );

    const combined = result.stdout + result.stderr;
    assert.match(combined, /global/i, `status output should mention "global"; got: ${combined}`);
  });

  // ---------------------------------------------------------------------------
  // Test 4: hooks status works
  // ---------------------------------------------------------------------------
  test('4. hooks status works', () => {
    const result = runCli(['hooks', 'status'], env.env());

    assert.equal(
      result.status,
      0,
      `hooks status should exit 0; got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );

    const combined = result.stdout + result.stderr;
    assert.match(combined, /standard/, `hooks status should mention "standard"; got: ${combined}`);
  });

  // ---------------------------------------------------------------------------
  // Test 5: doctor passes
  // ---------------------------------------------------------------------------
  test('5. doctor passes', () => {
    const result = runCli(['doctor'], env.env());

    assert.equal(
      result.status,
      0,
      `doctor should exit 0; got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );

    const combined = result.stdout + result.stderr;
    assert.match(combined, /all checks passed/i, `doctor should say "all checks passed"; got: ${combined}`);
  });

  // ---------------------------------------------------------------------------
  // Test 6: re-apply is no-op-ish (exits 0; hooks always rewrite wrapper)
  // ---------------------------------------------------------------------------
  test('6. re-apply is no-op-ish', () => {
    const result = runCli(['apply'], env.env());

    assert.equal(
      result.status,
      0,
      `second apply should exit 0; got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
    // When hooks.install=true the wrapper is rewritten each time, so
    // "Nothing to do" is NOT printed. We just verify clean exit.
  });

  // ---------------------------------------------------------------------------
  // Test 7: add skill to global
  // ---------------------------------------------------------------------------
  test('7. add skill hexagonal-architecture to global', () => {
    const result = runCli(['add', 'skill', 'hexagonal-architecture', '--to', 'global'], env.env());

    assert.equal(
      result.status,
      0,
      `add skill should exit 0; got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );

    // Symlink should exist at ~/.claude/skills/hexagonal-architecture
    const symlinkDst = join(env.home, '.claude', 'skills', 'hexagonal-architecture');
    assert.ok(
      existsSync(symlinkDst),
      `symlink for hexagonal-architecture should exist at ${symlinkDst}`,
    );
  });

  // ---------------------------------------------------------------------------
  // Test 8: inventory shows hexagonal-architecture as selected
  // ---------------------------------------------------------------------------
  test('8. inventory shows hexagonal-architecture as selected', () => {
    const result = runCli(['inventory', '--type', 'skill', '--filter', 'hexagonal'], env.env());

    assert.equal(
      result.status,
      0,
      `inventory should exit 0; got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );

    const combined = result.stdout + result.stderr;
    assert.match(combined, /hexagonal-architecture/, `output should list hexagonal-architecture; got: ${combined}`);
    assert.match(combined, /\[✓\]/, `output should show [✓] for the selected skill; got: ${combined}`);
  });

  // ---------------------------------------------------------------------------
  // Test 9: scan attach + detach lifecycle
  // ---------------------------------------------------------------------------
  test('9. scan attach + detach lifecycle', () => {
    // Attach
    const attachResult = runCli(['scan', 'attach', projectDir], env.env());
    assert.equal(
      attachResult.status,
      0,
      `scan attach should exit 0; got ${attachResult.status}\nstdout: ${attachResult.stdout}\nstderr: ${attachResult.stderr}`,
    );

    // agent-sort is the first skill in the scan bundle
    const agentSortDst = join(projectDir, '.claude', 'skills', 'agent-sort');
    assert.ok(existsSync(agentSortDst), `agent-sort symlink should exist after attach at ${agentSortDst}`);

    // Detach
    const detachResult = runCli(['scan', 'detach', projectDir], env.env());
    assert.equal(
      detachResult.status,
      0,
      `scan detach should exit 0; got ${detachResult.status}\nstdout: ${detachResult.stdout}\nstderr: ${detachResult.stderr}`,
    );

    // Symlink should be gone
    assert.ok(
      !existsSync(agentSortDst),
      `agent-sort symlink should be removed after detach at ${agentSortDst}`,
    );
  });

  // ---------------------------------------------------------------------------
  // Test 10: remove --all cleans up
  // ---------------------------------------------------------------------------
  test('10. remove --all cleans up', () => {
    const result = runCli(['remove', '--all'], env.env());

    assert.equal(
      result.status,
      0,
      `remove --all should exit 0; got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );

    // planner.md should be gone
    const plannerDst = join(env.home, '.claude', 'agents', 'planner.md');
    assert.ok(!existsSync(plannerDst), 'planner.md symlink should be gone after remove --all');

    // state.symlinks should be empty
    const stateFile = join(env.xdgState, 'ecc-tailor', 'state.json');
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    assert.deepEqual(
      state.symlinks,
      {},
      `state.symlinks should be empty after remove --all; got: ${JSON.stringify(state.symlinks)}`,
    );
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';

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
 * Write config.json with:
 *   - global extras: agents:['planner'], rulesLanguages:['common']
 *   - one project with extras: skills:['coding-standards']
 *   - hooks.install: false
 */
function writeConfig(xdgConfig, eccPath, projectPath) {
  const configDir = join(xdgConfig, 'ecc-tailor');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(
    join(configDir, 'config.json'),
    JSON.stringify({
      eccPath,
      global: {
        bundles: [],
        extras: { agents: ['planner'], skills: [], rulesLanguages: ['common'] },
      },
      projects: [
        {
          path: projectPath,
          bundles: [],
          extras: { agents: [], skills: ['coding-standards'], rulesLanguages: [] },
        },
      ],
      hooks: { install: false },
    }),
    'utf8',
  );
}

/**
 * Read and parse the state.json from the XDG state dir.
 */
function readState(xdgState) {
  const stateFile = join(xdgState, 'ecc-tailor', 'state.json');
  return JSON.parse(readFileSync(stateFile, 'utf8'));
}

// ---------------------------------------------------------------------------
// Setup helper: creates a complete environment, runs apply, returns handles
// ---------------------------------------------------------------------------
function setupEnv() {
  const env = makeTmpEnv();
  const eccRoot = makeFakeEcc(join(env.root, 'fake-ecc'));

  // Create the project directory
  const projectPath = join(env.root, 'my-project');
  mkdirSync(projectPath, { recursive: true });

  writeConfig(env.xdgConfig, eccRoot, projectPath);

  // Apply to create the symlinks
  const applyResult = runCli(['apply'], env.env());
  if (applyResult.status !== 0) {
    throw new Error(`apply failed: ${applyResult.stderr}`);
  }

  return { env, eccRoot, projectPath };
}

// ---------------------------------------------------------------------------
// Test 1: remove --project <path> removes project symlinks, global intact
// ---------------------------------------------------------------------------
test('remove --project: project symlinks removed, global symlinks intact', () => {
  const { env, projectPath } = setupEnv();
  try {
    const envVars = env.env();

    // Project symlink that should be removed
    const projSkillDst = join(projectPath, '.claude', 'skills', 'coding-standards');

    // Global symlink that should remain
    const globalAgentDst = join(env.home, '.claude', 'agents', 'planner.md');

    // Both should exist after apply
    assert.ok(existsSync(projSkillDst), `project skill symlink should exist before remove: ${projSkillDst}`);
    assert.ok(existsSync(globalAgentDst), `global agent symlink should exist before remove: ${globalAgentDst}`);

    // Remove the project layer
    const result = runCli(['remove', '--project', projectPath], envVars);
    assert.equal(result.status, 0, `remove --project failed: ${result.stderr}`);

    // Project symlink should be gone
    assert.ok(!existsSync(projSkillDst), `project skill symlink should be removed: ${projSkillDst}`);

    // Global symlink should still exist
    assert.ok(existsSync(globalAgentDst), `global agent symlink should still exist: ${globalAgentDst}`);

    // State should not have the project symlink
    const state = readState(env.xdgState);
    const hasProjEntry = Object.values(state.symlinks).some(
      e => e.ownedBy === `proj:${projectPath}`,
    );
    assert.ok(!hasProjEntry, 'state.symlinks should have no project-owned entries after remove --project');

    // State should still have the global entry
    const hasGlobalEntry = Object.values(state.symlinks).some(
      e => e.ownedBy === 'global',
    );
    assert.ok(hasGlobalEntry, 'state.symlinks should still have global-owned entries');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: remove --global removes global symlinks, project symlinks intact
// ---------------------------------------------------------------------------
test('remove --global: global symlinks removed, project symlinks intact', () => {
  const { env, projectPath } = setupEnv();
  try {
    const envVars = env.env();

    // Global symlinks that should be removed
    const globalAgentDst = join(env.home, '.claude', 'agents', 'planner.md');

    // Project symlink that should remain
    const projSkillDst = join(projectPath, '.claude', 'skills', 'coding-standards');

    assert.ok(existsSync(globalAgentDst), `global agent symlink should exist before remove: ${globalAgentDst}`);
    assert.ok(existsSync(projSkillDst), `project skill symlink should exist before remove: ${projSkillDst}`);

    // Remove the global layer
    const result = runCli(['remove', '--global'], envVars);
    assert.equal(result.status, 0, `remove --global failed: ${result.stderr}`);

    // Global symlink should be gone
    assert.ok(!existsSync(globalAgentDst), `global agent symlink should be removed: ${globalAgentDst}`);

    // Project symlink should still exist
    assert.ok(existsSync(projSkillDst), `project skill symlink should still exist: ${projSkillDst}`);

    // State should have no global-owned entries
    const state = readState(env.xdgState);
    const hasGlobalEntry = Object.values(state.symlinks).some(
      e => e.ownedBy === 'global',
    );
    assert.ok(!hasGlobalEntry, 'state.symlinks should have no global-owned entries after remove --global');

    // State should still have the project entry
    const hasProjEntry = Object.values(state.symlinks).some(
      e => e.ownedBy === `proj:${projectPath}`,
    );
    assert.ok(hasProjEntry, 'state.symlinks should still have project-owned entries');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: remove --all removes everything; state.symlinks is empty
// ---------------------------------------------------------------------------
test('remove --all: all symlinks removed, state.symlinks is empty', () => {
  const { env, projectPath } = setupEnv();
  try {
    const envVars = env.env();

    const globalAgentDst = join(env.home, '.claude', 'agents', 'planner.md');
    const projSkillDst   = join(projectPath, '.claude', 'skills', 'coding-standards');

    assert.ok(existsSync(globalAgentDst), `global agent symlink should exist before remove --all`);
    assert.ok(existsSync(projSkillDst),   `project skill symlink should exist before remove --all`);

    const result = runCli(['remove', '--all'], envVars);
    assert.equal(result.status, 0, `remove --all failed: ${result.stderr}`);

    // All symlinks should be gone
    assert.ok(!existsSync(globalAgentDst), `global agent symlink should be removed`);
    assert.ok(!existsSync(projSkillDst),   `project skill symlink should be removed`);

    // state.symlinks should be empty
    const state = readState(env.xdgState);
    assert.deepEqual(
      state.symlinks,
      {},
      `state.symlinks should be empty after remove --all, got: ${JSON.stringify(state.symlinks)}`,
    );
  } finally {
    env.cleanup();
  }
});

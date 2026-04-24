import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, existsSync, readlinkSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { makeTmpEnv }  from './helpers/tmp-env.js';
import { makeFakeEcc } from './helpers/fake-ecc.js';

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
 * Write a base config with empty bundles and hooks.install=false.
 */
function writeBaseConfig(xdgConfig, eccPath) {
  const configDir = join(xdgConfig, 'ecc-tailor');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(
    join(configDir, 'config.json'),
    JSON.stringify({
      eccPath,
      global: {
        bundles: [],
        extras: { agents: [], skills: [], rulesLanguages: [] },
      },
      projects: [],
      hooks: { install: false },
    }),
    'utf8',
  );
}

// ---------------------------------------------------------------------------
// Test 1: scan attach installs ephemeral symlinks
// ---------------------------------------------------------------------------
test('scan attach: installs ephemeral symlinks into project .claude/skills/', async () => {
  const env = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(env.root, 'fake-ecc'));
    writeBaseConfig(env.xdgConfig, eccRoot);

    // Create a fake project directory
    const projectDir = join(env.root, 'my-project');
    mkdirSync(projectDir, { recursive: true });

    const result = runCli(['scan', 'attach', projectDir], env.env());
    assert.equal(result.status, 0, `Expected exit 0, got ${result.status}: ${result.stderr}\n${result.stdout}`);

    // agent-sort is the only skill in the scan bundle
    const symlinkDst = join(projectDir, '.claude', 'skills', 'agent-sort');
    assert.ok(existsSync(symlinkDst), `expected symlink at ${symlinkDst}`);

    // Verify readlink points into ECC
    const target = readlinkSync(symlinkDst);
    assert.equal(target, join(eccRoot, 'skills', 'agent-sort'), 'symlink should point to ECC skills/agent-sort');

    // Load state and verify
    const stateFile = join(env.xdgState, 'ecc-tailor', 'state.json');
    assert.ok(existsSync(stateFile), 'state.json should exist');
    const state = JSON.parse(await readFile(stateFile, 'utf8'));

    // state.symlinks entry should have ephemeral=true
    assert.ok(symlinkDst in state.symlinks, 'state.symlinks should contain the symlink dst');
    assert.equal(state.symlinks[symlinkDst].ephemeral, true, 'symlink entry should be ephemeral');
    assert.equal(state.symlinks[symlinkDst].kind, 'skill-dir');
    assert.equal(state.symlinks[symlinkDst].ownedBy, `scan:${projectDir}`);

    // state.ephemeralScans entry should exist
    assert.ok(projectDir in state.ephemeralScans, 'state.ephemeralScans should contain project path');
    assert.equal(state.ephemeralScans[projectDir].bundle, 'scan');
    assert.ok(state.ephemeralScans[projectDir].attachedAt, 'attachedAt should be set');

    // config.projects should still be empty (config not modified)
    const configFile = join(env.xdgConfig, 'ecc-tailor', 'config.json');
    const cfg = JSON.parse(await readFile(configFile, 'utf8'));
    assert.deepEqual(cfg.projects, [], 'config.projects must remain empty — scan must not modify config.json');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: scan detach removes symlinks and ephemeral state
// ---------------------------------------------------------------------------
test('scan detach: cleans up symlinks and removes ephemeralScans entry', async () => {
  const env = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(env.root, 'fake-ecc'));
    writeBaseConfig(env.xdgConfig, eccRoot);

    const projectDir = join(env.root, 'my-project');
    mkdirSync(projectDir, { recursive: true });

    // Attach first
    const attachResult = runCli(['scan', 'attach', projectDir], env.env());
    assert.equal(attachResult.status, 0, `attach failed: ${attachResult.stderr}`);

    const symlinkDst = join(projectDir, '.claude', 'skills', 'agent-sort');
    assert.ok(existsSync(symlinkDst), 'symlink should exist after attach');

    // Now detach
    const detachResult = runCli(['scan', 'detach', projectDir], env.env());
    assert.equal(detachResult.status, 0, `detach failed: ${detachResult.stderr}\n${detachResult.stdout}`);

    // Symlink should be gone
    assert.ok(!existsSync(symlinkDst), 'symlink should be removed after detach');

    // State should be cleaned up
    const stateFile = join(env.xdgState, 'ecc-tailor', 'state.json');
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    assert.ok(!(symlinkDst in state.symlinks), 'state.symlinks entry should be removed');
    assert.ok(!(projectDir in state.ephemeralScans), 'state.ephemeralScans entry should be removed');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: scan attach refuses double-attach
// ---------------------------------------------------------------------------
test('scan attach: refuses double-attach with non-zero exit and /already/i message', () => {
  const env = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(env.root, 'fake-ecc'));
    writeBaseConfig(env.xdgConfig, eccRoot);

    const projectDir = join(env.root, 'my-project');
    mkdirSync(projectDir, { recursive: true });

    // First attach
    const first = runCli(['scan', 'attach', projectDir], env.env());
    assert.equal(first.status, 0, `first attach failed: ${first.stderr}`);

    // Second attach — should fail
    const second = runCli(['scan', 'attach', projectDir], env.env());
    assert.notEqual(second.status, 0, 'second attach should exit with non-zero status');
    const combined = second.stdout + second.stderr;
    assert.match(combined, /already/i, `expected "already" in output, got: ${combined}`);
  } finally {
    env.cleanup();
  }
});

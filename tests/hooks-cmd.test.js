import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

import { makeTmpEnv }  from './helpers/tmp-env.js';
import { makeFakeEcc } from './helpers/fake-ecc.js';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'ecc-tailor');

function runCli(args, env) {
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

/**
 * Write config.json with hooks.install=true using the fake ECC root.
 */
async function installHooksConfig(env, eccRoot) {
  await mkdir(join(env.xdgConfig, 'ecc-tailor'), { recursive: true });
  await writeFile(
    join(env.xdgConfig, 'ecc-tailor', 'config.json'),
    JSON.stringify({
      eccPath: eccRoot,
      global: {
        bundles: [],
        extras: { agents: [], skills: [], rulesLanguages: [] },
      },
      projects: [],
      hooks: {
        install: true,
        profile: 'standard',
        claudeMemCompat: true,
        disabled: [],
      },
    }),
  );
}

/**
 * Common setup: temp env + fake ECC + config + initial apply.
 */
async function setup() {
  const env = makeTmpEnv();
  const eccRoot = join(env.root, 'fake-ecc');
  makeFakeEcc(eccRoot);
  await installHooksConfig(env, eccRoot);

  // Initial apply to create the wrapper script
  const applyResult = runCli(['apply'], env.env());
  assert.equal(
    applyResult.status, 0,
    `setup apply failed:\nstdout: ${applyResult.stdout}\nstderr: ${applyResult.stderr}`,
  );

  return { env, eccRoot };
}

// ---------------------------------------------------------------------------
// Test 1: hooks status
// ---------------------------------------------------------------------------
test('hooks status: output contains profile and claudeMemCompat', async () => {
  const { env } = await setup();
  try {
    const result = runCli(['hooks', 'status'], env.env());
    assert.equal(result.status, 0,
      `hooks status exited ${result.status}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);

    const out = result.stdout + result.stderr;
    assert.match(out, /standard/, 'output should contain the profile "standard"');
    assert.match(out, /claudeMemCompat/, 'output should contain "claudeMemCompat"');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: hooks set-profile strict
// ---------------------------------------------------------------------------
test('hooks set-profile strict: updates config and regenerates wrapper', async () => {
  const { env } = await setup();
  try {
    const result = runCli(['hooks', 'set-profile', 'strict'], env.env());
    assert.equal(result.status, 0,
      `hooks set-profile exited ${result.status}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);

    // config.hooks.profile should be 'strict'
    const configFile = join(env.xdgConfig, 'ecc-tailor', 'config.json');
    const cfg = JSON.parse(await readFile(configFile, 'utf8'));
    assert.equal(cfg.hooks.profile, 'strict', 'config.hooks.profile should be "strict"');

    // wrapper should contain ECC_HOOK_PROFILE:-strict
    const wrapperPath = join(env.xdgData, 'ecc-tailor', 'bin', 'run-hook.sh');
    const wrapper = await readFile(wrapperPath, 'utf8');
    assert.match(wrapper, /ECC_HOOK_PROFILE:-strict/, 'wrapper should reference profile "strict"');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: hooks disable pre:config-protection
// ---------------------------------------------------------------------------
test('hooks disable: adds ID to config.hooks.disabled and updates wrapper', async () => {
  const { env } = await setup();
  try {
    const result = runCli(['hooks', 'disable', 'pre:config-protection'], env.env());
    assert.equal(result.status, 0,
      `hooks disable exited ${result.status}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);

    // config.hooks.disabled should include the ID
    const configFile = join(env.xdgConfig, 'ecc-tailor', 'config.json');
    const cfg = JSON.parse(await readFile(configFile, 'utf8'));
    assert.ok(
      cfg.hooks.disabled.includes('pre:config-protection'),
      `config.hooks.disabled should include "pre:config-protection", got: ${JSON.stringify(cfg.hooks.disabled)}`,
    );

    // wrapper should reference the disabled hook ID
    const wrapperPath = join(env.xdgData, 'ecc-tailor', 'bin', 'run-hook.sh');
    const wrapper = await readFile(wrapperPath, 'utf8');
    assert.match(wrapper, /pre:config-protection/, 'wrapper should contain the disabled hook ID');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: hooks enable pre:config-protection
// ---------------------------------------------------------------------------
test('hooks enable: removes ID from config.hooks.disabled', async () => {
  const { env } = await setup();
  try {
    // First disable it
    const disableResult = runCli(['hooks', 'disable', 'pre:config-protection'], env.env());
    assert.equal(disableResult.status, 0, `disable step failed: ${disableResult.stderr}`);

    // Then enable it
    const enableResult = runCli(['hooks', 'enable', 'pre:config-protection'], env.env());
    assert.equal(enableResult.status, 0,
      `hooks enable exited ${enableResult.status}:\nstdout: ${enableResult.stdout}\nstderr: ${enableResult.stderr}`);

    // config.hooks.disabled should NOT include the ID anymore
    const configFile = join(env.xdgConfig, 'ecc-tailor', 'config.json');
    const cfg = JSON.parse(await readFile(configFile, 'utf8'));
    assert.ok(
      !cfg.hooks.disabled.includes('pre:config-protection'),
      `config.hooks.disabled should NOT include "pre:config-protection" after enable, got: ${JSON.stringify(cfg.hooks.disabled)}`,
    );
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: hooks claude-mem-compat off
// ---------------------------------------------------------------------------
test('hooks claude-mem-compat off: sets config.hooks.claudeMemCompat to false', async () => {
  const { env } = await setup();
  try {
    const result = runCli(['hooks', 'claude-mem-compat', 'off'], env.env());
    assert.equal(result.status, 0,
      `hooks claude-mem-compat exited ${result.status}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);

    const configFile = join(env.xdgConfig, 'ecc-tailor', 'config.json');
    const cfg = JSON.parse(await readFile(configFile, 'utf8'));
    assert.equal(cfg.hooks.claudeMemCompat, false, 'config.hooks.claudeMemCompat should be false');
  } finally {
    env.cleanup();
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import { makeTmpEnv }  from './helpers/tmp-env.js';
import { makeFakeEcc } from './helpers/fake-ecc.js';
import { git } from '../src/util/git.js';

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
 * The real hooks.json entry used in tests.
 */
const REAL_HOOKS_JSON = {
  hooks: {
    PreToolUse: [
      {
        matcher: 'Write|Edit',
        hooks: [
          {
            type: 'command',
            command:
              'node -e "..." node scripts/hooks/run-with-flags.js pre:config-protection scripts/hooks/config-protection.js standard,strict',
            timeout: 5,
          },
        ],
        description: 'Block linter config edits',
        id: 'pre:config-protection',
      },
    ],
  },
};

/**
 * Write config.json with hooks.install=true and extras-only approach.
 */
async function installHooksConfig(env, ecc) {
  await mkdir(join(env.xdgConfig, 'ecc-tailor'), { recursive: true });
  await writeFile(
    join(env.xdgConfig, 'ecc-tailor', 'config.json'),
    JSON.stringify({
      eccPath: ecc,
      global: {
        bundles: [],
        extras: { agents: ['planner'], skills: [], rulesLanguages: [] },
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
 * Write config.json with hooks.install=false.
 */
async function installNoHooksConfig(env, ecc) {
  await mkdir(join(env.xdgConfig, 'ecc-tailor'), { recursive: true });
  await writeFile(
    join(env.xdgConfig, 'ecc-tailor', 'config.json'),
    JSON.stringify({
      eccPath: ecc,
      global: {
        bundles: [],
        extras: { agents: ['planner'], skills: [], rulesLanguages: [] },
      },
      projects: [],
      hooks: { install: false },
    }),
  );
}

/**
 * Set up a fake ECC repo with a real hooks.json entry.
 * After overwriting hooks.json, commit so that getEccRef() reads HEAD.
 */
async function setupFakeEccWithHooks(eccRoot) {
  makeFakeEcc(eccRoot);
  // Overwrite hooks.json with a real entry (on top of what makeFakeEcc created)
  const hooksDir = join(eccRoot, 'hooks');
  await writeFile(
    join(hooksDir, 'hooks.json'),
    JSON.stringify(REAL_HOOKS_JSON, null, 2) + '\n',
    'utf8',
  );
  // Commit so getEccRef() can read HEAD
  git(['add', '.'], { cwd: eccRoot });
  git(['commit', '-m', 'add real hooks.json'], { cwd: eccRoot });
  return eccRoot;
}

/**
 * Write config.json with claudeMemCompat: null (auto-detect mode).
 */
async function installAutoDetectConfig(env, ecc) {
  await mkdir(join(env.xdgConfig, 'ecc-tailor'), { recursive: true });
  await writeFile(
    join(env.xdgConfig, 'ecc-tailor', 'config.json'),
    JSON.stringify({
      eccPath: ecc,
      global: {
        bundles: [],
        extras: { agents: ['planner'], skills: [], rulesLanguages: [] },
      },
      projects: [],
      hooks: {
        install: true,
        profile: 'standard',
        claudeMemCompat: null,
        disabled: [],
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Test 1: hooks.install=true — wrapper written + hooks merged into settings.json
// ---------------------------------------------------------------------------
test('apply: hooks.install=true installs wrapper and merges hooks into settings.json', async () => {
  const env = makeTmpEnv();
  try {
    const eccRoot = join(env.root, 'fake-ecc');
    await setupFakeEccWithHooks(eccRoot);
    await installHooksConfig(env, eccRoot);

    const result = runCli(['apply'], env.env());

    assert.equal(result.status, 0, `CLI exited with ${result.status}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);

    // Wrapper file should exist at <xdgData>/ecc-tailor/bin/run-hook.sh
    const wrapperPath = join(env.xdgData, 'ecc-tailor', 'bin', 'run-hook.sh');
    assert.ok(existsSync(wrapperPath), `wrapper should exist at ${wrapperPath}`);

    // settings.json should have PreToolUse with 1 entry, description starts with [ecc-tailor]
    const settingsFile = join(env.home, '.claude', 'settings.json');
    assert.ok(existsSync(settingsFile), 'settings.json should exist');
    const settings = JSON.parse(await readFile(settingsFile, 'utf8'));

    assert.ok(settings.hooks?.PreToolUse, 'settings.json should have hooks.PreToolUse');
    assert.equal(
      settings.hooks.PreToolUse.length,
      1,
      'PreToolUse should have exactly 1 entry',
    );
    assert.ok(
      settings.hooks.PreToolUse[0].description.startsWith('[ecc-tailor]'),
      `description should start with [ecc-tailor], got: ${settings.hooks.PreToolUse[0].description}`,
    );

    // state.json should have hooks.installed=true and hooks.settingsBackup set
    const stateFile = join(env.xdgState, 'ecc-tailor', 'state.json');
    assert.ok(existsSync(stateFile), 'state.json should exist');
    const state = JSON.parse(await readFile(stateFile, 'utf8'));

    assert.equal(state.hooks?.installed, true, 'state.hooks.installed should be true');
    assert.ok(state.hooks?.settingsBackup, 'state.hooks.settingsBackup should be set');
    assert.equal(
      state.hooks?.addedEntries?.PreToolUse,
      1,
      'state.hooks.addedEntries.PreToolUse should be 1',
    );
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: hooks.install=false — settings.json is never written
// ---------------------------------------------------------------------------
test('apply: hooks.install=false skips settings.json entirely', async () => {
  const env = makeTmpEnv();
  try {
    const eccRoot = join(env.root, 'fake-ecc');
    await setupFakeEccWithHooks(eccRoot);
    await installNoHooksConfig(env, eccRoot);

    const result = runCli(['apply'], env.env());

    assert.equal(result.status, 0, `CLI exited with ${result.status}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);

    const settingsFile = join(env.home, '.claude', 'settings.json');
    assert.ok(!existsSync(settingsFile), 'settings.json should NOT exist when hooks.install=false');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Idempotent — apply twice → settings.json has exactly 1 ecc-tailor entry
// ---------------------------------------------------------------------------
test('apply: idempotent — applying twice with hooks.install=true leaves exactly 1 ecc-tailor entry', async () => {
  const env = makeTmpEnv();
  try {
    const eccRoot = join(env.root, 'fake-ecc');
    await setupFakeEccWithHooks(eccRoot);
    await installHooksConfig(env, eccRoot);

    // First apply
    const first = runCli(['apply'], env.env());
    assert.equal(first.status, 0, `First apply failed: ${first.stderr}`);

    // Second apply
    const second = runCli(['apply'], env.env());
    assert.equal(second.status, 0, `Second apply failed: ${second.stderr}`);

    const settingsFile = join(env.home, '.claude', 'settings.json');
    const settings = JSON.parse(await readFile(settingsFile, 'utf8'));

    assert.ok(settings.hooks?.PreToolUse, 'settings.json should have hooks.PreToolUse');
    assert.equal(
      settings.hooks.PreToolUse.length,
      1,
      `PreToolUse should have exactly 1 entry after two applies, got ${settings.hooks.PreToolUse.length}`,
    );
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: claudeMemCompat=null + no claude-mem → auto-detects false, persists
// ---------------------------------------------------------------------------
test('apply: claudeMemCompat null auto-detects false when no claude-mem present', async () => {
  const env = makeTmpEnv();
  try {
    const eccRoot = join(env.root, 'fake-ecc');
    await setupFakeEccWithHooks(eccRoot);
    await installAutoDetectConfig(env, eccRoot);

    // No claude-mem in ~/.claude.json (file doesn't exist)
    const result = runCli(['apply'], env.env());
    assert.equal(result.status, 0, `CLI exited with ${result.status}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);

    // Config should have been persisted with claudeMemCompat = false
    const savedConfig = JSON.parse(await readFile(join(env.xdgConfig, 'ecc-tailor', 'config.json'), 'utf8'));
    assert.equal(savedConfig.hooks.claudeMemCompat, false, 'should auto-detect false when no claude-mem');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: claudeMemCompat=null + claude-mem present → auto-detects true, persists
// ---------------------------------------------------------------------------
test('apply: claudeMemCompat null auto-detects true when claude-mem present', async () => {
  const env = makeTmpEnv();
  try {
    const eccRoot = join(env.root, 'fake-ecc');
    await setupFakeEccWithHooks(eccRoot);
    await installAutoDetectConfig(env, eccRoot);

    // Write ~/.claude.json with claude-mem MCP server
    await writeFile(
      join(env.home, '.claude.json'),
      JSON.stringify({ mcpServers: { 'plugin_claude-mem_mcp-search': { command: 'node' } } }),
    );

    const result = runCli(['apply'], env.env());
    assert.equal(result.status, 0, `CLI exited with ${result.status}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);

    // Config should have been persisted with claudeMemCompat = true
    const savedConfig = JSON.parse(await readFile(join(env.xdgConfig, 'ecc-tailor', 'config.json'), 'utf8'));
    assert.equal(savedConfig.hooks.claudeMemCompat, true, 'should auto-detect true when claude-mem present');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 6: claudeMemCompat=null + claude-mem via plugin system → auto-detects true
// ---------------------------------------------------------------------------
test('apply: claudeMemCompat null auto-detects true via installed_plugins.json', async () => {
  const env = makeTmpEnv();
  try {
    const eccRoot = join(env.root, 'fake-ecc');
    await setupFakeEccWithHooks(eccRoot);
    await installAutoDetectConfig(env, eccRoot);

    // Write installed_plugins.json (plugin system, not mcpServers)
    const pluginsDir = join(env.home, '.claude', 'plugins');
    await mkdir(pluginsDir, { recursive: true });
    await writeFile(
      join(pluginsDir, 'installed_plugins.json'),
      JSON.stringify({
        version: 2,
        plugins: { 'claude-mem@thedotmack': [{ scope: 'user', version: '12.0.0' }] },
      }),
    );

    const result = runCli(['apply'], env.env());
    assert.equal(result.status, 0, `CLI exited with ${result.status}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);

    const savedConfig = JSON.parse(await readFile(join(env.xdgConfig, 'ecc-tailor', 'config.json'), 'utf8'));
    assert.equal(savedConfig.hooks.claudeMemCompat, true, 'should auto-detect true via plugin system');
  } finally {
    env.cleanup();
  }
});

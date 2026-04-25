import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { makeTmpEnv }  from './helpers/tmp-env.js';
import { makeFakeEcc } from './helpers/fake-ecc.js';
import { git }         from '../src/util/git.js';

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
 * Write a base config that uses only extras (no bundles) and hooks.install=false.
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

/**
 * Set up a temp env with a fake ECC that also has an `api-design` skill.
 *
 * @returns {{ env, envVars, eccRoot, cleanup }}
 */
function makeTmpEnvWithApiDesign() {
  const env = makeTmpEnv();
  const eccRoot = makeFakeEcc(join(env.root, 'fake-ecc'));

  // Add api-design skill to fake ECC
  const apiDesignDir = join(eccRoot, 'skills', 'api-design');
  mkdirSync(apiDesignDir, { recursive: true });
  writeFileSync(
    join(apiDesignDir, 'SKILL.md'),
    '---\nname: api-design\ndescription: fake api-design skill\n---\n',
    'utf8',
  );
  // Stage and commit in the fake ECC git repo
  git(['add', '.'], { cwd: eccRoot });
  git(['commit', '-m', 'add api-design skill'], { cwd: eccRoot });

  writeBaseConfig(env.xdgConfig, eccRoot);

  return { env, envVars: env.env(), eccRoot, cleanup: () => env.cleanup() };
}

// ---------------------------------------------------------------------------
// Test 1: add skill api-design --to global → config updated + symlink created
// ---------------------------------------------------------------------------
test('add skill api-design --to global: config updated and symlink exists', async () => {
  const { env, envVars, eccRoot, cleanup } = makeTmpEnvWithApiDesign();
  try {
    const result = runCli(['add', 'skill', 'api-design', '--to', 'global'], envVars);

    assert.equal(result.status, 0, `Expected exit 0, got ${result.status}: ${result.stderr}`);

    // Config should contain api-design in global.extras.skills
    const configFile = join(env.xdgConfig, 'ecc-tailor', 'config.json');
    const cfg = JSON.parse(await readFile(configFile, 'utf8'));
    assert.ok(
      cfg.global.extras.skills.includes('api-design'),
      `expected global.extras.skills to include "api-design", got: ${JSON.stringify(cfg.global.extras.skills)}`,
    );

    // Symlink should exist (apply ran)
    const symlinkDst = join(env.home, '.claude', 'skills', 'api-design');
    assert.ok(existsSync(symlinkDst), `expected symlink at ${symlinkDst}`);
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: add skill api-design --to global --no-apply → config updated, no symlink
// ---------------------------------------------------------------------------
test('add skill api-design --to global --no-apply: config updated but no symlink', async () => {
  const { env, envVars, cleanup } = makeTmpEnvWithApiDesign();
  try {
    const result = runCli(['add', 'skill', 'api-design', '--to', 'global', '--no-apply'], envVars);

    assert.equal(result.status, 0, `Expected exit 0, got ${result.status}: ${result.stderr}`);

    // Config should contain api-design
    const configFile = join(env.xdgConfig, 'ecc-tailor', 'config.json');
    const cfg = JSON.parse(await readFile(configFile, 'utf8'));
    assert.ok(
      cfg.global.extras.skills.includes('api-design'),
      `expected global.extras.skills to include "api-design"`,
    );

    // Symlink must NOT exist (--no-apply)
    const symlinkDst = join(env.home, '.claude', 'skills', 'api-design');
    assert.ok(!existsSync(symlinkDst), `expected NO symlink at ${symlinkDst}`);
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: add skill does-not-exist --to global → non-zero exit, stderr /not found/i
// ---------------------------------------------------------------------------
test('add skill does-not-exist: non-zero exit and error mentions "not found"', () => {
  const { envVars, cleanup } = makeTmpEnvWithApiDesign();
  try {
    const result = runCli(['add', 'skill', 'does-not-exist', '--to', 'global'], envVars);

    assert.notEqual(result.status, 0, 'Expected non-zero exit code');
    const combined = result.stdout + result.stderr;
    assert.match(combined, /not found/i, `expected "not found" in output, got: ${combined}`);
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: add bundle java-proj --to project:<path> --no-apply → new project entry with bundles=['java-proj']
// ---------------------------------------------------------------------------
test('add bundle java-proj --to project:<path> --no-apply: new project entry created', async () => {
  const { env, envVars, cleanup } = makeTmpEnvWithApiDesign();
  try {
    const projectPath = join(env.root, 'my-java-project');
    mkdirSync(projectPath, { recursive: true });

    const result = runCli(
      ['add', 'bundle', 'java-proj', '--to', `project:${projectPath}`, '--no-apply'],
      envVars,
    );

    assert.equal(result.status, 0, `Expected exit 0, got ${result.status}: ${result.stderr}`);

    const configFile = join(env.xdgConfig, 'ecc-tailor', 'config.json');
    const cfg = JSON.parse(await readFile(configFile, 'utf8'));

    const entry = cfg.projects.find(p => p.path === projectPath);
    assert.ok(entry, `expected projects to contain entry for ${projectPath}`);
    assert.deepEqual(entry.bundles, ['java-proj'], `expected bundles=['java-proj'], got: ${JSON.stringify(entry.bundles)}`);
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: add skill without --to → defaults to project:$(pwd)
// ---------------------------------------------------------------------------
test('add skill without --to: defaults to project scope using cwd', async () => {
  const { env, envVars, cleanup } = makeTmpEnvWithApiDesign();
  try {
    const projectPath = join(env.root, 'my-project');
    mkdirSync(projectPath, { recursive: true });
    // macOS: /var → /private/var symlink; process.cwd() returns realpath
    const realProjectPath = realpathSync(projectPath);

    const result = spawnSync(process.execPath, [BIN, 'add', 'skill', 'api-design', '--no-apply'], {
      encoding: 'utf8',
      cwd: projectPath,
      env: { ...process.env, ...envVars },
    });

    assert.equal(result.status, 0, `Expected exit 0, got ${result.status}: ${result.stderr}`);

    const configFile = join(env.xdgConfig, 'ecc-tailor', 'config.json');
    const cfg = JSON.parse(await readFile(configFile, 'utf8'));

    const entry = cfg.projects.find(p => p.path === realProjectPath);
    assert.ok(entry, `expected projects to contain entry for ${realProjectPath}, got: ${JSON.stringify(cfg.projects)}`);
    assert.ok(
      entry.extras.skills.includes('api-design'),
      `expected project extras.skills to include "api-design", got: ${JSON.stringify(entry.extras?.skills)}`,
    );
    assert.ok(
      !cfg.global.extras.skills.includes('api-design'),
      'should NOT be added to global extras',
    );
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 6: remove skill api-design --from global --no-apply → removed from extras
// ---------------------------------------------------------------------------
test('remove skill api-design --from global --no-apply: skill removed from extras', async () => {
  const { env, envVars, cleanup } = makeTmpEnvWithApiDesign();
  try {
    // First add it
    const addResult = runCli(['add', 'skill', 'api-design', '--to', 'global', '--no-apply'], envVars);
    assert.equal(addResult.status, 0, `add failed: ${addResult.stderr}`);

    // Then remove it
    const removeResult = runCli(['remove', 'skill', 'api-design', '--from', 'global', '--no-apply'], envVars);
    assert.equal(removeResult.status, 0, `remove failed: ${removeResult.stderr}`);

    const configFile = join(env.xdgConfig, 'ecc-tailor', 'config.json');
    const cfg = JSON.parse(await readFile(configFile, 'utf8'));
    assert.ok(
      !cfg.global.extras.skills.includes('api-design'),
      `expected "api-design" to be removed from global.extras.skills, got: ${JSON.stringify(cfg.global.extras.skills)}`,
    );
  } finally {
    cleanup();
  }
});

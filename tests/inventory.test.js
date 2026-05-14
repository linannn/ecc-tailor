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

// ---------------------------------------------------------------------------
// Test 4: inventory --type bundle lists bundles
// ---------------------------------------------------------------------------
test('inventory --type bundle: lists available bundles', () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    writeConfig(env.xdgConfig, ecc);

    const result = runCli(['inventory', '--type', 'bundle'], env.env());

    assert.equal(result.status, 0, `CLI exited with ${result.status}: ${result.stderr}`);

    const combined = result.stdout + result.stderr;
    assert.match(combined, /BUNDLES/, 'output should have BUNDLES header');
    assert.match(combined, /core/, 'output should list core bundle');
    assert.match(combined, /java-proj/, 'output should list java-proj bundle');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4b: [G] for global bundles, [ ] for other-project bundles
// ---------------------------------------------------------------------------
test('inventory --type bundle: shows [G] for global, [ ] for other-project bundles', () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));

    const configDir = join(env.xdgConfig, 'ecc-tailor');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({
        eccPath: ecc,
        global: {
          bundles: ['scan'],
          extras: { agents: [], skills: [], rulesLanguages: [] },
        },
        projects: [],
        hooks: { install: false },
      }),
      'utf8',
    );

    const result = runCli(['inventory', '--type', 'bundle'], env.env());

    assert.equal(result.status, 0, `CLI exited with ${result.status}: ${result.stderr}`);

    const lines = (result.stdout + result.stderr).split('\n');
    const scanLine = lines.find(l => /\bscan\b/.test(l));
    const javaLine = lines.find(l => /\bjava-proj\b/.test(l));

    assert.ok(scanLine, 'should have a scan bundle line');
    assert.match(scanLine, /\[G\]/, 'scan should show [G] for global scope');

    assert.ok(javaLine, 'should have a java-proj bundle line');
    assert.match(javaLine, /\[ \]/, 'java-proj (not installed) should show [ ]');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4c: [P] for project-only bundle
// ---------------------------------------------------------------------------
test('inventory --type bundle: shows [P] for project-only bundle', () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    const cwd = process.cwd();

    const configDir = join(env.xdgConfig, 'ecc-tailor');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({
        eccPath: ecc,
        global: {
          bundles: [],
          extras: { agents: [], skills: [], rulesLanguages: [] },
        },
        projects: [
          { path: cwd, bundles: ['scan'] },
        ],
        hooks: { install: false },
      }),
      'utf8',
    );

    const result = runCli(['inventory', '--type', 'bundle'], env.env());

    assert.equal(result.status, 0, `CLI exited with ${result.status}: ${result.stderr}`);

    const lines = (result.stdout + result.stderr).split('\n');
    const scanLine = lines.find(l => /\bscan\b/.test(l));

    assert.ok(scanLine, 'should have a scan bundle line');
    assert.match(scanLine, /\[P\]/, 'scan (project-only) should show [P]');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4d: [✓] for bundle in both global and current project
// ---------------------------------------------------------------------------
test('inventory --type bundle: shows [✓] when bundle is both global and project', () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    const cwd = process.cwd();

    const configDir = join(env.xdgConfig, 'ecc-tailor');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({
        eccPath: ecc,
        global: {
          bundles: ['scan'],
          extras: { agents: [], skills: [], rulesLanguages: [] },
        },
        projects: [
          { path: cwd, bundles: ['scan'] },
        ],
        hooks: { install: false },
      }),
      'utf8',
    );

    const result = runCli(['inventory', '--type', 'bundle'], env.env());

    assert.equal(result.status, 0, `CLI exited with ${result.status}: ${result.stderr}`);

    const lines = (result.stdout + result.stderr).split('\n');
    const scanLine = lines.find(l => /\bscan\b/.test(l));

    assert.ok(scanLine, 'should have a scan bundle line');
    assert.match(scanLine, /\[✓\]/, 'scan (global + project) should show [✓]');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: inventory --detail <bundle-name> shows resolved bundle contents
// ---------------------------------------------------------------------------
test('inventory --detail java-proj: shows bundle contents', () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    writeConfig(env.xdgConfig, ecc);

    const result = runCli(['inventory', '--detail', 'java-proj'], env.env());

    assert.equal(result.status, 0, `CLI exited with ${result.status}: ${result.stderr}`);

    const combined = result.stdout + result.stderr;
    assert.match(combined, /Bundle: java-proj/, 'output should show bundle name');
    assert.match(combined, /extends: core/, 'output should show extends');
    assert.match(combined, /Contents:/, 'output should show Contents section');
    assert.match(combined, /springboot-patterns/, 'output should list java skills');
    assert.match(combined, /java-reviewer/, 'output should list java agents');
  } finally {
    env.cleanup();
  }
});

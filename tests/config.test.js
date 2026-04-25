import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeTmpEnv } from './helpers/tmp-env.js';
import { loadConfig, validateConfig, DEFAULT_CONFIG } from '../src/core/config.js';

// ---------------------------------------------------------------------------
// loadConfig: missing file returns defaults
// ---------------------------------------------------------------------------
test('loadConfig: missing file returns defaults', () => {
  const tmp = makeTmpEnv();
  try {
    // Pass a directory that has no config.json inside it
    const cfg = loadConfig({ home: tmp.xdgConfig });
    assert.equal(cfg.eccPath, null);
    assert.deepEqual(cfg.global.bundles, ['global']);
    assert.equal(cfg.hooks.install, true);
    assert.equal(cfg.hooks.claudeMemCompat, true);
  } finally {
    tmp.cleanup();
  }
});

// ---------------------------------------------------------------------------
// loadConfig: parses user file
// ---------------------------------------------------------------------------
test('loadConfig: parses user file', () => {
  const tmp = makeTmpEnv();
  try {
    const configDir = join(tmp.xdgConfig, 'ecc-tailor');
    mkdirSync(configDir, { recursive: true });

    const userConfig = {
      eccPath: '/opt/ecc',
      global: {
        extras: { agents: ['my-agent'], skills: [], rulesLanguages: ['en'] },
      },
      projects: [
        { path: '/home/user/myproject', bundles: ['web'] },
      ],
    };
    writeFileSync(join(configDir, 'config.json'), JSON.stringify(userConfig), 'utf8');

    const cfg = loadConfig({ home: configDir });

    assert.equal(cfg.eccPath, '/opt/ecc');
    assert.deepEqual(cfg.global.bundles, ['global']); // default preserved
    assert.deepEqual(cfg.global.extras.agents, ['my-agent']);
    assert.deepEqual(cfg.global.extras.rulesLanguages, ['en']);
    assert.equal(cfg.projects.length, 1);
    assert.equal(cfg.projects[0].path, '/home/user/myproject');
    assert.deepEqual(cfg.projects[0].bundles, ['web']);
  } finally {
    tmp.cleanup();
  }
});

// ---------------------------------------------------------------------------
// validateConfig: rejects non-array bundles
// ---------------------------------------------------------------------------
test('validateConfig: rejects non-array bundles', () => {
  const bad = {
    eccPath: null,
    global: { bundles: 'global', extras: {}, excludes: {} },
    projects: [],
    hooks: { profile: 'standard' },
  };
  assert.throws(() => validateConfig(bad), /bundles.*array/i);
});

// ---------------------------------------------------------------------------
// validateConfig: rejects relative project path
// ---------------------------------------------------------------------------
test('validateConfig: rejects relative project path', () => {
  const bad = {
    eccPath: null,
    global: { bundles: ['global'], extras: {}, excludes: {} },
    projects: [{ path: 'relative/path', bundles: [] }],
    hooks: { profile: 'standard' },
  };
  assert.throws(() => validateConfig(bad), /absolute/i);
});

// ---------------------------------------------------------------------------
// validateConfig: bundleOverrides validation
// ---------------------------------------------------------------------------
test('validateConfig: accepts valid bundleOverrides', () => {
  const cfg = {
    eccPath: null,
    global: { bundles: ['global'], extras: {}, excludes: {} },
    projects: [],
    hooks: { profile: 'standard' },
    bundleOverrides: {
      global: {
        exclude: { agents: ['planner'], skills: ['coding-standards'], mcp: ['context7'] },
        add: { agents: ['architect'], skills: ['tdd-workflow'], mcp: [] },
      },
    },
  };
  assert.doesNotThrow(() => validateConfig(cfg));
});

test('validateConfig: rejects non-object bundleOverrides', () => {
  const bad = {
    eccPath: null,
    global: { bundles: ['global'], extras: {}, excludes: {} },
    projects: [],
    hooks: { profile: 'standard' },
    bundleOverrides: ['global'],
  };
  assert.throws(() => validateConfig(bad), /bundleOverrides.*object/i);
});

test('validateConfig: rejects non-array field in override', () => {
  const bad = {
    eccPath: null,
    global: { bundles: ['global'], extras: {}, excludes: {} },
    projects: [],
    hooks: { profile: 'standard' },
    bundleOverrides: {
      x: { exclude: { agents: 'not-array' } },
    },
  };
  assert.throws(() => validateConfig(bad), /array/i);
});

// ---------------------------------------------------------------------------
// validateConfig: rulesLanguage validation
// ---------------------------------------------------------------------------
test('validateConfig: accepts valid rulesLanguage en', () => {
  const cfg = { ...structuredClone(DEFAULT_CONFIG), rulesLanguage: 'en' };
  assert.doesNotThrow(() => validateConfig(cfg));
});

test('validateConfig: accepts valid rulesLanguage zh', () => {
  const cfg = { ...structuredClone(DEFAULT_CONFIG), rulesLanguage: 'zh' };
  assert.doesNotThrow(() => validateConfig(cfg));
});

test('validateConfig: rejects invalid rulesLanguage', () => {
  const cfg = { ...structuredClone(DEFAULT_CONFIG), rulesLanguage: 'fr' };
  assert.throws(() => validateConfig(cfg), /rulesLanguage/);
});

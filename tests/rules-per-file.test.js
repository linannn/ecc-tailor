/**
 * Tests for per-file rule symlinks and rules/commands exclude support.
 *
 * RED phase: these tests MUST fail before implementation.
 *
 * Covers:
 *  1. fs-scan.js  — scanEcc returns ruleFiles (per-file entries)
 *  2. resolve.js  — emits rules-file kind entries instead of rules-dir
 *  3. resolve.js  — globalExcludes.rules filters individual rule files
 *  4. resolve.js  — globalExcludes.commands filters manual extras.commands
 *  5. config.js   — DEFAULT_CONFIG.global.excludes has rules slot
 *  6. config.js   — validateConfig accepts rules in excludes
 *  7. customize   — CLI: exclude rules writes to config
 *  8. customize   — CLI: exclude commands writes to config
 *  9. apply       — executeApply creates per-file rule symlinks (rules-file kind)
 * 10. round-trip  — exclude a rule file, apply, verify symlink absent
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, readlinkSync, symlinkSync, writeFileSync } from 'node:fs';

import { makeTmpEnv }  from './helpers/tmp-env.js';
import { makeFakeEcc } from './helpers/fake-ecc.js';
import { scanEcc }     from '../src/core/fs-scan.js';
import { resolveDesired } from '../src/core/resolve.js';
import { DEFAULT_CONFIG, validateConfig } from '../src/core/config.js';
import { EMPTY_STATE } from '../src/core/state.js';
import { planApply, executeApply } from '../src/apply/apply.js';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'ecc-tailor');

function runCli(args, env) {
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

// Inline bundles — no bundle-level rules, rules come from rulesLanguages
const BUNDLES = {
  core: { agents: ['planner'], skills: ['coding-standards'], mcp: [], rules: [] },
};

function makeConfig(overrides = {}) {
  return {
    global: {
      bundles: ['core'],
      extras:  { agents: [], skills: [], rulesLanguages: ['common'], commands: [] },
      excludes: { agents: [], skills: [], mcp: [], commands: [], rules: [] },
      ...overrides,
    },
    projects: [],
  };
}

// =============================================================================
// 1. fs-scan: returns ruleFiles with per-file entries
// =============================================================================

test('scanEcc: ruleFiles contains per-file entries for rule markdown files', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const result = scanEcc(eccRoot);

    // ruleFiles should be an array
    assert.ok(Array.isArray(result.ruleFiles), 'scanEcc result should have ruleFiles array');

    // fake-ecc has rules/common/style.md
    const styleFile = result.ruleFiles.find(f => f.name === 'style' && f.lang === 'common');
    assert.ok(styleFile, 'rules/common/style.md should appear in ruleFiles');
    assert.equal(styleFile.path, 'rules/common/style.md');
    assert.equal(styleFile.lang, 'common');
  } finally {
    tmp.cleanup();
  }
});

test('scanEcc: ruleFiles includes files from multiple rule directories', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const result = scanEcc(eccRoot);

    // fake-ecc has rules/java/coding-style.md and rules/zh/style.md
    const javaFile = result.ruleFiles.find(f => f.lang === 'java' && f.name === 'coding-style');
    assert.ok(javaFile, 'rules/java/coding-style.md should appear in ruleFiles');
    assert.equal(javaFile.path, 'rules/java/coding-style.md');

    const zhFile = result.ruleFiles.find(f => f.lang === 'zh' && f.name === 'style');
    assert.ok(zhFile, 'rules/zh/style.md should appear in ruleFiles');
  } finally {
    tmp.cleanup();
  }
});

test('scanEcc: ruleFiles ignores non-markdown files in rule directories', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    // Add a non-md file to rules/common/
    writeFileSync(join(eccRoot, 'rules', 'common', 'ignore-me.txt'), 'skip\n', 'utf8');

    const result = scanEcc(eccRoot);

    const txtEntry = result.ruleFiles.find(f => f.name === 'ignore-me');
    assert.equal(txtEntry, undefined, '.txt file should not appear in ruleFiles');
  } finally {
    tmp.cleanup();
  }
});

test('scanEcc: existing rules (directory-level) scan still present for backward compat', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const result = scanEcc(eccRoot);

    // rules (directory-level) scan still works
    const common = result.rules.find(r => r.name === 'common');
    assert.ok(common, 'directory-level rules scan should still return common');
    assert.equal(common.path, 'rules/common');
  } finally {
    tmp.cleanup();
  }
});

// =============================================================================
// 2. resolve: emits rules-file kind entries
// =============================================================================

test('resolveDesired: emits rules-file entries (not rules-dir) for each rule file', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const config = makeConfig();
    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });

    // All rule-kind entries should be rules-file, not rules-dir
    const ruleDirEntries = links.filter(l => l.kind === 'rules-dir');
    assert.equal(ruleDirEntries.length, 0, 'should emit no rules-dir entries');

    // Should have per-file entries for rules/common/style.md
    const styleLink = links.find(
      l => l.eccSrc === 'rules/common/style.md',
    );
    assert.ok(styleLink, 'rules/common/style.md should be a resolved link');
    assert.equal(styleLink.kind, 'rules-file');
    assert.equal(styleLink.ownedBy, 'global');
    assert.equal(styleLink.dst, join(tmp.home, '.claude', 'rules', 'common', 'style.md'));
  } finally {
    tmp.cleanup();
  }
});

test('resolveDesired: rules-file entries are emitted for all files in the lang dir', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));

    // Add a second file to rules/common/
    writeFileSync(join(eccRoot, 'rules', 'common', 'security.md'), '# Security\n', 'utf8');

    const inv = scanEcc(eccRoot);
    const config = makeConfig();
    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });

    const styleLink   = links.find(l => l.eccSrc === 'rules/common/style.md');
    const securityLink = links.find(l => l.eccSrc === 'rules/common/security.md');

    assert.ok(styleLink,    'style.md should be resolved');
    assert.ok(securityLink, 'security.md should be resolved');
  } finally {
    tmp.cleanup();
  }
});

// =============================================================================
// 3. resolve: globalExcludes.rules filters rule files
// =============================================================================

test('resolveDesired: globalExcludes.rules excludes named rule file', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    const config = makeConfig({
      excludes: { agents: [], skills: [], mcp: [], commands: [], rules: ['style'] },
    });

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });

    const styleLink = links.find(l => l.eccSrc === 'rules/common/style.md');
    assert.equal(styleLink, undefined, 'style rule file should be excluded');
  } finally {
    tmp.cleanup();
  }
});

test('resolveDesired: globalExcludes.rules excludes by filename without extension', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    // Add a second file so we can verify only the excluded one is gone
    writeFileSync(join(eccRoot, 'rules', 'common', 'security.md'), '# Security\n', 'utf8');

    const inv = scanEcc(eccRoot);

    const config = makeConfig({
      excludes: { agents: [], skills: [], mcp: [], commands: [], rules: ['style'] },
    });

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });

    const styleLink    = links.find(l => l.eccSrc === 'rules/common/style.md');
    const securityLink = links.find(l => l.eccSrc === 'rules/common/security.md');

    assert.equal(styleLink, undefined,    'style should be excluded');
    assert.ok(securityLink,               'security should still be present');
  } finally {
    tmp.cleanup();
  }
});

test('resolveDesired: globalExcludes.rules exclude applies across all lang dirs', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    // Both common/style.md and zh/style.md exist in fake-ecc
    const inv = scanEcc(eccRoot);

    // Install both common and zh
    const config = makeConfig({
      extras:   { agents: [], skills: [], rulesLanguages: ['common', 'zh'], commands: [] },
      excludes: { agents: [], skills: [], mcp: [], commands: [], rules: ['style'] },
    });

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });

    const commonStyle = links.find(l => l.eccSrc === 'rules/common/style.md');
    const zhStyle     = links.find(l => l.eccSrc === 'rules/zh/style.md');

    assert.equal(commonStyle, undefined, 'common/style.md should be excluded');
    assert.equal(zhStyle,     undefined, 'zh/style.md should be excluded');
  } finally {
    tmp.cleanup();
  }
});

// =============================================================================
// 4. resolve: globalExcludes.commands filters manual extras.commands
// =============================================================================

test('resolveDesired: globalExcludes.commands excludes manual extras.commands entry', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    // eval is in fake-ecc commands; add it as extra then exclude it
    const config = makeConfig({
      extras:   { agents: [], skills: [], rulesLanguages: [], commands: ['eval'] },
      excludes: { agents: [], skills: [], mcp: [], commands: ['eval'], rules: [] },
    });

    const links = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });

    const evalLink = links.find(l => l.eccSrc === 'commands/eval.md');
    assert.equal(evalLink, undefined, 'eval command should be excluded by excludes.commands');
  } finally {
    tmp.cleanup();
  }
});

// =============================================================================
// 5. config: DEFAULT_CONFIG has rules slot in global.excludes
// =============================================================================

test('DEFAULT_CONFIG.global.excludes has rules slot', () => {
  assert.ok(
    Array.isArray(DEFAULT_CONFIG.global.excludes.rules),
    'DEFAULT_CONFIG.global.excludes.rules should be an array',
  );
});

// =============================================================================
// 6. config: validateConfig accepts rules and commands in excludes
// =============================================================================

test('validateConfig: accepts rules array in global.excludes', () => {
  const cfg = {
    global: {
      bundles: ['core'],
      excludes: { agents: [], skills: [], mcp: [], commands: [], rules: ['style'] },
    },
    projects: [],
  };
  assert.doesNotThrow(() => validateConfig(cfg), 'should not throw for valid rules exclude');
});

test('validateConfig: accepts commands array in global.excludes', () => {
  const cfg = {
    global: {
      bundles: ['core'],
      excludes: { agents: [], skills: [], mcp: [], commands: ['eval'], rules: [] },
    },
    projects: [],
  };
  assert.doesNotThrow(() => validateConfig(cfg), 'should not throw for valid commands exclude');
});

// =============================================================================
// 7. customize CLI: exclude rules writes to config
// =============================================================================

test('customize exclude: rules type writes exclusion to config', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const configDir = join(tmp.xdgConfig, 'ecc-tailor');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({
        eccPath: eccRoot,
        global: { bundles: ['core'], extras: { rulesLanguages: ['common'] }, excludes: {} },
        projects: [],
        hooks: { install: false },
      }),
      'utf8',
    );

    const result = runCli(
      ['customize', 'core', 'exclude', 'rules', 'style'],
      tmp.env(),
    );

    assert.equal(result.status, 0, `exit 0, got ${result.status}: ${result.stderr}`);

    const cfg = JSON.parse(readFileSync(join(configDir, 'config.json'), 'utf8'));
    assert.ok(
      cfg.bundleOverrides?.core?.exclude?.rules?.includes('style'),
      'bundleOverrides.core.exclude.rules should contain "style"',
    );
  } finally {
    tmp.cleanup();
  }
});

test('customize exclude: commands type writes exclusion to config', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const configDir = join(tmp.xdgConfig, 'ecc-tailor');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({
        eccPath: eccRoot,
        global: { bundles: ['core'], extras: {}, excludes: {} },
        projects: [],
        hooks: { install: false },
      }),
      'utf8',
    );

    const result = runCli(
      ['customize', 'core', 'exclude', 'commands', 'eval'],
      tmp.env(),
    );

    assert.equal(result.status, 0, `exit 0, got ${result.status}: ${result.stderr}`);

    const cfg = JSON.parse(readFileSync(join(configDir, 'config.json'), 'utf8'));
    assert.ok(
      cfg.bundleOverrides?.core?.exclude?.commands?.includes('eval'),
      'bundleOverrides.core.exclude.commands should contain "eval"',
    );
  } finally {
    tmp.cleanup();
  }
});

test('customize exclude: rule alias "rule" normalizes to "rules"', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const configDir = join(tmp.xdgConfig, 'ecc-tailor');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({
        eccPath: eccRoot,
        global: { bundles: ['core'], extras: { rulesLanguages: ['common'] }, excludes: {} },
        projects: [],
        hooks: { install: false },
      }),
      'utf8',
    );

    const result = runCli(
      ['customize', 'core', 'exclude', 'rule', 'style'],
      tmp.env(),
    );

    assert.equal(result.status, 0, `exit 0 for alias "rule", got ${result.status}: ${result.stderr}`);
  } finally {
    tmp.cleanup();
  }
});

test('customize exclude: command alias "command" normalizes to "commands"', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const configDir = join(tmp.xdgConfig, 'ecc-tailor');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({
        eccPath: eccRoot,
        global: { bundles: ['core'], extras: {}, excludes: {} },
        projects: [],
        hooks: { install: false },
      }),
      'utf8',
    );

    const result = runCli(
      ['customize', 'core', 'exclude', 'command', 'eval'],
      tmp.env(),
    );

    assert.equal(result.status, 0, `exit 0 for alias "command", got ${result.status}: ${result.stderr}`);
  } finally {
    tmp.cleanup();
  }
});

// =============================================================================
// 8. apply: executeApply handles rules-file kind — creates per-file symlinks
// =============================================================================

test('executeApply: creates per-file symlink for rules-file kind', async () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);
    const config  = makeConfig();
    const desired = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });
    const state   = structuredClone(EMPTY_STATE);

    const plan = await planApply(desired, state, { ecc: eccRoot });
    const newState = await executeApply(plan, state, { ecc: eccRoot });

    // rules/common/style.md should be symlinked at ~/.claude/rules/common/style.md
    const styleDst = join(tmp.home, '.claude', 'rules', 'common', 'style.md');
    assert.ok(existsSync(styleDst), `per-file symlink should exist at ${styleDst}`);

    const target = readlinkSync(styleDst);
    assert.equal(target, join(eccRoot, 'rules', 'common', 'style.md'),
      'symlink should point to ECC per-file path');

    // State should record the symlink
    assert.ok(styleDst in newState.symlinks, 'state should contain the per-file rule symlink');
    assert.equal(newState.symlinks[styleDst].kind, 'rules-file');
  } finally {
    tmp.cleanup();
  }
});

test('executeApply: rules-file symlink — parent dir created automatically', async () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);
    const config  = makeConfig({
      extras: { agents: [], skills: [], rulesLanguages: ['java'], commands: [] },
    });
    const desired = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });
    const state   = structuredClone(EMPTY_STATE);

    const plan = await planApply(desired, state, { ecc: eccRoot });
    await executeApply(plan, state, { ecc: eccRoot });

    // ~/.claude/rules/java/coding-style.md should exist
    const javaStyleDst = join(tmp.home, '.claude', 'rules', 'java', 'coding-style.md');
    assert.ok(existsSync(javaStyleDst), 'java/coding-style.md per-file symlink should exist');
  } finally {
    tmp.cleanup();
  }
});

// =============================================================================
// 9. Round-trip: exclude a rule file, apply, verify symlink absent
// =============================================================================

test('round-trip: exclude a rule file — apply creates no symlink for it', async () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    // Add a second rule file so common is not empty after excluding style
    writeFileSync(join(eccRoot, 'rules', 'common', 'security.md'), '# Security\n', 'utf8');

    const inv = scanEcc(eccRoot);

    const config = makeConfig({
      excludes: { agents: [], skills: [], mcp: [], commands: [], rules: ['style'] },
    });

    const desired = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });
    const state   = structuredClone(EMPTY_STATE);

    const plan = await planApply(desired, state, { ecc: eccRoot });
    await executeApply(plan, state, { ecc: eccRoot });

    const styleDst    = join(tmp.home, '.claude', 'rules', 'common', 'style.md');
    const securityDst = join(tmp.home, '.claude', 'rules', 'common', 'security.md');

    assert.ok(!existsSync(styleDst),    'excluded style.md should NOT be symlinked');
    assert.ok(existsSync(securityDst),  'non-excluded security.md should be symlinked');
  } finally {
    tmp.cleanup();
  }
});

test('round-trip: old rules-dir symlink removed when transitioning to per-file', async () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const inv = scanEcc(eccRoot);

    // Simulate old state: a rules-dir symlink for common
    const oldRulesDst = join(tmp.home, '.claude', 'rules', 'common');
    mkdirSync(join(tmp.home, '.claude', 'rules'), { recursive: true });

    // Create the old directory symlink
    symlinkSync(join(eccRoot, 'rules', 'common'), oldRulesDst);

    const state = {
      ...structuredClone(EMPTY_STATE),
      symlinks: {
        [oldRulesDst]: {
          eccSrc: 'rules/common',
          kind: 'rules-dir',
          ownedBy: 'global',
          ephemeral: false,
        },
      },
    };

    const config  = makeConfig();
    const desired = resolveDesired(config, BUNDLES, inv, { home: tmp.home, eccRoot });
    const plan    = await planApply(desired, state, { ecc: eccRoot });

    // Old rules-dir entry should be in toRemove
    const removeEntry = plan.toRemove.find(e => e.dst === oldRulesDst);
    assert.ok(removeEntry, 'old rules-dir symlink should be scheduled for removal');

    // Per-file entry should be in toAdd
    const styleDst = join(tmp.home, '.claude', 'rules', 'common', 'style.md');
    const addEntry = plan.toAdd.find(e => e.dst === styleDst);
    assert.ok(addEntry, 'per-file style.md should be in toAdd');
    assert.equal(addEntry.kind, 'rules-file');
  } finally {
    tmp.cleanup();
  }
});

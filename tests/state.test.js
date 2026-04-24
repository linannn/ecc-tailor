import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { makeTmpEnv } from './helpers/tmp-env.js';
import { loadState, saveState, EMPTY_STATE } from '../src/state.js';

// ---------------------------------------------------------------------------
// loadState: missing file returns EMPTY_STATE defaults
// ---------------------------------------------------------------------------
test('loadState: missing file returns EMPTY_STATE', () => {
  const env = makeTmpEnv();
  try {
    const state = loadState({ home: env.home });
    assert.equal(state.version, 1);
    assert.deepEqual(state.symlinks, {});
    assert.deepEqual(state.forks, {});
    assert.equal(state.eccRef, null);
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// saveState: atomic write + round-trip
// ---------------------------------------------------------------------------
test('saveState: atomic write + round-trip', () => {
  const env = makeTmpEnv();
  try {
    const toSave = { ...JSON.parse(JSON.stringify(EMPTY_STATE)), eccRef: 'abc' };
    saveState(toSave, { home: env.home });

    const loaded = loadState({ home: env.home });
    assert.equal(loaded.eccRef, 'abc');
    assert.equal(loaded.version, 1);
    assert.deepEqual(loaded.symlinks, {});
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// saveState: no .tmp file left on success
// ---------------------------------------------------------------------------
test('saveState: no .tmp file left on success', () => {
  const env = makeTmpEnv();
  try {
    saveState(JSON.parse(JSON.stringify(EMPTY_STATE)), { home: env.home });

    const stateDir = join(env.home, '.local', 'state', 'ecc-tailor');
    assert.ok(existsSync(stateDir), 'state dir should exist');

    const files = readdirSync(stateDir);
    const tmpFiles = files.filter(f => f.startsWith('.tmp-'));
    assert.deepEqual(tmpFiles, [], 'no .tmp files should remain');
  } finally {
    env.cleanup();
  }
});

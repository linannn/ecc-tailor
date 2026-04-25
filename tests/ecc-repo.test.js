import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { makeTmpEnv } from './helpers/tmp-env.js';
import { makeFakeEcc } from './helpers/fake-ecc.js';
import { resolveEccRoot } from '../src/core/ecc-repo.js';

// ---------------------------------------------------------------------------
// resolveEccRoot: honors config.eccPath override
// ---------------------------------------------------------------------------
test('resolveEccRoot: honors config.eccPath override', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const config = { eccPath: eccRoot };
    const result = resolveEccRoot(config, { home: tmp.home, clone: false });
    assert.equal(result, eccRoot);
  } finally {
    tmp.cleanup();
  }
});

// ---------------------------------------------------------------------------
// resolveEccRoot: fails if eccPath missing and clone=false
// ---------------------------------------------------------------------------
test('resolveEccRoot: fails if eccPath missing and clone=false', () => {
  const tmp = makeTmpEnv();
  try {
    const config = { eccPath: null };
    assert.throws(
      () => resolveEccRoot(config, { home: tmp.home, clone: false }),
      /ECC clone not found/,
    );
  } finally {
    tmp.cleanup();
  }
});

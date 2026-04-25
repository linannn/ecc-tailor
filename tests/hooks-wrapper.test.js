import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { makeTmpEnv } from './helpers/tmp-env.js';
import {
  CLAUDE_MEM_COMPAT_HOOKS,
  effectiveDisabled,
  writeHookWrapper,
} from '../src/hooks/hooks-wrapper.js';

// ---------------------------------------------------------------------------
// effectiveDisabled: claudeMemCompat true → 8 compat ids + user list merged
// ---------------------------------------------------------------------------
test('effectiveDisabled: claudeMemCompat true merges compat hooks with user list', () => {
  const result = effectiveDisabled({ claudeMemCompat: true, disabled: ['my-hook'] });
  assert.equal(result.length, CLAUDE_MEM_COMPAT_HOOKS.length + 1);
  for (const id of CLAUDE_MEM_COMPAT_HOOKS) {
    assert.ok(result.includes(id), `expected ${id} in result`);
  }
  assert.ok(result.includes('my-hook'));
});

// ---------------------------------------------------------------------------
// effectiveDisabled: claudeMemCompat false → only user list
// ---------------------------------------------------------------------------
test('effectiveDisabled: claudeMemCompat false returns only user list', () => {
  const result = effectiveDisabled({ claudeMemCompat: false, disabled: ['my-hook', 'other-hook'] });
  assert.deepEqual(result, ['my-hook', 'other-hook']);
});

// ---------------------------------------------------------------------------
// effectiveDisabled: dedup — 'session:start' in both lists appears only once
// ---------------------------------------------------------------------------
test('effectiveDisabled: deduplicates ids present in both compat and user list', () => {
  const result = effectiveDisabled({ claudeMemCompat: true, disabled: ['session:start'] });
  const count = result.filter(id => id === 'session:start').length;
  assert.equal(count, 1, 'session:start should appear exactly once');
  assert.equal(result.length, CLAUDE_MEM_COMPAT_HOOKS.length);
});

// ---------------------------------------------------------------------------
// effectiveDisabled: claudeMemCompat null (undecided) → same as false
// ---------------------------------------------------------------------------
test('effectiveDisabled: claudeMemCompat null returns only user list', () => {
  const result = effectiveDisabled({ claudeMemCompat: null, disabled: ['my-hook'] });
  assert.deepEqual(result, ['my-hook']);
});

// ---------------------------------------------------------------------------
// writeHookWrapper: writes executable bash with embedded values
// ---------------------------------------------------------------------------
test('writeHookWrapper: writes executable bash script with correct embedded values', () => {
  const env = makeTmpEnv();
  try {
    const wrapperPath = join(env.xdgData, 'run-hook.sh');

    writeHookWrapper(
      {
        eccRoot: '/opt/ecc',
        profile: 'standard',
        disabled: ['session:start', 'stop:session-end'],
      },
      { wrapperPath },
    );

    const content = readFileSync(wrapperPath, 'utf8');

    assert.match(content, /ECC_HOOK_PROFILE:-standard/, 'profile embedded correctly');
    assert.match(content, /ECC_DISABLED_HOOKS:-session:start,stop:session-end/, 'disabled list embedded correctly');

    const stat = statSync(wrapperPath);
    // Check executable bit for owner (0o100 = owner execute)
    assert.ok((stat.mode & 0o111) !== 0, 'wrapper script should be executable');
  } finally {
    env.cleanup();
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldFetch } from '../src/upgrade-notify.js';

// ---------------------------------------------------------------------------
// shouldFetch: null → always fetch
// ---------------------------------------------------------------------------
test('shouldFetch: returns true when lastFetchISO is null', () => {
  assert.equal(shouldFetch(null), true);
});

// ---------------------------------------------------------------------------
// shouldFetch: recent fetch → skip
// ---------------------------------------------------------------------------
test('shouldFetch: returns false when last fetch was less than 24h ago', () => {
  const recentISO = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
  assert.equal(shouldFetch(recentISO), false);
});

// ---------------------------------------------------------------------------
// shouldFetch: stale fetch → re-fetch
// ---------------------------------------------------------------------------
test('shouldFetch: returns true when last fetch was more than 24h ago', () => {
  const staleISO = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
  assert.equal(shouldFetch(staleISO), true);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeTmpEnv } from './helpers/tmp-env.js';
import { detectClaudeMem } from '../src/apply/apply-cmd.js';

// ---------------------------------------------------------------------------
// detectClaudeMem: no file → false
// ---------------------------------------------------------------------------
test('detectClaudeMem: returns false when file does not exist', () => {
  assert.equal(detectClaudeMem('/nonexistent/.claude.json'), false);
});

// ---------------------------------------------------------------------------
// detectClaudeMem: empty mcpServers → false
// ---------------------------------------------------------------------------
test('detectClaudeMem: returns false when mcpServers is empty', () => {
  const env = makeTmpEnv();
  try {
    const f = join(env.root, '.claude.json');
    writeFileSync(f, JSON.stringify({ mcpServers: {} }));
    assert.equal(detectClaudeMem(f), false);
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// detectClaudeMem: unrelated MCP servers → false
// ---------------------------------------------------------------------------
test('detectClaudeMem: returns false with unrelated MCP servers only', () => {
  const env = makeTmpEnv();
  try {
    const f = join(env.root, '.claude.json');
    writeFileSync(f, JSON.stringify({
      mcpServers: { 'context7': { command: 'node' }, 'supabase': { command: 'npx' } },
    }));
    assert.equal(detectClaudeMem(f), false);
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// detectClaudeMem: key containing "claude-mem" → true
// ---------------------------------------------------------------------------
test('detectClaudeMem: returns true when key contains claude-mem', () => {
  const env = makeTmpEnv();
  try {
    const f = join(env.root, '.claude.json');
    writeFileSync(f, JSON.stringify({
      mcpServers: { 'plugin_claude-mem_mcp-foo': { command: 'node' } },
    }));
    assert.equal(detectClaudeMem(f), true);
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// detectClaudeMem: key containing "mcp-search" → true
// ---------------------------------------------------------------------------
test('detectClaudeMem: returns true when key contains mcp-search', () => {
  const env = makeTmpEnv();
  try {
    const f = join(env.root, '.claude.json');
    writeFileSync(f, JSON.stringify({
      mcpServers: { 'plugin_claude-mem_mcp-search': { command: 'node' } },
    }));
    assert.equal(detectClaudeMem(f), true);
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// detectClaudeMem: no mcpServers key at all → false
// ---------------------------------------------------------------------------
test('detectClaudeMem: returns false when no mcpServers key', () => {
  const env = makeTmpEnv();
  try {
    const f = join(env.root, '.claude.json');
    writeFileSync(f, JSON.stringify({ globalShortcut: 'ctrl+space' }));
    assert.equal(detectClaudeMem(f), false);
  } finally {
    env.cleanup();
  }
});

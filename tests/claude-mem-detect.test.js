import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeTmpEnv } from './helpers/tmp-env.js';
import { detectClaudeMem } from '../src/apply/apply-cmd.js';

const NONE = '/nonexistent/path';

// ---------------------------------------------------------------------------
// No files at all → false
// ---------------------------------------------------------------------------
test('detectClaudeMem: returns false when no files exist', () => {
  assert.equal(detectClaudeMem(NONE, NONE), false);
});

// ---------------------------------------------------------------------------
// ~/.claude.json: empty mcpServers, no plugins → false
// ---------------------------------------------------------------------------
test('detectClaudeMem: returns false when mcpServers is empty and no plugins', () => {
  const env = makeTmpEnv();
  try {
    const f = join(env.root, '.claude.json');
    writeFileSync(f, JSON.stringify({ mcpServers: {} }));
    assert.equal(detectClaudeMem(f, NONE), false);
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// ~/.claude.json: unrelated MCP servers, no plugins → false
// ---------------------------------------------------------------------------
test('detectClaudeMem: returns false with unrelated MCP servers only', () => {
  const env = makeTmpEnv();
  try {
    const f = join(env.root, '.claude.json');
    writeFileSync(f, JSON.stringify({
      mcpServers: { 'context7': { command: 'node' }, 'supabase': { command: 'npx' } },
    }));
    assert.equal(detectClaudeMem(f, NONE), false);
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// ~/.claude.json: key containing "claude-mem" → true
// ---------------------------------------------------------------------------
test('detectClaudeMem: returns true when mcpServers key contains claude-mem', () => {
  const env = makeTmpEnv();
  try {
    const f = join(env.root, '.claude.json');
    writeFileSync(f, JSON.stringify({
      mcpServers: { 'plugin_claude-mem_mcp-foo': { command: 'node' } },
    }));
    assert.equal(detectClaudeMem(f, NONE), true);
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// ~/.claude.json: key containing "mcp-search" → true
// ---------------------------------------------------------------------------
test('detectClaudeMem: returns true when mcpServers key contains mcp-search', () => {
  const env = makeTmpEnv();
  try {
    const f = join(env.root, '.claude.json');
    writeFileSync(f, JSON.stringify({
      mcpServers: { 'plugin_claude-mem_mcp-search': { command: 'node' } },
    }));
    assert.equal(detectClaudeMem(f, NONE), true);
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// ~/.claude.json: no mcpServers key, no plugins → false
// ---------------------------------------------------------------------------
test('detectClaudeMem: returns false when no mcpServers key and no plugins', () => {
  const env = makeTmpEnv();
  try {
    const f = join(env.root, '.claude.json');
    writeFileSync(f, JSON.stringify({ globalShortcut: 'ctrl+space' }));
    assert.equal(detectClaudeMem(f, NONE), false);
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Plugin system: installed_plugins.json has claude-mem → true
// ---------------------------------------------------------------------------
test('detectClaudeMem: returns true when claude-mem in installed_plugins.json', () => {
  const env = makeTmpEnv();
  try {
    const p = join(env.root, 'installed_plugins.json');
    writeFileSync(p, JSON.stringify({
      version: 2,
      plugins: { 'claude-mem@thedotmack': [{ scope: 'user', version: '12.0.0' }] },
    }));
    assert.equal(detectClaudeMem(NONE, p), true);
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Plugin system: unrelated plugins only → false
// ---------------------------------------------------------------------------
test('detectClaudeMem: returns false when plugins has no claude-mem', () => {
  const env = makeTmpEnv();
  try {
    const p = join(env.root, 'installed_plugins.json');
    writeFileSync(p, JSON.stringify({
      version: 2,
      plugins: { 'superpowers@official': [{ scope: 'user' }] },
    }));
    assert.equal(detectClaudeMem(NONE, p), false);
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Both sources: mcpServers empty but plugin installed → true
// ---------------------------------------------------------------------------
test('detectClaudeMem: plugin system wins when mcpServers is empty', () => {
  const env = makeTmpEnv();
  try {
    const f = join(env.root, '.claude.json');
    writeFileSync(f, JSON.stringify({ mcpServers: {} }));
    const p = join(env.root, 'installed_plugins.json');
    writeFileSync(p, JSON.stringify({
      version: 2,
      plugins: { 'claude-mem@thedotmack': [{ scope: 'user' }] },
    }));
    assert.equal(detectClaudeMem(f, p), true);
  } finally {
    env.cleanup();
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { makeTmpEnv } from './helpers/tmp-env.js';
import { MCP_MARKER, mergeMcpServers, removeEccTailorMcpServers } from '../src/mcp-merge.js';

const SAMPLE_SERVER = {
  name: 'context7',
  config: {
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp@latest'],
    description: 'Live documentation lookup',
  },
};

const SERVER_WITH_PLACEHOLDER = {
  name: 'exa-web-search',
  config: {
    command: 'npx',
    args: ['-y', 'exa-mcp-server'],
    env: { EXA_API_KEY: 'YOUR_EXA_API_KEY_HERE' },
    description: 'Web search via Exa',
  },
};

// ---------------------------------------------------------------------------
// mergeMcpServers: adds to empty ~/.claude.json
// ---------------------------------------------------------------------------
test('mergeMcpServers: adds servers to empty ~/.claude.json', () => {
  const env = makeTmpEnv();
  try {
    const claudeJsonPath = join(env.home, '.claude.json');

    const result = mergeMcpServers([SAMPLE_SERVER], { claudeJsonPath });

    assert.ok(existsSync(claudeJsonPath), '~/.claude.json should be created');
    const written = JSON.parse(readFileSync(claudeJsonPath, 'utf8'));
    assert.ok(written.mcpServers?.context7, 'context7 should be present');
    assert.ok(
      written.mcpServers.context7.description.startsWith(`${MCP_MARKER} `),
      'description should be prefixed with marker',
    );
    assert.deepEqual(result.added, ['context7'], 'added should list context7');
    assert.deepEqual(result.removed, [], 'removed should be empty');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// mergeMcpServers: preserves existing user MCP servers
// ---------------------------------------------------------------------------
test('mergeMcpServers: preserves existing user MCP servers', () => {
  const env = makeTmpEnv();
  try {
    const claudeJsonPath = join(env.home, '.claude.json');
    writeFileSync(
      claudeJsonPath,
      JSON.stringify({
        mcpServers: {
          'my-custom-server': {
            command: 'node',
            args: ['~/my-server.js'],
            description: 'My custom server',
          },
        },
      }, null, 2),
      'utf8',
    );

    mergeMcpServers([SAMPLE_SERVER], { claudeJsonPath });

    const written = JSON.parse(readFileSync(claudeJsonPath, 'utf8'));
    assert.ok(written.mcpServers['my-custom-server'], 'user server should be preserved');
    assert.ok(written.mcpServers['context7'], 'ecc-tailor server should be added');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// mergeMcpServers: idempotent
// ---------------------------------------------------------------------------
test('mergeMcpServers: is idempotent when run twice', () => {
  const env = makeTmpEnv();
  try {
    const claudeJsonPath = join(env.home, '.claude.json');

    mergeMcpServers([SAMPLE_SERVER], { claudeJsonPath });
    const result2 = mergeMcpServers([SAMPLE_SERVER], { claudeJsonPath });

    const written = JSON.parse(readFileSync(claudeJsonPath, 'utf8'));
    const serverCount = Object.keys(written.mcpServers ?? {}).length;
    assert.equal(serverCount, 1, 'only one server should exist after two merges');
    assert.deepEqual(result2.removed, [], 'nothing should be removed on second run');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// mergeMcpServers: removes stale ecc-tailor servers
// ---------------------------------------------------------------------------
test('mergeMcpServers: removes stale ecc-tailor servers no longer in desired set', () => {
  const env = makeTmpEnv();
  try {
    const claudeJsonPath = join(env.home, '.claude.json');

    writeFileSync(
      claudeJsonPath,
      JSON.stringify({
        mcpServers: {
          'old-server': {
            command: 'npx',
            args: ['old-mcp'],
            description: `${MCP_MARKER} Old server`,
          },
          'user-server': {
            command: 'node',
            args: ['~/user.js'],
            description: 'User server',
          },
        },
      }, null, 2),
      'utf8',
    );

    const result = mergeMcpServers([SAMPLE_SERVER], { claudeJsonPath });

    const written = JSON.parse(readFileSync(claudeJsonPath, 'utf8'));
    assert.ok(!written.mcpServers['old-server'], 'stale server should be removed');
    assert.ok(written.mcpServers['user-server'], 'user server should be preserved');
    assert.ok(written.mcpServers['context7'], 'new server should be added');
    assert.ok(result.removed.includes('old-server'), 'old-server should be in removed list');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// mergeMcpServers: detects placeholder env vars
// ---------------------------------------------------------------------------
test('mergeMcpServers: detects placeholder env vars', () => {
  const env = makeTmpEnv();
  try {
    const claudeJsonPath = join(env.home, '.claude.json');

    const result = mergeMcpServers([SERVER_WITH_PLACEHOLDER], { claudeJsonPath });

    assert.equal(result.placeholders.length, 1, 'one placeholder set should be reported');
    assert.equal(result.placeholders[0].server, 'exa-web-search');
    assert.ok(
      result.placeholders[0].envVars.some(([k]) => k === 'EXA_API_KEY'),
      'EXA_API_KEY should be in placeholders',
    );
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// removeEccTailorMcpServers: removes only marked servers
// ---------------------------------------------------------------------------
test('removeEccTailorMcpServers: removes only marker-owned servers', () => {
  const env = makeTmpEnv();
  try {
    const claudeJsonPath = join(env.home, '.claude.json');

    writeFileSync(
      claudeJsonPath,
      JSON.stringify({
        mcpServers: {
          'ecc-server': {
            command: 'npx',
            args: ['ecc-mcp'],
            description: `${MCP_MARKER} ECC managed`,
          },
          'user-server': {
            command: 'node',
            args: ['~/user.js'],
            description: 'User managed',
          },
        },
      }, null, 2),
      'utf8',
    );

    const result = removeEccTailorMcpServers({ claudeJsonPath });

    const written = JSON.parse(readFileSync(claudeJsonPath, 'utf8'));
    assert.ok(!written.mcpServers?.['ecc-server'], 'ecc-server should be removed');
    assert.ok(written.mcpServers?.['user-server'], 'user-server should remain');
    assert.ok(result.removed.includes('ecc-server'), 'ecc-server should be in removed list');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// mergeMcpServers: backup is created before modification
// ---------------------------------------------------------------------------
test('mergeMcpServers: creates backup before modification', () => {
  const env = makeTmpEnv();
  try {
    const claudeJsonPath = join(env.home, '.claude.json');
    const initial = { mcpServers: { 'existing': { command: 'node', args: [], description: 'existing' } } };
    writeFileSync(claudeJsonPath, JSON.stringify(initial, null, 2), 'utf8');

    const result = mergeMcpServers([SAMPLE_SERVER], { claudeJsonPath });

    assert.ok(existsSync(result.backupPath), 'backup file should exist');
    const backup = JSON.parse(readFileSync(result.backupPath, 'utf8'));
    assert.deepEqual(backup, initial, 'backup should contain original content');
  } finally {
    env.cleanup();
  }
});

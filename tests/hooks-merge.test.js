import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { makeTmpEnv } from './helpers/tmp-env.js';
import {
  MARKER_PREFIX,
  rewriteEccHooksJson,
  mergeHooksIntoSettings,
  removeEccTailorHooks,
} from '../src/hooks/hooks-merge.js';

// ---------------------------------------------------------------------------
// rewriteEccHooksJson: rewrites command + adds marker prefix
// ---------------------------------------------------------------------------
test('rewriteEccHooksJson: rewrites command and adds marker prefix', () => {
  const eccHooksJson = {
    hooks: {
      PreToolUse: [
        {
          description: 'Config protection',
          matcher: 'Edit',
          timeout: 10,
          hooks: [
            {
              type: 'command',
              command:
                'node /opt/ecc/run-with-flags.js pre:config-protection scripts/hooks/config-protection.js standard,strict',
            },
          ],
        },
      ],
    },
  };

  const result = rewriteEccHooksJson(eccHooksJson, '/ecc/wrapper.sh');

  assert.ok(result.PreToolUse, 'PreToolUse event should be present');
  const entry = result.PreToolUse[0];

  // description prefixed
  assert.ok(
    entry.description.startsWith(MARKER_PREFIX),
    `description should start with MARKER_PREFIX, got: ${entry.description}`,
  );

  // command rewritten
  const hook = entry.hooks[0];
  assert.equal(
    hook.command,
    'bash /ecc/wrapper.sh pre:config-protection scripts/hooks/config-protection.js standard,strict',
    'command should be rewritten to use bash wrapper',
  );

  // timeout preserved
  assert.equal(entry.timeout, 10, 'timeout should be preserved');
});

// ---------------------------------------------------------------------------
// rewriteEccHooksJson: preserves async/timeout
// ---------------------------------------------------------------------------
test('rewriteEccHooksJson: preserves async and timeout fields', () => {
  const eccHooksJson = {
    hooks: {
      PostToolUse: [
        {
          description: 'Observe',
          async: true,
          timeout: 300,
          hooks: [
            {
              type: 'command',
              command:
                'node /ecc/run-with-flags.js post:observe scripts/hooks/observe.js strict',
            },
          ],
        },
      ],
    },
  };

  const result = rewriteEccHooksJson(eccHooksJson, '/ecc/wrapper.sh');
  const entry = result.PostToolUse[0];

  assert.equal(entry.async, true, 'async should be preserved');
  assert.equal(entry.timeout, 300, 'timeout should be preserved');
});

// ---------------------------------------------------------------------------
// mergeHooksIntoSettings: appends without touching user entries
// ---------------------------------------------------------------------------
test('mergeHooksIntoSettings: appends ecc-tailor entries without touching user entries', async () => {
  const env = makeTmpEnv();
  try {
    const settingsFile = join(env.claudeDir, 'settings.json');

    // Pre-existing settings with user hooks in both PreToolUse and PostToolUse,
    // plus a top-level property that should survive the merge.
    const initialSettings = {
      statusLine: 'My status',
      hooks: {
        PreToolUse: [
          {
            description: 'My personal hook',
            hooks: [{ type: 'command', command: '~/mine.sh' }],
          },
        ],
        PostToolUse: [
          {
            description: 'My post hook',
            hooks: [{ type: 'command', command: '~/post.sh' }],
          },
        ],
      },
    };
    writeFileSync(settingsFile, JSON.stringify(initialSettings, null, 2), 'utf8');

    // Merge one ecc-tailor PreToolUse entry
    const rewrittenEvents = {
      PreToolUse: [
        {
          description: `${MARKER_PREFIX}Config protection`,
          matcher: 'Edit',
          hooks: [
            {
              type: 'command',
              command: 'bash /ecc/wrapper.sh pre:config-protection scripts/hooks/config-protection.js standard',
            },
          ],
        },
      ],
    };

    const { backupPath, addedCounts } = await mergeHooksIntoSettings(rewrittenEvents, {
      settingsFile,
    });

    // backup created
    assert.ok(existsSync(backupPath), 'backup file should exist');

    // read merged result
    const merged = JSON.parse(readFileSync(settingsFile, 'utf8'));

    // statusLine preserved
    assert.equal(merged.statusLine, 'My status', 'statusLine should be preserved');

    // PreToolUse: 2 entries (user first, ecc-tailor second)
    assert.equal(
      merged.hooks.PreToolUse.length,
      2,
      'PreToolUse should have 2 entries after merge',
    );
    assert.equal(
      merged.hooks.PreToolUse[0].description,
      'My personal hook',
      'user entry should remain first',
    );
    assert.ok(
      merged.hooks.PreToolUse[1].description.startsWith(MARKER_PREFIX),
      'ecc-tailor entry should be second',
    );

    // PostToolUse: unchanged (1 entry)
    assert.equal(
      merged.hooks.PostToolUse.length,
      1,
      'PostToolUse should be unchanged',
    );
    assert.equal(
      merged.hooks.PostToolUse[0].description,
      'My post hook',
      'PostToolUse user entry should be unchanged',
    );

    // addedCounts
    assert.equal(addedCounts.PreToolUse, 1, 'addedCounts.PreToolUse should be 1');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// removeEccTailorHooks: strips marker entries, leaves user ones
// ---------------------------------------------------------------------------
test('removeEccTailorHooks: removes marker entries and leaves user entries intact', async () => {
  const env = makeTmpEnv();
  try {
    const settingsFile = join(env.claudeDir, 'settings.json');

    const initialSettings = {
      hooks: {
        PreToolUse: [
          {
            description: 'User hook',
            hooks: [{ type: 'command', command: '~/user.sh' }],
          },
          {
            description: `${MARKER_PREFIX}ECC hook`,
            hooks: [
              {
                type: 'command',
                command: 'bash /ecc/wrapper.sh pre:ecc scripts/ecc.js standard',
              },
            ],
          },
        ],
      },
    };
    writeFileSync(settingsFile, JSON.stringify(initialSettings, null, 2), 'utf8');

    const { removed } = await removeEccTailorHooks({ settingsFile });

    assert.equal(removed, 1, 'should report 1 removed entry');

    const result = JSON.parse(readFileSync(settingsFile, 'utf8'));
    assert.equal(
      result.hooks.PreToolUse.length,
      1,
      'only user hook should remain',
    );
    assert.equal(
      result.hooks.PreToolUse[0].description,
      'User hook',
      'remaining entry should be the user hook',
    );
  } finally {
    env.cleanup();
  }
});

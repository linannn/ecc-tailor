import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { makeTmpEnv } from './helpers/tmp-env.js';
import {
  MARKER_PREFIX,
  rewriteEccHooksJson,
  filterDisabledHooks,
  mergeHooksIntoSettings,
  removeEccTailorHooks,
  isOwnedByEccTailor,
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
// filterDisabledHooks: removes entries by id
// ---------------------------------------------------------------------------
test('filterDisabledHooks: drops disabled entries and keeps others', () => {
  const events = {
    PreToolUse: [
      { id: 'pre:config-protection', description: 'keep me', hooks: [] },
      { id: 'pre:observe:continuous-learning', description: 'drop me', hooks: [] },
    ],
    Stop: [
      { id: 'stop:desktop-notify', description: 'drop me too', hooks: [] },
    ],
  };

  const result = filterDisabledHooks(events, ['pre:observe:continuous-learning', 'stop:desktop-notify']);

  assert.equal(result.PreToolUse.length, 1, 'should keep 1 PreToolUse entry');
  assert.equal(result.PreToolUse[0].id, 'pre:config-protection');
  assert.equal(result.Stop, undefined, 'Stop event should be removed when all entries disabled');
});

test('filterDisabledHooks: returns original when no disabled list', () => {
  const events = { PreToolUse: [{ id: 'pre:foo', hooks: [] }] };
  assert.deepEqual(filterDisabledHooks(events, []), events);
  assert.deepEqual(filterDisabledHooks(events, null), events);
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
// ---------------------------------------------------------------------------
// mergeHooksIntoSettings: sets env.CLAUDE_PLUGIN_ROOT when eccRoot provided
// ---------------------------------------------------------------------------
test('mergeHooksIntoSettings: sets CLAUDE_PLUGIN_ROOT in env', async () => {
  const env = makeTmpEnv();
  try {
    const settingsFile = join(env.claudeDir, 'settings.json');
    writeFileSync(settingsFile, '{}', 'utf8');

    await mergeHooksIntoSettings({}, { settingsFile, eccRoot: '/fake/ecc' });

    const result = JSON.parse(readFileSync(settingsFile, 'utf8'));
    assert.equal(result.env?.CLAUDE_PLUGIN_ROOT, '/fake/ecc', 'should set CLAUDE_PLUGIN_ROOT');
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// removeEccTailorHooks: cleans up CLAUDE_PLUGIN_ROOT env var
// ---------------------------------------------------------------------------
test('removeEccTailorHooks: removes CLAUDE_PLUGIN_ROOT from env', async () => {
  const env = makeTmpEnv();
  try {
    const settingsFile = join(env.claudeDir, 'settings.json');
    writeFileSync(settingsFile, JSON.stringify({
      env: { CLAUDE_PLUGIN_ROOT: '/fake/ecc', OTHER: 'keep' },
      hooks: {
        PreToolUse: [{ description: `${MARKER_PREFIX}test`, hooks: [] }],
      },
    }), 'utf8');

    await removeEccTailorHooks({ settingsFile });

    const result = JSON.parse(readFileSync(settingsFile, 'utf8'));
    assert.equal(result.env?.CLAUDE_PLUGIN_ROOT, undefined, 'should remove CLAUDE_PLUGIN_ROOT');
    assert.equal(result.env?.OTHER, 'keep', 'should preserve other env vars');
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

// ---------------------------------------------------------------------------
// isOwnedByEccTailor: unit tests
// ---------------------------------------------------------------------------
test('isOwnedByEccTailor: matches by description prefix', () => {
  assert.equal(
    isOwnedByEccTailor({ description: `${MARKER_PREFIX}Config protection`, hooks: [] }),
    true,
  );
});

test('isOwnedByEccTailor: matches by run-hook.sh command when description stripped', () => {
  assert.equal(
    isOwnedByEccTailor({
      matcher: 'Edit',
      hooks: [{ type: 'command', command: 'bash /home/user/.local/share/ecc-tailor/bin/run-hook.sh pre:foo scripts/foo.js standard' }],
    }),
    true,
  );
});

test('isOwnedByEccTailor: matches by CLAUDE_PLUGIN_ROOT in inline command', () => {
  assert.equal(
    isOwnedByEccTailor({
      matcher: 'Bash',
      hooks: [{ type: 'command', command: 'node -e "var e=process.env.CLAUDE_PLUGIN_ROOT;..."' }],
    }),
    true,
  );
});

test('isOwnedByEccTailor: does not match user hooks', () => {
  assert.equal(
    isOwnedByEccTailor({
      description: 'My personal hook',
      hooks: [{ type: 'command', command: '~/mine.sh' }],
    }),
    false,
  );
});

test('isOwnedByEccTailor: does not match user hooks without description', () => {
  assert.equal(
    isOwnedByEccTailor({
      matcher: 'Bash',
      hooks: [{ type: 'command', command: '~/.codeisland/codeisland-hook.sh' }],
    }),
    false,
  );
});

// ---------------------------------------------------------------------------
// mergeHooksIntoSettings: deduplicates when description stripped by Claude Code
// ---------------------------------------------------------------------------
test('mergeHooksIntoSettings: deduplicates entries whose description was stripped', async () => {
  const env = makeTmpEnv();
  try {
    const settingsFile = join(env.claudeDir, 'settings.json');

    // Simulate Claude Code having stripped the description field
    const initialSettings = {
      hooks: {
        PreToolUse: [
          {
            description: 'User hook',
            hooks: [{ type: 'command', command: '~/mine.sh' }],
          },
          {
            matcher: 'Edit',
            hooks: [{ type: 'command', command: 'bash /data/ecc-tailor/bin/run-hook.sh pre:foo scripts/foo.js standard' }],
          },
        ],
      },
    };
    writeFileSync(settingsFile, JSON.stringify(initialSettings, null, 2), 'utf8');

    const rewrittenEvents = {
      PreToolUse: [
        {
          description: `${MARKER_PREFIX}Foo`,
          matcher: 'Edit',
          hooks: [{ type: 'command', command: 'bash /data/ecc-tailor/bin/run-hook.sh pre:foo scripts/foo.js standard' }],
        },
      ],
    };

    await mergeHooksIntoSettings(rewrittenEvents, { settingsFile });

    const merged = JSON.parse(readFileSync(settingsFile, 'utf8'));
    assert.equal(
      merged.hooks.PreToolUse.length,
      2,
      'should have user hook + 1 ecc-tailor entry (not duplicated)',
    );
    assert.equal(merged.hooks.PreToolUse[0].description, 'User hook');
    assert.ok(merged.hooks.PreToolUse[1].description.startsWith(MARKER_PREFIX));
  } finally {
    env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// removeEccTailorHooks: removes entries even when description was stripped
// ---------------------------------------------------------------------------
test('removeEccTailorHooks: removes entries whose description was stripped', async () => {
  const env = makeTmpEnv();
  try {
    const settingsFile = join(env.claudeDir, 'settings.json');

    const initialSettings = {
      hooks: {
        PreToolUse: [
          {
            description: 'User hook',
            hooks: [{ type: 'command', command: '~/mine.sh' }],
          },
          {
            matcher: 'Edit',
            hooks: [{ type: 'command', command: 'bash /data/ecc-tailor/bin/run-hook.sh pre:foo scripts/foo.js standard' }],
          },
        ],
        PostToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: 'node -e "var e=process.env.CLAUDE_PLUGIN_ROOT;..."' }],
          },
        ],
      },
    };
    writeFileSync(settingsFile, JSON.stringify(initialSettings, null, 2), 'utf8');

    const { removed } = await removeEccTailorHooks({ settingsFile });

    assert.equal(removed, 2, 'should remove 2 description-stripped ecc-tailor entries');

    const result = JSON.parse(readFileSync(settingsFile, 'utf8'));
    assert.equal(result.hooks.PreToolUse.length, 1);
    assert.equal(result.hooks.PreToolUse[0].description, 'User hook');
    assert.equal(result.hooks.PostToolUse, undefined, 'empty event should be removed');
  } finally {
    env.cleanup();
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import { makeTmpEnv }  from './helpers/tmp-env.js';
import { makeFakeEcc } from './helpers/fake-ecc.js';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'ecc-tailor');

function runCli(args, env) {
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

async function installMinimalConfig(env, ecc) {
  await mkdir(join(env.xdgConfig, 'ecc-tailor'), { recursive: true });
  await writeFile(
    join(env.xdgConfig, 'ecc-tailor', 'config.json'),
    JSON.stringify({
      eccPath: ecc,
      global: {
        bundles: [],
        extras: { agents: ['planner'], skills: [], rulesLanguages: [] },
      },
      projects: [],
      hooks: { install: false },
    }),
  );
}

// ---------------------------------------------------------------------------
// Test: apply installs ~/.claude/commands/ecc-tailor.md
// ---------------------------------------------------------------------------
test('apply: installs slash command to ~/.claude/commands/ecc-tailor.md', async () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    await installMinimalConfig(env, ecc);

    const result = runCli(['apply'], env.env());

    assert.equal(result.status, 0, `CLI exited with ${result.status}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);

    const commandFile = join(env.home, '.claude', 'commands', 'ecc-tailor.md');
    assert.ok(existsSync(commandFile), `slash command file should exist at ${commandFile}`);

    const content = await readFile(commandFile, 'utf8');
    assert.ok(content.includes('ecc-tailor'), 'slash command file should contain "ecc-tailor"');
    assert.ok(content.includes('scan attach'), 'slash command file should contain "scan attach"');
  } finally {
    env.cleanup();
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readlinkSync } from 'node:fs';

import { makeTmpEnv }  from './helpers/tmp-env.js';
import { makeFakeEcc } from './helpers/fake-ecc.js';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'ecc-tailor');

function runCli(args, env) {
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

async function installRulesConfig(env, ecc) {
  await mkdir(join(env.xdgConfig, 'ecc-tailor'), { recursive: true });
  await writeFile(
    join(env.xdgConfig, 'ecc-tailor', 'config.json'),
    JSON.stringify({
      eccPath: ecc,
      global: {
        bundles: [],
        extras: { rulesLanguages: ['common'] },
      },
      projects: [],
      hooks: { install: false },
    }),
  );
}

// ---------------------------------------------------------------------------
// Test: apply with rulesLanguages creates symlink and prints notice
// ---------------------------------------------------------------------------
test('apply: rules symlink is created and notice printed', async () => {
  const env = makeTmpEnv();
  try {
    const ecc = makeFakeEcc(join(env.root, 'fake-ecc'));
    await installRulesConfig(env, ecc);

    const result = runCli(['apply'], env.env());

    assert.equal(result.status, 0, `CLI exited with ${result.status}: ${result.stderr}`);

    // Symlink should exist at ~/.claude/rules/common
    const rulesDst = join(env.home, '.claude', 'rules', 'common');
    assert.ok(existsSync(rulesDst), `rules/common symlink should exist at ${rulesDst}`);

    // Symlink should point to fake ECC's rules/common
    const target = readlinkSync(rulesDst);
    assert.equal(target, join(ecc, 'rules/common'), 'symlink should point to ECC rules/common');

    // stdout should contain "@rules/common"
    const combined = result.stdout + result.stderr;
    assert.match(combined, /@rules\/common/, 'output should contain @rules/common');

    // stdout should contain "not auto-loaded" (case insensitive)
    assert.match(combined, /not auto-loaded/i, 'output should mention "not auto-loaded"');
  } finally {
    env.cleanup();
  }
});

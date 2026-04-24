import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { makeTmpEnv } from './helpers/tmp-env.js';
import { makeFakeEcc } from './helpers/fake-ecc.js';
import { scanEcc } from '../src/fs-scan.js';

// ---------------------------------------------------------------------------
// scanEcc: lists agents/skills/rules
// ---------------------------------------------------------------------------
test('scanEcc: lists agents/skills/rules', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));
    const result = scanEcc(eccRoot);

    // planner agent found with description
    const planner = result.agents.find(a => a.name === 'planner');
    assert.ok(planner, 'planner agent should be found');
    assert.equal(planner.path, 'agents/planner.md');
    assert.equal(planner.description, 'fake planner agent');

    // coding-standards skill found
    const codingStd = result.skills.find(s => s.name === 'coding-standards');
    assert.ok(codingStd, 'coding-standards skill should be found');
    assert.equal(codingStd.path, 'skills/coding-standards');
    assert.equal(codingStd.description, 'fake coding standards');

    // agent-sort skill found
    const agentSort = result.skills.find(s => s.name === 'agent-sort');
    assert.ok(agentSort, 'agent-sort skill should be found');

    // common rule found
    const common = result.rules.find(r => r.name === 'common');
    assert.ok(common, 'common rule should be found');
    assert.equal(common.path, 'rules/common');
    assert.equal(common.description, '');
  } finally {
    tmp.cleanup();
  }
});

// ---------------------------------------------------------------------------
// scanEcc: ignores non-markdown agent files
// ---------------------------------------------------------------------------
test('scanEcc: ignores non-markdown agent files', () => {
  const tmp = makeTmpEnv();
  try {
    const eccRoot = makeFakeEcc(join(tmp.root, 'fake-ecc'));

    // Add a .txt file to agents/
    writeFileSync(join(eccRoot, 'agents', 'not-an-agent.txt'), 'hello\n', 'utf8');

    const result = scanEcc(eccRoot);

    const names = result.agents.map(a => a.name);
    assert.ok(!names.includes('not-an-agent'), '.txt file should not appear in agents');
    // .md files still present
    assert.ok(names.includes('planner'), 'planner.md should still be listed');
  } finally {
    tmp.cleanup();
  }
});

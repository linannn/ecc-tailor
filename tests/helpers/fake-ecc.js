import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { git } from '../../src/util/git.js';

/**
 * Create a minimal fake ECC checkout at `root` and return `root`.
 *
 * @param {string} root
 * @returns {string}
 */
export function makeFakeEcc(root) {
  // agents/planner.md
  const agentsDir = join(root, 'agents');
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(
    join(agentsDir, 'planner.md'),
    '---\nname: planner\ndescription: fake planner agent\n---\n',
    'utf8',
  );

  // skills/coding-standards/SKILL.md
  const codingStdDir = join(root, 'skills', 'coding-standards');
  mkdirSync(codingStdDir, { recursive: true });
  writeFileSync(
    join(codingStdDir, 'SKILL.md'),
    '---\nname: coding-standards\ndescription: fake coding standards\n---\n',
    'utf8',
  );

  // skills/agent-sort/SKILL.md
  const agentSortDir = join(root, 'skills', 'agent-sort');
  mkdirSync(agentSortDir, { recursive: true });
  writeFileSync(
    join(agentSortDir, 'SKILL.md'),
    '---\nname: agent-sort\ndescription: fake agent-sort\n---\n',
    'utf8',
  );

  // rules/common/style.md
  const rulesDir = join(root, 'rules', 'common');
  mkdirSync(rulesDir, { recursive: true });
  writeFileSync(join(rulesDir, 'style.md'), '# Style\n', 'utf8');

  // hooks/hooks.json
  const hooksDir = join(root, 'hooks');
  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(
    join(hooksDir, 'hooks.json'),
    JSON.stringify({ hooks: { PreToolUse: [] } }, null, 2) + '\n',
    'utf8',
  );

  // scripts/hooks/run-with-flags.js
  const scriptsDir = join(root, 'scripts', 'hooks');
  mkdirSync(scriptsDir, { recursive: true });
  writeFileSync(
    join(scriptsDir, 'run-with-flags.js'),
    '// placeholder\n',
    'utf8',
  );

  // Init git repo with one commit
  git(['init'], { cwd: root });
  git(['config', 'user.email', 'test@example.com'], { cwd: root });
  git(['config', 'user.name', 'Test'], { cwd: root });
  git(['add', '.'], { cwd: root });
  git(['commit', '-m', 'init fake ecc'], { cwd: root });

  return root;
}

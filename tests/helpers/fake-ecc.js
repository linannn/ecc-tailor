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
  // agents/planner.md — references /docs
  const agentsDir = join(root, 'agents');
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(
    join(agentsDir, 'planner.md'),
    '---\nname: planner\ndescription: fake planner agent\n---\n\nUse `/docs` to look things up.\n',
    'utf8',
  );

  // agents/doc-updater.md — references /update-docs and /update-codemaps
  writeFileSync(
    join(agentsDir, 'doc-updater.md'),
    '---\nname: doc-updater\ndescription: fake doc updater agent\n---\n\nRun `/update-docs` then `/update-codemaps` when done.\n',
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

  // skills used by the scan bundle
  for (const skillName of [
    'agent-sort', 'skill-stocktake', 'repo-scan',
    'workspace-surface-audit', 'ecc-tools-cost-audit',
    'rules-distill', 'agent-eval', 'skill-comply',
    'codebase-onboarding', 'configure-ecc', 'context-budget',
  ]) {
    const skillDir = join(root, 'skills', skillName);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---\nname: ${skillName}\ndescription: fake ${skillName}\n---\n`,
      'utf8',
    );
  }

  // contexts/*.md
  const contextsDir = join(root, 'contexts');
  mkdirSync(contextsDir, { recursive: true });
  for (const ctx of ['dev', 'research', 'review']) {
    writeFileSync(join(contextsDir, `${ctx}.md`), `# ${ctx} context\n`, 'utf8');
  }

  // commands/*.md
  const commandsDir = join(root, 'commands');
  mkdirSync(commandsDir, { recursive: true });
  for (const cmd of ['update-docs', 'eval', 'docs', 'update-codemaps']) {
    writeFileSync(join(commandsDir, `${cmd}.md`), `# /${cmd}\n`, 'utf8');
  }

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

  // mcp-configs/mcp-servers.json
  const mcpConfigDir = join(root, 'mcp-configs');
  mkdirSync(mcpConfigDir, { recursive: true });
  writeFileSync(
    join(mcpConfigDir, 'mcp-servers.json'),
    JSON.stringify({
      mcpServers: {
        'context7': {
          command: 'npx',
          args: ['-y', '@upstash/context7-mcp@latest'],
          description: 'Live documentation lookup',
        },
        'exa-web-search': {
          command: 'npx',
          args: ['-y', 'exa-mcp-server'],
          env: { EXA_API_KEY: 'YOUR_EXA_API_KEY_HERE' },
          description: 'Web search via Exa API',
        },
        'memory': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-memory'],
          description: 'Persistent memory across sessions',
        },
      },
    }, null, 2) + '\n',
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

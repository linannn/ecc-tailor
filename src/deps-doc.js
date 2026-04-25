import { loadBundles } from './bundles.js';
import { scanEcc } from './fs-scan.js';
import { scanCommandDeps } from './deps-scan.js';

const STRINGS = {
  en: {
    title: '# Dependency Map',
    subtitle: 'Auto-generated reference showing which agents/skills depend on which commands and MCP servers.',
    cmdTitle: '## Command Dependencies',
    cmdDesc: 'Commands auto-detected from `/command-name` references in agent/skill content.',
    cmdColCmd: 'Command',
    cmdColRef: 'Referenced By',
    cmdNone: 'No command dependencies detected.',
    mcpTitle: '## MCP Server → Bundle Mapping',
    mcpDesc: 'MCP servers assigned to bundles in `manifests/bundles.json`.',
    mcpColServer: 'MCP Server',
    mcpColBundle: 'Bundles',
    unassignedTitle: '### Unassigned MCP Servers',
    unassignedDesc: 'Available via `extras.mcp` but not in any bundle:',
    unrefTitle: '## Unreferenced Commands',
    unrefDesc: (n) => `${n} commands not referenced by any agent or skill:`,
  },
  zh: {
    title: '# 依赖关系',
    subtitle: '自动生成的参考文档，展示 agent/skill 依赖了哪些 command 和 MCP server。',
    cmdTitle: '## Command 依赖',
    cmdDesc: '通过扫描 agent/skill 内容中的 `/command-name` 引用自动检测。',
    cmdColCmd: 'Command',
    cmdColRef: '被引用方',
    cmdNone: '未检测到 command 依赖。',
    mcpTitle: '## MCP Server → Bundle 映射',
    mcpDesc: '在 `manifests/bundles.json` 中分配到 bundle 的 MCP server。',
    mcpColServer: 'MCP Server',
    mcpColBundle: 'Bundle',
    unassignedTitle: '### 未分配的 MCP Server',
    unassignedDesc: '可通过 `extras.mcp` 手动添加，但不在任何 bundle 中：',
    unrefTitle: '## 未被引用的 Command',
    unrefDesc: (n) => `${n} 个 command 未被任何 agent 或 skill 引用：`,
  },
};

function buildDepsData(eccRoot) {
  const bundles = loadBundles();
  const inv = scanEcc(eccRoot);
  const commandNames = new Set(inv.commands.map(c => c.name));

  const allAgents = inv.agents.map(a => a.name);
  const allSkills = inv.skills.map(s => s.name);
  const cmdDeps = scanCommandDeps(allAgents, allSkills, eccRoot, commandNames);

  const mcpToBundles = new Map();
  for (const [bundleName, def] of Object.entries(bundles)) {
    for (const mcpName of (def.mcp ?? [])) {
      if (!mcpToBundles.has(mcpName)) mcpToBundles.set(mcpName, []);
      mcpToBundles.get(mcpName).push(bundleName);
    }
  }

  const allMcpNames = new Set(inv.mcpServers.map(s => s.name));
  const assignedMcp = new Set(mcpToBundles.keys());
  const unassignedMcp = [...allMcpNames].filter(n => !assignedMcp.has(n)).sort();

  const referencedCmds = new Set(cmdDeps.keys());
  const unreferencedCmds = inv.commands.map(c => c.name).filter(n => !referencedCmds.has(n)).sort();

  return { cmdDeps, mcpToBundles, unassignedMcp, unreferencedCmds };
}

function renderDepsDoc(data, lang) {
  const s = STRINGS[lang];
  const { cmdDeps, mcpToBundles, unassignedMcp, unreferencedCmds } = data;
  const lines = [];

  lines.push(s.title);
  lines.push('');
  lines.push(s.subtitle);
  lines.push('');

  lines.push(s.cmdTitle);
  lines.push('');
  lines.push(s.cmdDesc);
  lines.push('');

  if (cmdDeps.size > 0) {
    lines.push(`| ${s.cmdColCmd} | ${s.cmdColRef} |`);
    lines.push('|---|---|');
    const sorted = [...cmdDeps.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [cmd, sources] of sorted) {
      const srcList = [...sources].sort().join(', ');
      lines.push(`| \`/${cmd}\` | ${srcList} |`);
    }
  } else {
    lines.push(s.cmdNone);
  }

  lines.push('');
  lines.push(s.mcpTitle);
  lines.push('');
  lines.push(s.mcpDesc);
  lines.push('');

  if (mcpToBundles.size > 0) {
    lines.push(`| ${s.mcpColServer} | ${s.mcpColBundle} |`);
    lines.push('|---|---|');
    const sorted = [...mcpToBundles.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [mcp, bundleList] of sorted) {
      lines.push(`| \`${mcp}\` | ${bundleList.join(', ')} |`);
    }
  }

  lines.push('');

  if (unassignedMcp.length > 0) {
    lines.push(s.unassignedTitle);
    lines.push('');
    lines.push(s.unassignedDesc);
    lines.push('');
    for (const name of unassignedMcp) {
      lines.push(`- \`${name}\``);
    }
    lines.push('');
  }

  if (unreferencedCmds.length > 0) {
    lines.push(s.unrefTitle);
    lines.push('');
    lines.push(s.unrefDesc(unreferencedCmds.length));
    lines.push('');
    for (const name of unreferencedCmds) {
      lines.push(`- \`/${name}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * @param {string} eccRoot
 * @returns {string}
 */
export function generateDepsDoc(eccRoot) {
  return renderDepsDoc(buildDepsData(eccRoot), 'en');
}

/**
 * @param {string} eccRoot
 * @returns {string}
 */
export function generateDepsDocZh(eccRoot) {
  return renderDepsDoc(buildDepsData(eccRoot), 'zh');
}

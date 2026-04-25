import { loadBundles, resolveBundle } from './bundles.js';
import { scanEcc } from './fs-scan.js';
import { scanCommandDeps, scanMcpDeps } from './deps-scan.js';

const STRINGS = {
  en: {
    title: '# Dependency Map',
    subtitle: 'Auto-generated. Shows the full dependency chain: resource → who needs it → which bundle.',
    cmdTitle: '## Command Dependencies',
    cmdDesc: 'Auto-detected from `/command-name` references in agent/skill content during `resolve`.',
    cmdCol1: 'Command',
    cmdCol2: 'Required By',
    cmdCol3: 'Bundle',
    cmdNone: 'No command dependencies detected.',
    mcpTitle: '## MCP Server Dependencies',
    mcpDesc: 'MCP servers configured in bundle definitions. Agent/skill references detected from `mcp__name__` tool calls and `"name"` in config blocks.',
    mcpCol1: 'MCP Server',
    mcpCol2: 'Referenced By',
    mcpCol3: 'Bundle',
    unassignedTitle: '### Unassigned MCP Servers',
    unassignedDesc: 'Available via `extras.mcp` but not in any bundle:',
    unrefTitle: '## Unreferenced Commands',
    unrefDesc: (n) => `${n} commands not referenced by any agent or skill (add via \`extras.commands\`):`,
  },
  zh: {
    title: '# 依赖关系',
    subtitle: '自动生成。展示完整依赖链路：资源 → 谁需要它 → 所属 bundle。',
    cmdTitle: '## Command 依赖',
    cmdDesc: '`resolve` 阶段扫描 agent/skill 内容中的 `/command-name` 引用自动检测。',
    cmdCol1: 'Command',
    cmdCol2: '依赖方',
    cmdCol3: 'Bundle',
    cmdNone: '未检测到 command 依赖。',
    mcpTitle: '## MCP Server 依赖',
    mcpDesc: '在 bundle 定义中配置的 MCP server。agent/skill 引用通过 `mcp__name__` 工具调用和配置块中的 `"name"` 检测。',
    mcpCol1: 'MCP Server',
    mcpCol2: '引用方',
    mcpCol3: 'Bundle',
    unassignedTitle: '### 未分配的 MCP Server',
    unassignedDesc: '可通过 `extras.mcp` 手动添加，但不在任何 bundle 中：',
    unrefTitle: '## 未被引用的 Command',
    unrefDesc: (n) => `${n} 个 command 未被任何 agent/skill 引用（可通过 \`extras.commands\` 手动添加）：`,
  },
};

/**
 * Build reverse map: agent/skill name → Set<bundleName>.
 */
function buildItemToBundles(bundles) {
  const agentToBundles = new Map();
  const skillToBundles = new Map();

  for (const [bundleName, def] of Object.entries(bundles)) {
    if (def.ephemeral) continue;
    let resolved;
    try { resolved = resolveBundle(bundles, bundleName); } catch { continue; }

    for (const a of resolved.agents) {
      if (!agentToBundles.has(a)) agentToBundles.set(a, new Set());
      agentToBundles.get(a).add(bundleName);
    }
    for (const s of resolved.skills) {
      if (!skillToBundles.has(s)) skillToBundles.set(s, new Set());
      skillToBundles.get(s).add(bundleName);
    }
  }

  return { agentToBundles, skillToBundles };
}

/**
 * Given a source like "agent:doc-updater", look up its bundles.
 */
function sourceBundles(source, agentToBundles, skillToBundles) {
  const [kind, name] = source.split(':');
  const map = kind === 'agent' ? agentToBundles : skillToBundles;
  return map.get(name) ?? new Set();
}

function buildDepsData(eccRoot) {
  const bundles = loadBundles();
  const inv = scanEcc(eccRoot);
  const commandNames = new Set(inv.commands.map(c => c.name));
  const mcpServerNames = new Set(inv.mcpServers.map(s => s.name));

  const allAgents = inv.agents.map(a => a.name);
  const allSkills = inv.skills.map(s => s.name);
  const cmdDeps = scanCommandDeps(allAgents, allSkills, eccRoot, commandNames);
  const mcpDeps = scanMcpDeps(allAgents, allSkills, eccRoot, mcpServerNames);

  const { agentToBundles, skillToBundles } = buildItemToBundles(bundles);

  // command rows: command → sources → bundles
  const cmdRows = [];
  for (const [cmd, sources] of [...cmdDeps.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const srcList = [...sources].sort();
    const bundleSet = new Set();
    for (const src of srcList) {
      for (const b of sourceBundles(src, agentToBundles, skillToBundles)) bundleSet.add(b);
    }
    cmdRows.push({ name: cmd, sources: srcList, bundles: [...bundleSet].sort() });
  }

  // MCP bundle mapping (from bundles.json mcp arrays)
  const mcpToBundles = new Map();
  for (const [bundleName, def] of Object.entries(bundles)) {
    for (const mcpName of (def.mcp ?? [])) {
      if (!mcpToBundles.has(mcpName)) mcpToBundles.set(mcpName, []);
      mcpToBundles.get(mcpName).push(bundleName);
    }
  }

  // MCP rows: mcp → sources (from scan) → bundles (from bundles.json)
  const mcpRows = [];
  const allAssigned = new Set(mcpToBundles.keys());
  const allScanned = new Set(mcpDeps.keys());
  const allMcpWithInfo = new Set([...allAssigned, ...allScanned]);

  for (const name of [...allMcpWithInfo].sort()) {
    const sources = mcpDeps.get(name);
    const bundleList = mcpToBundles.get(name) ?? [];
    mcpRows.push({
      name,
      sources: sources ? [...sources].sort() : [],
      bundles: bundleList,
    });
  }

  const assignedMcp = new Set(mcpToBundles.keys());
  const unassignedMcp = [...mcpServerNames].filter(n => !assignedMcp.has(n) && !allScanned.has(n)).sort();

  const referencedCmds = new Set(cmdDeps.keys());
  const unreferencedCmds = inv.commands.map(c => c.name).filter(n => !referencedCmds.has(n)).sort();

  return { cmdRows, mcpRows, unassignedMcp, unreferencedCmds };
}

function renderDepsDoc(data, lang) {
  const s = STRINGS[lang];
  const { cmdRows, mcpRows, unassignedMcp, unreferencedCmds } = data;
  const lines = [];

  lines.push(s.title);
  lines.push('');
  lines.push(s.subtitle);
  lines.push('');

  // Command dependencies: command → agent/skill → bundle
  lines.push(s.cmdTitle);
  lines.push('');
  lines.push(s.cmdDesc);
  lines.push('');

  if (cmdRows.length > 0) {
    lines.push(`| ${s.cmdCol1} | ${s.cmdCol2} | ${s.cmdCol3} |`);
    lines.push('|---|---|---|');
    for (const { name, sources, bundles } of cmdRows) {
      const srcStr = sources.join(', ');
      const bundleStr = bundles.length > 0 ? bundles.join(', ') : '—';
      lines.push(`| \`/${name}\` | ${srcStr} | ${bundleStr} |`);
    }
  } else {
    lines.push(s.cmdNone);
  }

  lines.push('');

  // MCP dependencies: mcp → agent/skill → bundle
  lines.push(s.mcpTitle);
  lines.push('');
  lines.push(s.mcpDesc);
  lines.push('');

  if (mcpRows.length > 0) {
    lines.push(`| ${s.mcpCol1} | ${s.mcpCol2} | ${s.mcpCol3} |`);
    lines.push('|---|---|---|');
    for (const { name, sources, bundles } of mcpRows) {
      const srcStr = sources.length > 0 ? sources.join(', ') : '—';
      const bundleStr = bundles.length > 0 ? bundles.join(', ') : '—';
      lines.push(`| \`${name}\` | ${srcStr} | ${bundleStr} |`);
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

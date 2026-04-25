import { loadBundles } from './bundles.js';
import { scanEcc } from './fs-scan.js';
import { scanCommandDeps } from './deps-scan.js';

/**
 * Generate dependency map markdown content.
 * Scans ALL agents and skills in every bundle for command references.
 * Also lists MCP → bundle mapping.
 *
 * @param {string} eccRoot
 * @returns {string} Markdown content
 */
export function generateDepsDoc(eccRoot) {
  const bundles = loadBundles();
  const inv = scanEcc(eccRoot);
  const commandNames = new Set(inv.commands.map(c => c.name));

  const lines = [];
  lines.push('# Dependency Map');
  lines.push('');
  lines.push('Auto-generated reference showing which agents/skills depend on which commands and MCP servers.');
  lines.push('');

  lines.push('## Command Dependencies');
  lines.push('');
  lines.push('Commands auto-detected from `/command-name` references in agent/skill content.');
  lines.push('');

  const allAgents = inv.agents.map(a => a.name);
  const allSkills = inv.skills.map(s => s.name);
  const cmdDeps = scanCommandDeps(allAgents, allSkills, eccRoot, commandNames);

  if (cmdDeps.size > 0) {
    lines.push('| Command | Referenced By |');
    lines.push('|---|---|');
    const sorted = [...cmdDeps.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [cmd, sources] of sorted) {
      const srcList = [...sources].sort().join(', ');
      lines.push(`| \`/${cmd}\` | ${srcList} |`);
    }
  } else {
    lines.push('No command dependencies detected.');
  }

  lines.push('');

  lines.push('## MCP Server → Bundle Mapping');
  lines.push('');
  lines.push('MCP servers assigned to bundles in `manifests/bundles.json`.');
  lines.push('');

  const mcpToBundles = new Map();
  for (const [bundleName, def] of Object.entries(bundles)) {
    for (const mcpName of (def.mcp ?? [])) {
      if (!mcpToBundles.has(mcpName)) mcpToBundles.set(mcpName, []);
      mcpToBundles.get(mcpName).push(bundleName);
    }
  }

  if (mcpToBundles.size > 0) {
    lines.push('| MCP Server | Bundles |');
    lines.push('|---|---|');
    const sorted = [...mcpToBundles.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [mcp, bundleList] of sorted) {
      lines.push(`| \`${mcp}\` | ${bundleList.join(', ')} |`);
    }
  }

  lines.push('');

  const allMcpNames = new Set(inv.mcpServers.map(s => s.name));
  const assignedMcp = new Set(mcpToBundles.keys());
  const unassignedMcp = [...allMcpNames].filter(n => !assignedMcp.has(n)).sort();

  if (unassignedMcp.length > 0) {
    lines.push('### Unassigned MCP Servers');
    lines.push('');
    lines.push('Available via `extras.mcp` but not in any bundle:');
    lines.push('');
    for (const name of unassignedMcp) {
      lines.push(`- \`${name}\``);
    }
    lines.push('');
  }

  const referencedCmds = new Set(cmdDeps.keys());
  const unreferencedCmds = inv.commands.map(c => c.name).filter(n => !referencedCmds.has(n)).sort();

  if (unreferencedCmds.length > 0) {
    lines.push('## Unreferenced Commands');
    lines.push('');
    lines.push(`${unreferencedCmds.length} commands not referenced by any agent or skill:`);
    lines.push('');
    for (const name of unreferencedCmds) {
      lines.push(`- \`/${name}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}

import { resolveBundle } from '../core/bundles.js';

/**
 * Build provenance report: for each installed item, track what brought it in.
 *
 * @param {object} config
 * @param {object} bundles
 * @param {Array<object>} desiredEntries - Output of resolveDesired
 * @param {Array<{name: string}>} mcpServers - Output of resolveMcp
 * @returns {{
 *   commands: Array<{ name: string, sources: string[], auto: boolean }>,
 *   mcp: Array<{ name: string, sources: string[] }>,
 * }}
 */
export function buildProvenance(config, bundles, desiredEntries, mcpServers) {
  const report = { commands: [], mcp: [] };

  for (const entry of desiredEntries) {
    if (entry.kind !== 'command') continue;
    const name = entry.eccSrc.replace(/^commands\//, '').replace(/\.md$/, '');
    if (name === 'ecc-tailor') continue;

    if (entry.autoDep) {
      report.commands.push({ name, sources: entry.requiredBy ?? [], auto: true });
    } else {
      report.commands.push({ name, sources: ['extras (manual)'], auto: false });
    }
  }

  const mcpNames = new Set(mcpServers.map(s => s.name));
  const mcpSources = new Map();

  for (const bundleName of (config.global?.bundles ?? [])) {
    try {
      const resolved = resolveBundle(bundles, bundleName);
      for (const mcpName of (resolved.mcp ?? [])) {
        if (mcpNames.has(mcpName)) {
          if (!mcpSources.has(mcpName)) mcpSources.set(mcpName, []);
          mcpSources.get(mcpName).push(`bundle:${bundleName}`);
        }
      }
    } catch { /* skip invalid */ }
  }

  for (const proj of (config.projects ?? [])) {
    for (const bundleName of (proj.bundles ?? [])) {
      try {
        const resolved = resolveBundle(bundles, bundleName);
        for (const mcpName of (resolved.mcp ?? [])) {
          if (mcpNames.has(mcpName)) {
            if (!mcpSources.has(mcpName)) mcpSources.set(mcpName, []);
            mcpSources.get(mcpName).push(`bundle:${bundleName}`);
          }
        }
      } catch { /* skip */ }
    }
  }

  for (const mcpName of (config.global?.extras?.mcp ?? [])) {
    if (mcpNames.has(mcpName)) {
      if (!mcpSources.has(mcpName)) mcpSources.set(mcpName, []);
      mcpSources.get(mcpName).push('extras (manual)');
    }
  }

  for (const [name, sources] of mcpSources) {
    report.mcp.push({ name, sources: [...new Set(sources)] });
  }

  return report;
}

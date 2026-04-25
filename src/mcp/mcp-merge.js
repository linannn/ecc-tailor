import { copyFileSync } from 'node:fs';
import { readJson, writeJsonAtomic } from '../util/json.js';

export const MCP_MARKER = '[ecc-tailor]';

const PLACEHOLDER_RE = /^YOUR_.*_HERE$/;

/**
 * Merge selected MCP servers into ~/.claude.json.
 *
 * @param {Array<{ name: string, config: object }>} selectedServers
 * @param {{ claudeJsonPath: string }} opts
 * @returns {{ backupPath: string, added: string[], removed: string[], placeholders: Array<{ server: string, envVars: [string, string][] }> }}
 */
export function mergeMcpServers(selectedServers, { claudeJsonPath }) {
  const claudeJson = readJson(claudeJsonPath) ?? {};

  const backupPath = `${claudeJsonPath}.bak.${new Date().toISOString()}`;
  try {
    copyFileSync(claudeJsonPath, backupPath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const existing = claudeJson.mcpServers ?? {};

  const removed = [];
  const kept = {};
  for (const [name, cfg] of Object.entries(existing)) {
    const desc = cfg.description ?? '';
    if (desc.startsWith(`${MCP_MARKER} `)) {
      removed.push(name);
    } else {
      kept[name] = cfg;
    }
  }

  const added = [];
  const placeholders = [];
  const merged = { ...kept };

  for (const { name, config } of selectedServers) {
    const originalDesc = config.description ?? '';
    const prefixedDesc = originalDesc.startsWith(`${MCP_MARKER} `)
      ? originalDesc
      : `${MCP_MARKER} ${originalDesc}`;

    merged[name] = { ...config, description: prefixedDesc };

    if (!existing[name] || !(existing[name].description ?? '').startsWith(`${MCP_MARKER} `)) {
      added.push(name);
    }

    const envVars = [];
    for (const [key, val] of Object.entries(config.env ?? {})) {
      if (PLACEHOLDER_RE.test(val)) {
        envVars.push([key, val]);
      }
    }
    if (envVars.length > 0) {
      placeholders.push({ server: name, envVars });
    }
  }

  const selectedNames = new Set(selectedServers.map(s => s.name));
  const actualRemoved = removed.filter(n => !selectedNames.has(n));

  claudeJson.mcpServers = merged;
  writeJsonAtomic(claudeJsonPath, claudeJson);

  return { backupPath, added, removed: actualRemoved, placeholders };
}

/**
 * Remove all ecc-tailor-managed MCP servers from ~/.claude.json.
 *
 * @param {{ claudeJsonPath: string }} opts
 * @returns {{ removed: string[] }}
 */
export function removeEccTailorMcpServers({ claudeJsonPath }) {
  const claudeJson = readJson(claudeJsonPath) ?? {};
  const existing = claudeJson.mcpServers ?? {};

  const removed = [];
  const kept = {};
  for (const [name, cfg] of Object.entries(existing)) {
    const desc = cfg.description ?? '';
    if (desc.startsWith(`${MCP_MARKER} `)) {
      removed.push(name);
    } else {
      kept[name] = cfg;
    }
  }

  if (Object.keys(kept).length === 0) {
    delete claudeJson.mcpServers;
  } else {
    claudeJson.mcpServers = kept;
  }

  writeJsonAtomic(claudeJsonPath, claudeJson);

  return { removed };
}

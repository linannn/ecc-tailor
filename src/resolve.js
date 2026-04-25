import { join } from 'node:path';
import { resolveBundles } from './bundles.js';

/**
 * Compute the full list of symlinks that should exist based on config,
 * bundle definitions, and ECC inventory.
 *
 * @param {object} config   - Loaded config (from config.js)
 * @param {object} bundles  - Raw bundle definitions (from bundles.js loadBundles())
 * @param {object} inv      - ECC inventory (from fs-scan.js scanEcc())
 * @param {{ home: string }} opts
 * @returns {Array<{
 *   dst: string,
 *   eccSrc: string,
 *   kind: 'agent' | 'skill-dir' | 'rules-dir',
 *   ownedBy: 'global' | string,
 *   ephemeral: boolean,
 * }>}
 */
export function resolveDesired(config, bundles, inv, { home }) {
  const result = [];

  // Build lookup sets for fast validation
  const agentNames   = new Set(inv.agents.map(a => a.name));
  const skillNames   = new Set(inv.skills.map(s => s.name));
  const ruleNames    = new Set(inv.rules.map(r => r.name));
  const commandNames = new Set(inv.commands.map(c => c.name));
  const contextNames = new Set((inv.contexts ?? []).map(c => c.name));

  // -------------------------------------------------------------------------
  // Global layer
  // -------------------------------------------------------------------------
  const globalCfg = config.global ?? {};
  const globalBundleNames = globalCfg.bundles ?? [];
  const globalExtras   = globalCfg.extras   ?? {};
  const globalExcludes = globalCfg.excludes  ?? {};

  // Resolve bundles → initial agent/skill lists
  const resolved = resolveBundles(bundles, globalBundleNames);
  const ephemeral = resolved.ephemeral;

  // Union with extras
  let globalAgents = dedupe([...resolved.agents, ...(globalExtras.agents ?? [])]);
  let globalSkills = dedupe([...resolved.skills, ...(globalExtras.skills ?? [])]);

  // Remove excludes
  const excludeAgents = new Set(globalExcludes.agents ?? []);
  const excludeSkills = new Set(globalExcludes.skills ?? []);
  globalAgents = globalAgents.filter(n => !excludeAgents.has(n));
  globalSkills = globalSkills.filter(n => !excludeSkills.has(n));

  // Validate and emit agent entries
  for (const name of globalAgents) {
    if (!agentNames.has(name)) {
      throw new Error(`agent "${name}" not found in ECC`);
    }
    result.push({
      dst: join(home, '.claude', 'agents', `${name}.md`),
      eccSrc: `agents/${name}.md`,
      kind: 'agent',
      ownedBy: 'global',
      ephemeral,
    });
  }

  // Validate and emit skill entries
  for (const name of globalSkills) {
    if (!skillNames.has(name)) {
      throw new Error(`skill "${name}" not found in ECC`);
    }
    result.push({
      dst: join(home, '.claude', 'skills', name),
      eccSrc: `skills/${name}`,
      kind: 'skill-dir',
      ownedBy: 'global',
      ephemeral,
    });
  }

  // Rules layer (global only)
  for (const lang of (globalExtras.rulesLanguages ?? [])) {
    if (!ruleNames.has(lang)) {
      throw new Error(`rule "${lang}" not found in ECC`);
    }
    result.push({
      dst: join(home, '.claude', 'rules', lang),
      eccSrc: `rules/${lang}`,
      kind: 'rules-dir',
      ownedBy: 'global',
      ephemeral: false,
    });
  }

  // Commands (global only, per-file symlink)
  for (const name of (globalExtras.commands ?? [])) {
    if (!commandNames.has(name)) {
      throw new Error(`command "${name}" not found in ECC`);
    }
    result.push({
      dst: join(home, '.claude', 'commands', `${name}.md`),
      eccSrc: `commands/${name}.md`,
      kind: 'command',
      ownedBy: 'global',
      ephemeral: false,
    });
  }

  // Contexts (global only, per-file symlink)
  for (const name of (globalExtras.contexts ?? [])) {
    if (!contextNames.has(name)) {
      throw new Error(`context "${name}" not found in ECC`);
    }
    result.push({
      dst: join(home, '.claude', 'contexts', `${name}.md`),
      eccSrc: `contexts/${name}.md`,
      kind: 'context',
      ownedBy: 'global',
      ephemeral: false,
    });
  }

  // -------------------------------------------------------------------------
  // Project layers
  // -------------------------------------------------------------------------
  for (const proj of (config.projects ?? [])) {
    const projPath = proj.path;
    const projBundleNames = proj.bundles ?? [];
    const projExtras   = proj.extras   ?? {};
    const projExcludes = proj.excludes  ?? {};

    const projResolved = resolveBundles(bundles, projBundleNames);
    const projEphemeral = projResolved.ephemeral;
    const ownedBy = `proj:${projPath}`;

    let projAgents = dedupe([...projResolved.agents, ...(projExtras.agents ?? [])]);
    let projSkills = dedupe([...projResolved.skills, ...(projExtras.skills ?? [])]);

    const projExcludeAgents = new Set(projExcludes.agents ?? []);
    const projExcludeSkills = new Set(projExcludes.skills ?? []);
    projAgents = projAgents.filter(n => !projExcludeAgents.has(n));
    projSkills = projSkills.filter(n => !projExcludeSkills.has(n));

    for (const name of projAgents) {
      if (!agentNames.has(name)) {
        throw new Error(`agent "${name}" not found in ECC`);
      }
      result.push({
        dst: join(projPath, '.claude', 'agents', `${name}.md`),
        eccSrc: `agents/${name}.md`,
        kind: 'agent',
        ownedBy,
        ephemeral: projEphemeral,
      });
    }

    for (const name of projSkills) {
      if (!skillNames.has(name)) {
        throw new Error(`skill "${name}" not found in ECC`);
      }
      result.push({
        dst: join(projPath, '.claude', 'skills', name),
        eccSrc: `skills/${name}`,
        kind: 'skill-dir',
        ownedBy,
        ephemeral: projEphemeral,
      });
    }
  }

  // Dedup within each layer by dst (keep first occurrence)
  return dedupByDst(result);
}

/** Return array with duplicates removed (first occurrence wins). */
function dedupe(arr) {
  return [...new Set(arr)];
}

/**
 * Resolve desired MCP servers based on config and bundles.
 * MCP is global-only (goes to ~/.claude.json), but project bundles
 * contribute their MCP servers to the global set.
 *
 * @param {object} config
 * @param {object} bundles
 * @param {Array<{ name: string, config: object, description: string }>} mcpCatalog
 * @returns {Array<{ name: string, config: object }>}
 */
export function resolveMcp(config, bundles, mcpCatalog) {
  const catalogMap = new Map(mcpCatalog.map(s => [s.name, s.config]));

  const globalCfg = config.global ?? {};
  const globalBundleNames = globalCfg.bundles ?? [];
  const globalExtras = (globalCfg.extras ?? {}).mcp ?? [];
  const globalExcludes = new Set((globalCfg.excludes ?? {}).mcp ?? []);

  const globalResolved = resolveBundles(bundles, globalBundleNames);
  let names = dedupe([...globalResolved.mcp, ...globalExtras]);

  for (const proj of (config.projects ?? [])) {
    const projBundleNames = proj.bundles ?? [];
    const projExtras = (proj.extras ?? {}).mcp ?? [];
    const projExcludes = new Set((proj.excludes ?? {}).mcp ?? []);

    const projResolved = resolveBundles(bundles, projBundleNames);
    let projNames = dedupe([...projResolved.mcp, ...projExtras]);
    projNames = projNames.filter(n => !projExcludes.has(n));

    names = dedupe([...names, ...projNames]);
  }

  names = names.filter(n => !globalExcludes.has(n));

  return names.map(name => {
    if (!catalogMap.has(name)) {
      throw new Error(`MCP server "${name}" not found in ECC catalog`);
    }
    return { name, config: catalogMap.get(name) };
  });
}

/** Dedup an array of link objects by dst, keeping first occurrence. */
function dedupByDst(entries) {
  const seen = new Set();
  return entries.filter(e => {
    if (seen.has(e.dst)) return false;
    seen.add(e.dst);
    return true;
  });
}

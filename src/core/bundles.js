import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const BUNDLES_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'manifests', 'bundles.json');

/**
 * Read and parse manifests/bundles.json.
 *
 * @returns {object} Raw bundle manifest map.
 */
export function loadBundles() {
  return JSON.parse(readFileSync(BUNDLES_PATH, 'utf8'));
}

/**
 * Resolve a single bundle by name, following `extends` chains.
 * Parent agents/skills/mcp are prepended; child ones are appended.
 * Duplicates are removed (first occurrence wins).
 *
 * @param {object} bundles  - The full manifest map from loadBundles().
 * @param {string} name     - Bundle name to resolve.
 * @param {Set<string>} [seen] - Cycle-detection set (internal use).
 * @returns {{ agents: string[], skills: string[], mcp: string[], ephemeral: boolean, description: string }}
 */
export function resolveBundle(bundles, name, seen = new Set()) {
  if (!Object.prototype.hasOwnProperty.call(bundles, name)) {
    throw new Error(`Unknown bundle: "${name}"`);
  }
  if (seen.has(name)) {
    throw new Error(`Cycle detected in bundle extends: ${[...seen, name].join(' -> ')}`);
  }

  seen.add(name);
  const def = bundles[name];

  let parentAgents = [];
  let parentSkills = [];
  let parentMcp = [];
  let parentRules = [];

  if (def.extends) {
    const parent = resolveBundle(bundles, def.extends, new Set(seen));
    parentAgents = parent.agents;
    parentSkills = parent.skills;
    parentMcp = parent.mcp;
    parentRules = parent.rules;
  }

  const childAgents = def.agents ?? [];
  const childSkills = def.skills ?? [];
  const childMcp = def.mcp ?? [];
  const childRules = def.rules ?? [];

  const agents = dedupe([...parentAgents, ...childAgents]);
  const skills = dedupe([...parentSkills, ...childSkills]);
  const mcp = dedupe([...parentMcp, ...childMcp]);
  const rules = dedupe([...parentRules, ...childRules]);

  return {
    agents,
    skills,
    mcp,
    rules,
    ephemeral: def.ephemeral === true,
    description: def.description ?? '',
  };
}

/**
 * Apply user-defined overrides to a resolved bundle.
 *
 * @param {{ agents: string[], skills: string[], mcp: string[] }} resolved
 * @param {{ exclude?: { agents?: string[], skills?: string[], mcp?: string[] }, add?: { agents?: string[], skills?: string[], mcp?: string[] } }} [override]
 * @returns {{ agents: string[], skills: string[], mcp: string[] }}
 */
export function applyBundleOverride(resolved, override) {
  if (!override) return resolved;

  const ex = override.exclude ?? {};
  const exAgents = new Set(ex.agents ?? []);
  const exSkills = new Set(ex.skills ?? []);
  const exMcp    = new Set(ex.mcp ?? []);
  const exRules  = new Set(ex.rules ?? []);

  const ad = override.add ?? {};

  return {
    ...resolved,
    agents: dedupe([...resolved.agents.filter(a => !exAgents.has(a)), ...(ad.agents ?? [])]),
    skills: dedupe([...resolved.skills.filter(s => !exSkills.has(s)), ...(ad.skills ?? [])]),
    mcp:    dedupe([...resolved.mcp.filter(m => !exMcp.has(m)),       ...(ad.mcp ?? [])]),
    rules:  dedupe([...(resolved.rules ?? []).filter(r => !exRules.has(r)), ...(ad.rules ?? [])]),
  };
}

/**
 * Resolve multiple bundle names and union all agents/skills/mcp (deduped).
 * `ephemeral` is true if any input bundle is ephemeral.
 *
 * @param {object} bundles     - The full manifest map from loadBundles().
 * @param {string[]} names     - Bundle names to resolve.
 * @param {object} [overrides] - Per-bundle overrides keyed by bundle name.
 * @returns {{ agents: string[], skills: string[], mcp: string[], ephemeral: boolean, description: string }}
 */
export function resolveBundles(bundles, names, overrides = {}) {
  let allAgents = [];
  let allSkills = [];
  let allMcp = [];
  let allRules = [];
  let anyEphemeral = false;

  for (const name of names) {
    let resolved = resolveBundle(bundles, name);
    resolved = applyBundleOverride(resolved, overrides[name]);
    allAgents = [...allAgents, ...resolved.agents];
    allSkills = [...allSkills, ...resolved.skills];
    allMcp = [...allMcp, ...resolved.mcp];
    allRules = [...allRules, ...resolved.rules];
    if (resolved.ephemeral) anyEphemeral = true;
  }

  return {
    agents: dedupe(allAgents),
    skills: dedupe(allSkills),
    mcp: dedupe(allMcp),
    rules: dedupe(allRules),
    ephemeral: anyEphemeral,
    description: '',
  };
}

/** Return array with duplicates removed (first occurrence wins). */
function dedupe(arr) {
  return [...new Set(arr)];
}

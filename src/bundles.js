import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const BUNDLES_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'manifests', 'bundles.json');

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

  if (def.extends) {
    const parent = resolveBundle(bundles, def.extends, new Set(seen));
    parentAgents = parent.agents;
    parentSkills = parent.skills;
    parentMcp = parent.mcp;
  }

  const childAgents = def.agents ?? [];
  const childSkills = def.skills ?? [];
  const childMcp = def.mcp ?? [];

  const agents = dedupe([...parentAgents, ...childAgents]);
  const skills = dedupe([...parentSkills, ...childSkills]);
  const mcp = dedupe([...parentMcp, ...childMcp]);

  return {
    agents,
    skills,
    mcp,
    ephemeral: def.ephemeral === true,
    description: def.description ?? '',
  };
}

/**
 * Resolve multiple bundle names and union all agents/skills/mcp (deduped).
 * `ephemeral` is true if any input bundle is ephemeral.
 *
 * @param {object} bundles  - The full manifest map from loadBundles().
 * @param {string[]} names  - Bundle names to resolve.
 * @returns {{ agents: string[], skills: string[], mcp: string[], ephemeral: boolean, description: string }}
 */
export function resolveBundles(bundles, names) {
  let allAgents = [];
  let allSkills = [];
  let allMcp = [];
  let anyEphemeral = false;

  for (const name of names) {
    const resolved = resolveBundle(bundles, name);
    allAgents = [...allAgents, ...resolved.agents];
    allSkills = [...allSkills, ...resolved.skills];
    allMcp = [...allMcp, ...resolved.mcp];
    if (resolved.ephemeral) anyEphemeral = true;
  }

  return {
    agents: dedupe(allAgents),
    skills: dedupe(allSkills),
    mcp: dedupe(allMcp),
    ephemeral: anyEphemeral,
    description: '',
  };
}

/** Return array with duplicates removed (first occurrence wins). */
function dedupe(arr) {
  return [...new Set(arr)];
}

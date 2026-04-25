import log from '../core/logger.js';
import { loadConfig } from '../core/config.js';
import { writeJsonAtomic } from '../util/json.js';
import { paths } from '../core/paths.js';
import { loadBundles } from '../core/bundles.js';
import { resolveEccRoot } from '../core/ecc-repo.js';
import { scanEcc } from '../core/fs-scan.js';
import { applyCmd } from '../apply/apply-cmd.js';
import { removeLayerCmd } from './remove-layer.js';

const VALID_TYPES = ['skill', 'agent', 'bundle', 'rule', 'command', 'context', 'mcp'];
const GLOBAL_ONLY_TYPES = ['rule', 'command', 'context'];

function printAddUsage() {
  log.info('Usage: ecc-tailor add <type> <name>[,name] [--to global]');
  log.info(`<type> is one of: ${VALID_TYPES.join(', ')}`);
}

/**
 * Parse add/remove CLI args.
 *
 * Recognises:
 *   <type> <name>[,<name>...] [--to|--from <scope>] [--no-apply]
 *
 * @param {string[]} args
 * @param {'to'|'from'} scopeFlag  - which flag to look for ('--to' or '--from')
 * @returns {{ type: string|null, names: string[], scope: string, noApply: boolean }}
 */
function parseArgs(args, scopeFlag) {
  let type = null;
  let names = [];
  let scope = `project:${process.cwd()}`;
  let noApply = false;

  const flag = `--${scopeFlag}`;
  let i = 0;

  // First positional: type
  if (i < args.length && !args[i].startsWith('--')) {
    type = args[i++];
  }

  // Second positional: name(s)
  if (i < args.length && !args[i].startsWith('--')) {
    names = args[i++].split(',').map(n => n.trim()).filter(Boolean);
  }

  // Remaining flags
  while (i < args.length) {
    const arg = args[i++];
    if (arg === flag && i < args.length) {
      scope = args[i++];
    } else if (arg === '--no-apply') {
      noApply = true;
    }
  }

  return { type, names, scope, noApply };
}

/**
 * Parse a scope string into { kind: 'global' } or { kind: 'project', path: string }.
 *
 * @param {string} scope
 * @returns {{ kind: 'global' } | { kind: 'project', path: string }}
 */
function parseScope(scope) {
  if (scope === 'global') return { kind: 'global' };
  if (scope.startsWith('project:')) {
    const p = scope.slice('project:'.length);
    return { kind: 'project', path: p };
  }
  throw new Error(`Invalid scope "${scope}". Use "global" or "project:<absolute-path>".`);
}

/**
 * Map type → extras key.
 */
function extrasKey(type) {
  if (type === 'skill')   return 'skills';
  if (type === 'agent')   return 'agents';
  if (type === 'rule')    return 'rulesLanguages';
  if (type === 'command') return 'commands';
  if (type === 'context') return 'contexts';
  if (type === 'mcp')     return 'mcp';
  return null; // bundle uses bundles[]
}

/**
 * Ensure config.projects contains an entry for `projectPath`.
 * Creates a skeleton entry if missing. Returns a new cfg (immutable) and the entry.
 *
 * @param {object} cfg  Config object (not mutated)
 * @param {string} projectPath
 * @returns {{ cfg: object, entry: object }}
 */
function ensureProject(cfg, projectPath) {
  const existing = (cfg.projects ?? []).find(p => p.path === projectPath);

  // Normalise extras sub-keys to arrays (non-mutating)
  const normaliseExtras = (extras = {}) => ({
    skills:         Array.isArray(extras.skills)         ? extras.skills         : [],
    agents:         Array.isArray(extras.agents)         ? extras.agents         : [],
    rulesLanguages: Array.isArray(extras.rulesLanguages) ? extras.rulesLanguages : [],
    commands:       Array.isArray(extras.commands)       ? extras.commands       : [],
    contexts:       Array.isArray(extras.contexts)       ? extras.contexts       : [],
    mcp:            Array.isArray(extras.mcp)            ? extras.mcp            : [],
    ...extras,
  });

  if (existing) {
    // Return a normalised copy of the entry and a cfg with that copy in place
    const entry = {
      ...existing,
      bundles: Array.isArray(existing.bundles) ? existing.bundles : [],
      extras:  normaliseExtras(existing.extras),
    };
    const newCfg = {
      ...cfg,
      projects: (cfg.projects ?? []).map(p => p.path === projectPath ? entry : p),
    };
    return { cfg: newCfg, entry };
  }

  const entry = {
    path:    projectPath,
    bundles: [],
    extras:  normaliseExtras(),
  };
  const newCfg = { ...cfg, projects: [...(cfg.projects ?? []), entry] };
  return { cfg: newCfg, entry };
}

/**
 * ecc-tailor add <type> <name>[,<name>...] [--to <scope>] [--no-apply]
 */
export async function addCmd(args) {
  const { type, names, scope, noApply } = parseArgs(args, 'to');

  if (!type) {
    printAddUsage();
    process.exitCode = 2;
    return;
  }

  if (!VALID_TYPES.includes(type)) {
    log.err(`Invalid type "${type}". Must be one of: ${VALID_TYPES.join(', ')}`);
    process.exitCode = 2;
    return;
  }

  if (names.length === 0) {
    log.err('No name(s) provided.');
    process.exitCode = 2;
    return;
  }

  let parsedScope;
  try {
    parsedScope = parseScope(scope);
  } catch (err) {
    log.err(err.message);
    process.exitCode = 2;
    return;
  }

  if (GLOBAL_ONLY_TYPES.includes(type) && parsedScope.kind === 'project') {
    log.err(`"${type}" can only be added globally — use: ecc-tailor add ${type} ${names.join(',')} --to global`);
    process.exitCode = 2;
    return;
  }

  // Load config once — reused for both validation and writing
  const cfg = loadConfig();

  // Validate names exist in ECC (for skill/agent/rule) or bundles.json (for bundle)
  if (type === 'bundle') {
    const bundles = loadBundles();
    for (const name of names) {
      if (!Object.prototype.hasOwnProperty.call(bundles, name)) {
        log.err(`Bundle "${name}" not found in bundles.json`);
        process.exitCode = 2;
        return;
      }
    }
  } else {
    // skill / agent / rule / mcp — scan ECC
    let eccRoot;
    try {
      eccRoot = resolveEccRoot(cfg, { clone: false });
    } catch {
      log.err('ECC clone not found — run "ecc-tailor apply" first or set eccPath in config');
      process.exitCode = 2;
      return;
    }

    const inv = scanEcc(eccRoot);
    const typeToInvKey = { skill: 'skills', agent: 'agents', rule: 'rules', command: 'commands', context: 'contexts', mcp: 'mcpServers' };
    const listKey = typeToInvKey[type];

    for (const name of names) {
      const found = inv[listKey].some(item => item.name === name);
      if (!found) {
        log.err(`${type} "${name}" not found in ECC`);
        process.exitCode = 2;
        return;
      }
    }
  }

  // Build updated config immutably
  let updated;

  if (parsedScope.kind === 'global') {
    if (type === 'bundle') {
      const existing = cfg.global.bundles ?? [];
      const newBundles = [...new Set([...existing, ...names])];
      updated = { ...cfg, global: { ...cfg.global, bundles: newBundles } };
    } else {
      const key = extrasKey(type);
      const oldExtras = cfg.global.extras ?? {};
      const oldList = oldExtras[key] ?? [];
      const newExtras = { ...oldExtras, [key]: [...new Set([...oldList, ...names])] };
      updated = { ...cfg, global: { ...cfg.global, extras: newExtras } };
    }
  } else {
    // project scope
    const { cfg: cfgWithProject, entry } = ensureProject(cfg, parsedScope.path);
    if (type === 'bundle') {
      const newBundles = [...new Set([...entry.bundles, ...names])];
      const newEntry = { ...entry, bundles: newBundles };
      updated = {
        ...cfgWithProject,
        projects: cfgWithProject.projects.map(p => p.path === parsedScope.path ? newEntry : p),
      };
    } else {
      const key = extrasKey(type);
      const newList = [...new Set([...(entry.extras[key] ?? []), ...names])];
      const newEntry = { ...entry, extras: { ...entry.extras, [key]: newList } };
      updated = {
        ...cfgWithProject,
        projects: cfgWithProject.projects.map(p => p.path === parsedScope.path ? newEntry : p),
      };
    }
  }

  writeJsonAtomic(paths.configFile(), updated);
  log.ok(`Added ${names.join(', ')} to ${scope}`);

  if (!noApply) {
    await applyCmd([]);
  }
}

/**
 * ecc-tailor remove <type|layer-name> <name>[,<name>...] [--from <scope>] [--no-apply]
 */
export async function removeIncrementalCmd(args) {
  const firstArg = args[0];

  // If first arg is NOT a recognised type → delegate to removeLayerCmd
  if (!firstArg || !VALID_TYPES.includes(firstArg)) {
    return removeLayerCmd(args);
  }

  const { type, names, scope, noApply } = parseArgs(args, 'from');

  if (names.length === 0) {
    log.err('No name(s) provided.');
    process.exitCode = 2;
    return;
  }

  let parsedScope;
  try {
    parsedScope = parseScope(scope);
  } catch (err) {
    log.err(err.message);
    process.exitCode = 2;
    return;
  }

  if (GLOBAL_ONLY_TYPES.includes(type) && parsedScope.kind === 'project') {
    log.err(`"${type}" can only be removed globally — use: ecc-tailor remove ${type} ${names.join(',')} --from global`);
    process.exitCode = 2;
    return;
  }

  const cfg = loadConfig();

  let updated;

  if (parsedScope.kind === 'global') {
    if (type === 'bundle') {
      const newBundles = (cfg.global.bundles ?? []).filter(b => !names.includes(b));
      updated = { ...cfg, global: { ...cfg.global, bundles: newBundles } };
    } else {
      const key = extrasKey(type);
      const oldExtras = cfg.global.extras ?? {};
      const newExtraList = (oldExtras[key] ?? []).filter(n => !names.includes(n));
      const newExtras = { ...oldExtras, [key]: newExtraList };
      updated = { ...cfg, global: { ...cfg.global, extras: newExtras } };
    }
  } else {
    const existingEntry = (cfg.projects ?? []).find(p => p.path === parsedScope.path);
    if (!existingEntry) {
      log.err(`Project "${parsedScope.path}" not found in config`);
      process.exitCode = 2;
      return;
    }
    let newEntry;
    if (type === 'bundle') {
      const newBundles = (existingEntry.bundles ?? []).filter(b => !names.includes(b));
      newEntry = { ...existingEntry, bundles: newBundles };
    } else {
      const key = extrasKey(type);
      const newList = (existingEntry.extras?.[key] ?? []).filter(n => !names.includes(n));
      newEntry = { ...existingEntry, extras: { ...existingEntry.extras, [key]: newList } };
    }
    updated = {
      ...cfg,
      projects: (cfg.projects ?? []).map(p => p.path === parsedScope.path ? newEntry : p),
    };
  }

  writeJsonAtomic(paths.configFile(), updated);
  log.ok(`Removed ${names.join(', ')} from ${scope}`);

  if (!noApply) {
    await applyCmd([]);
  }
}

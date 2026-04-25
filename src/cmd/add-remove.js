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
 * Creates a skeleton entry if missing.
 *
 * @param {object} cfg  Mutable config object
 * @param {string} projectPath
 * @returns {object}  The project entry (mutated in place inside cfg.projects)
 */
function ensureProject(cfg, projectPath) {
  let entry = cfg.projects.find(p => p.path === projectPath);
  if (!entry) {
    entry = { path: projectPath, bundles: [], extras: { agents: [], skills: [], rulesLanguages: [], commands: [], contexts: [] } };
    cfg.projects.push(entry);
  }
  // Ensure extras sub-keys exist
  if (!entry.extras) entry.extras = {};
  if (!Array.isArray(entry.extras.skills))         entry.extras.skills = [];
  if (!Array.isArray(entry.extras.agents))         entry.extras.agents = [];
  if (!Array.isArray(entry.extras.rulesLanguages)) entry.extras.rulesLanguages = [];
  if (!Array.isArray(entry.extras.commands))        entry.extras.commands = [];
  if (!Array.isArray(entry.extras.contexts))        entry.extras.contexts = [];
  if (!Array.isArray(entry.extras.mcp))            entry.extras.mcp = [];
  if (!Array.isArray(entry.bundles))               entry.bundles = [];
  return entry;
}

/**
 * ecc-tailor add <type> <name>[,<name>...] [--to <scope>] [--no-apply]
 */
export async function addCmd(args) {
  const { type, names, scope, noApply } = parseArgs(args, 'to');

  if (!type || !VALID_TYPES.includes(type)) {
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
    const cfg = loadConfig();
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

  // Mutate config
  const cfg = loadConfig();

  if (parsedScope.kind === 'global') {
    if (type === 'bundle') {
      for (const name of names) {
        if (!cfg.global.bundles.includes(name)) {
          cfg.global.bundles.push(name);
        }
      }
    } else {
      const key = extrasKey(type);
      if (!cfg.global.extras[key]) cfg.global.extras[key] = [];
      for (const name of names) {
        if (!cfg.global.extras[key].includes(name)) {
          cfg.global.extras[key].push(name);
        }
      }
    }
  } else {
    // project scope
    const entry = ensureProject(cfg, parsedScope.path);
    if (type === 'bundle') {
      for (const name of names) {
        if (!entry.bundles.includes(name)) {
          entry.bundles.push(name);
        }
      }
    } else {
      const key = extrasKey(type);
      for (const name of names) {
        if (!entry.extras[key].includes(name)) {
          entry.extras[key].push(name);
        }
      }
    }
  }

  writeJsonAtomic(paths.configFile(), cfg);
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

  const cfg = loadConfig();

  if (parsedScope.kind === 'global') {
    if (type === 'bundle') {
      cfg.global.bundles = cfg.global.bundles.filter(b => !names.includes(b));
    } else {
      const key = extrasKey(type);
      if (cfg.global.extras[key]) {
        cfg.global.extras[key] = cfg.global.extras[key].filter(n => !names.includes(n));
      }
    }
  } else {
    const entry = cfg.projects.find(p => p.path === parsedScope.path);
    if (!entry) {
      log.err(`Project "${parsedScope.path}" not found in config`);
      process.exitCode = 2;
      return;
    }
    if (type === 'bundle') {
      if (Array.isArray(entry.bundles)) {
        entry.bundles = entry.bundles.filter(b => !names.includes(b));
      }
    } else {
      const key = extrasKey(type);
      if (entry.extras?.[key]) {
        entry.extras[key] = entry.extras[key].filter(n => !names.includes(n));
      }
    }
  }

  writeJsonAtomic(paths.configFile(), cfg);
  log.ok(`Removed ${names.join(', ')} from ${scope}`);

  if (!noApply) {
    await applyCmd([]);
  }
}

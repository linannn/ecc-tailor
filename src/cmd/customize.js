import log from '../core/logger.js';
import { loadConfig } from '../core/config.js';
import { loadBundles, resolveBundle, applyBundleOverride } from '../core/bundles.js';
import { writeJsonAtomic } from '../util/json.js';
import { paths } from '../core/paths.js';
import { resolveEccRoot } from '../core/ecc-repo.js';
import { scanEcc } from '../core/fs-scan.js';

const VALID_TYPES = ['agents', 'skills', 'mcp', 'rules', 'commands'];
const TYPE_HINT = 'agents (agent), skills (skill), mcp, rules (rule), commands (command)';
const INVENTORY_KEY = { agents: 'agents', skills: 'skills', mcp: 'mcpServers', rules: 'ruleFiles', commands: 'commands' };

function normalizeType(raw) {
  const map = { agent: 'agents', skill: 'skills', rule: 'rules', command: 'commands' };
  return map[raw] ?? raw;
}

function printUsage() {
  log.h1('ecc-tailor customize');
  log.info('');
  log.info('Usage:');
  log.info('  ecc-tailor customize <bundle>');
  log.info('  ecc-tailor customize <bundle> add <type> <name>[,name]');
  log.info('  ecc-tailor customize <bundle> exclude <type> <name>[,name]');
  log.info('  ecc-tailor customize <bundle> include <type> <name>[,name]');
  log.info('  ecc-tailor customize <bundle> reset');
  log.info('');
  log.info(`<type> is one of: ${TYPE_HINT}`);
}

function ensureOverride(cfg, bundleName) {
  const overrides = cfg.bundleOverrides ?? {};
  const existing = overrides[bundleName] ?? {};

  const ov = {
    exclude: {
      agents:   Array.isArray(existing.exclude?.agents)   ? [...existing.exclude.agents]   : [],
      skills:   Array.isArray(existing.exclude?.skills)   ? [...existing.exclude.skills]   : [],
      mcp:      Array.isArray(existing.exclude?.mcp)      ? [...existing.exclude.mcp]      : [],
      rules:    Array.isArray(existing.exclude?.rules)    ? [...existing.exclude.rules]    : [],
      commands: Array.isArray(existing.exclude?.commands) ? [...existing.exclude.commands] : [],
    },
    add: {
      agents: Array.isArray(existing.add?.agents) ? [...existing.add.agents] : [],
      skills: Array.isArray(existing.add?.skills) ? [...existing.add.skills] : [],
      mcp:    Array.isArray(existing.add?.mcp)    ? [...existing.add.mcp]    : [],
    },
  };

  const newCfg = {
    ...cfg,
    bundleOverrides: { ...overrides, [bundleName]: ov },
  };

  return { cfg: newCfg, ov };
}

function cmdShow(bundleName) {
  const cfg = loadConfig();
  const bundles = loadBundles();

  if (!Object.prototype.hasOwnProperty.call(bundles, bundleName)) {
    log.err(`Unknown bundle: "${bundleName}"`);
    process.exit(2);
  }

  const override = cfg.bundleOverrides?.[bundleName];

  log.h1(`Bundle: ${bundleName}`);

  if (override) {
    log.info('');
    log.h1('Override:');
    log.dim(`  exclude.agents   : ${(override.exclude?.agents   ?? []).join(', ') || '(none)'}`);
    log.dim(`  exclude.skills   : ${(override.exclude?.skills   ?? []).join(', ') || '(none)'}`);
    log.dim(`  exclude.mcp      : ${(override.exclude?.mcp      ?? []).join(', ') || '(none)'}`);
    log.dim(`  exclude.rules    : ${(override.exclude?.rules    ?? []).join(', ') || '(none)'}`);
    log.dim(`  exclude.commands : ${(override.exclude?.commands ?? []).join(', ') || '(none)'}`);
    log.dim(`  add.agents       : ${(override.add?.agents       ?? []).join(', ') || '(none)'}`);
    log.dim(`  add.skills       : ${(override.add?.skills       ?? []).join(', ') || '(none)'}`);
    log.dim(`  add.mcp          : ${(override.add?.mcp          ?? []).join(', ') || '(none)'}`);
  } else {
    log.info('');
    log.dim('No override defined for this bundle.');
  }

  const resolved = resolveBundle(bundles, bundleName);
  const final    = applyBundleOverride(resolved, override);

  log.info('');
  log.h1('Resolved:');
  log.info(`  agents : ${final.agents.join(', ') || '(none)'}`);
  log.info(`  skills : ${final.skills.join(', ') || '(none)'}`);
  log.info(`  mcp    : ${final.mcp.join(', ')    || '(none)'}`);
}

async function cmdAdd(bundleName, args) {
  const [rawType, nameArg] = args;
  const type = normalizeType(rawType);

  if (!type || !VALID_TYPES.includes(type)) {
    log.err(`Invalid type "${rawType}". Must be one of: ${TYPE_HINT}`);
    process.exit(2);
  }

  if (!nameArg) {
    log.err('No name(s) provided.');
    process.exit(2);
  }

  const names = nameArg.split(',').map(n => n.trim()).filter(Boolean);
  if (names.length === 0) {
    log.err('No name(s) provided.');
    process.exit(2);
  }

  const bundles = loadBundles();
  if (!Object.prototype.hasOwnProperty.call(bundles, bundleName)) {
    log.err(`Unknown bundle: "${bundleName}"`);
    process.exit(2);
  }

  const cfg = loadConfig();

  try {
    const eccRoot = resolveEccRoot(cfg, { clone: false });
    const inventory = scanEcc(eccRoot);
    const inventoryKey = INVENTORY_KEY[type];
    const known = new Set(inventory[inventoryKey].map(e => e.name));
    for (const name of names) {
      if (!known.has(name)) {
        log.err(`"${name}" not found in ECC inventory (${type})`);
        process.exit(2);
      }
    }
  } catch {
    log.warn('ECC not cloned — skipping name validation');
  }

  const { cfg: updatedCfg, ov } = ensureOverride(cfg, bundleName);

  const newAdd = {
    ...ov.add,
    [type]: [...new Set([...ov.add[type], ...names])],
  };
  const newOv = { ...ov, add: newAdd };
  const finalCfg = {
    ...updatedCfg,
    bundleOverrides: { ...updatedCfg.bundleOverrides, [bundleName]: newOv },
  };

  writeJsonAtomic(paths.configFile(), finalCfg);
  log.ok(`Added ${names.join(', ')} to ${bundleName}.add.${type}`);
}

function cmdExclude(bundleName, args) {
  const [rawType, nameArg] = args;
  const type = normalizeType(rawType);

  if (!type || !VALID_TYPES.includes(type)) {
    log.err(`Invalid type "${rawType}". Must be one of: ${TYPE_HINT}`);
    process.exit(2);
  }

  if (!nameArg) {
    log.err('No name(s) provided.');
    process.exit(2);
  }

  const names = nameArg.split(',').map(n => n.trim()).filter(Boolean);
  if (names.length === 0) {
    log.err('No name(s) provided.');
    process.exit(2);
  }

  const bundles = loadBundles();
  if (!Object.prototype.hasOwnProperty.call(bundles, bundleName)) {
    log.err(`Unknown bundle: "${bundleName}"`);
    process.exit(2);
  }

  const resolved = resolveBundle(bundles, bundleName);
  for (const name of names) {
    if (!(resolved[type] ?? []).includes(name)) {
      log.warn(`"${name}" is not in the resolved bundle "${bundleName}" — the exclusion will have no effect`);
    }
  }

  const cfg = loadConfig();
  const { cfg: updatedCfg, ov } = ensureOverride(cfg, bundleName);

  const newExclude = {
    ...ov.exclude,
    [type]: [...new Set([...ov.exclude[type], ...names])],
  };
  const newOv = { ...ov, exclude: newExclude };
  const finalCfg = {
    ...updatedCfg,
    bundleOverrides: { ...updatedCfg.bundleOverrides, [bundleName]: newOv },
  };

  writeJsonAtomic(paths.configFile(), finalCfg);
  log.ok(`Excluded ${names.join(', ')} from ${bundleName}.${type}`);
}

function cmdInclude(bundleName, args) {
  const [rawType, nameArg] = args;
  const type = normalizeType(rawType);

  if (!type || !VALID_TYPES.includes(type)) {
    log.err(`Invalid type "${rawType}". Must be one of: ${TYPE_HINT}`);
    process.exit(2);
  }

  if (!nameArg) {
    log.err('No name(s) provided.');
    process.exit(2);
  }

  const names = nameArg.split(',').map(n => n.trim()).filter(Boolean);
  if (names.length === 0) {
    log.err('No name(s) provided.');
    process.exit(2);
  }

  const cfg = loadConfig();
  const currentExcludes = cfg.bundleOverrides?.[bundleName]?.exclude?.[type] ?? [];
  const toRemove = new Set(names);
  const missing = names.filter(n => !currentExcludes.includes(n));

  if (missing.length > 0) {
    for (const name of missing) {
      log.warn(`"${name}" is not in ${bundleName}.exclude.${type} — nothing to remove`);
    }
  }

  const newExcludes = currentExcludes.filter(n => !toRemove.has(n));

  if (newExcludes.length === currentExcludes.length) {
    log.dim('No changes.');
    return;
  }

  const { cfg: updatedCfg, ov } = ensureOverride(cfg, bundleName);
  const newOv = { ...ov, exclude: { ...ov.exclude, [type]: newExcludes } };
  const finalCfg = {
    ...updatedCfg,
    bundleOverrides: { ...updatedCfg.bundleOverrides, [bundleName]: newOv },
  };

  writeJsonAtomic(paths.configFile(), finalCfg);
  log.ok(`Included ${names.filter(n => !missing.includes(n)).join(', ')} back into ${bundleName}.${type}`);
}

function cmdReset(bundleName) {
  const cfg = loadConfig();

  if (!cfg.bundleOverrides?.[bundleName]) {
    log.dim(`No override for "${bundleName}" — nothing to reset.`);
    return;
  }

  const { [bundleName]: _, ...restOverrides } = cfg.bundleOverrides;
  const updated = Object.keys(restOverrides).length === 0
    ? (({ bundleOverrides: __, ...rest }) => rest)(cfg)
    : { ...cfg, bundleOverrides: restOverrides };

  writeJsonAtomic(paths.configFile(), updated);
  log.ok(`Reset overrides for bundle "${bundleName}"`);
}

/**
 * ecc-tailor customize <bundle> [add|exclude|reset] [<type> <name>[,name]]
 *
 * @param {string[]} args
 */
export async function customizeCmd(args) {
  const [bundleName, subCmd, ...rest] = args;

  if (!bundleName) {
    log.err('Missing bundle name.');
    log.info('');
    printUsage();
    process.exit(2);
  }

  if (!subCmd || subCmd === 'show') {
    cmdShow(bundleName);
    return;
  }

  switch (subCmd) {
    case 'add':
      await cmdAdd(bundleName, rest);
      break;
    case 'exclude':
      cmdExclude(bundleName, rest);
      break;
    case 'include':
      cmdInclude(bundleName, rest);
      break;
    case 'reset':
      cmdReset(bundleName);
      break;
    default:
      log.err(`Unknown subcommand: "${subCmd}"`);
      log.info('');
      printUsage();
      process.exit(2);
  }
}

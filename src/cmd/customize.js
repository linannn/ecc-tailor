import log from '../core/logger.js';
import { loadConfig } from '../core/config.js';
import { loadBundles, resolveBundle, applyBundleOverride } from '../core/bundles.js';
import { writeJsonAtomic } from '../util/json.js';
import { paths } from '../core/paths.js';

const VALID_TYPES = ['agents', 'skills', 'mcp'];

function printUsage() {
  log.h1('ecc-tailor customize');
  log.info('');
  log.info('Usage:');
  log.info('  ecc-tailor customize <bundle>');
  log.info('  ecc-tailor customize <bundle> add <type> <name>[,name]');
  log.info('  ecc-tailor customize <bundle> exclude <type> <name>[,name]');
  log.info('  ecc-tailor customize <bundle> reset');
  log.info('');
  log.info(`<type> is one of: ${VALID_TYPES.join(', ')}`);
}

function ensureOverride(cfg, bundleName) {
  if (!cfg.bundleOverrides) cfg.bundleOverrides = {};
  if (!cfg.bundleOverrides[bundleName]) {
    cfg.bundleOverrides[bundleName] = {
      exclude: { agents: [], skills: [], mcp: [] },
      add:     { agents: [], skills: [], mcp: [] },
    };
  }
  const ov = cfg.bundleOverrides[bundleName];
  if (!ov.exclude) ov.exclude = { agents: [], skills: [], mcp: [] };
  if (!ov.add)     ov.add     = { agents: [], skills: [], mcp: [] };
  for (const t of VALID_TYPES) {
    if (!Array.isArray(ov.exclude[t])) ov.exclude[t] = [];
    if (!Array.isArray(ov.add[t]))     ov.add[t]     = [];
  }
  return ov;
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
    log.dim(`  exclude.agents : ${(override.exclude?.agents ?? []).join(', ') || '(none)'}`);
    log.dim(`  exclude.skills : ${(override.exclude?.skills ?? []).join(', ') || '(none)'}`);
    log.dim(`  exclude.mcp    : ${(override.exclude?.mcp    ?? []).join(', ') || '(none)'}`);
    log.dim(`  add.agents     : ${(override.add?.agents     ?? []).join(', ') || '(none)'}`);
    log.dim(`  add.skills     : ${(override.add?.skills     ?? []).join(', ') || '(none)'}`);
    log.dim(`  add.mcp        : ${(override.add?.mcp        ?? []).join(', ') || '(none)'}`);
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

function cmdAdd(bundleName, args) {
  const [type, nameArg] = args;

  if (!type || !VALID_TYPES.includes(type)) {
    log.err(`Invalid type "${type}". Must be one of: ${VALID_TYPES.join(', ')}`);
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
  const ov  = ensureOverride(cfg, bundleName);

  for (const name of names) {
    if (!ov.add[type].includes(name)) {
      ov.add[type].push(name);
    }
  }

  writeJsonAtomic(paths.configFile(), cfg);
  log.ok(`Added ${names.join(', ')} to ${bundleName}.add.${type}`);
}

function cmdExclude(bundleName, args) {
  const [type, nameArg] = args;

  if (!type || !VALID_TYPES.includes(type)) {
    log.err(`Invalid type "${type}". Must be one of: ${VALID_TYPES.join(', ')}`);
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
    if (!resolved[type].includes(name)) {
      log.warn(`"${name}" is not in the resolved bundle "${bundleName}" — the exclusion will have no effect`);
    }
  }

  const cfg = loadConfig();
  const ov  = ensureOverride(cfg, bundleName);

  for (const name of names) {
    if (!ov.exclude[type].includes(name)) {
      ov.exclude[type].push(name);
    }
  }

  writeJsonAtomic(paths.configFile(), cfg);
  log.ok(`Excluded ${names.join(', ')} from ${bundleName}.${type}`);
}

function cmdReset(bundleName) {
  const cfg = loadConfig();

  if (!cfg.bundleOverrides?.[bundleName]) {
    log.dim(`No override for "${bundleName}" — nothing to reset.`);
    return;
  }

  delete cfg.bundleOverrides[bundleName];
  if (Object.keys(cfg.bundleOverrides).length === 0) {
    delete cfg.bundleOverrides;
  }

  writeJsonAtomic(paths.configFile(), cfg);
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
      cmdAdd(bundleName, rest);
      break;
    case 'exclude':
      cmdExclude(bundleName, rest);
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

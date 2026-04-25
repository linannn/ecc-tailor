import { loadConfig } from '../core/config.js';
import { paths } from '../core/paths.js';
import { writeJsonAtomic } from '../util/json.js';
import { writeHookWrapper, effectiveDisabled } from './hooks-wrapper.js';
import { resolveEccRoot } from '../core/ecc-repo.js';
import log from '../core/logger.js';

const VALID_PROFILES = ['minimal', 'standard', 'strict'];

/**
 * Regenerate the hook wrapper script from the current config.
 *
 * @param {object} cfg  Full config object (after mutation)
 */
function regenerateWrapper(cfg) {
  const eccRoot = resolveEccRoot(cfg);
  const { profile } = cfg.hooks;
  const disabled = effectiveDisabled(cfg.hooks);
  writeHookWrapper({ eccRoot, profile, disabled });
}

/**
 * Persist the config object to disk.
 *
 * @param {object} cfg
 */
function saveConfig(cfg) {
  writeJsonAtomic(paths.configFile(), cfg);
}

/**
 * Manage hook profile and disabled list.
 *
 * Subcommands:
 *   status
 *   set-profile <minimal|standard|strict>
 *   disable <id>[,<id>...]
 *   enable  <id>[,<id>...]
 *   claude-mem-compat <on|off>
 *
 * @param {string[]} args
 */
export async function hooksCmd(args) {
  const [subcmd, ...rest] = args;

  switch (subcmd) {
    case 'status':
      return cmdStatus();
    case 'set-profile':
      return cmdSetProfile(rest);
    case 'disable':
      return cmdDisable(rest);
    case 'enable':
      return cmdEnable(rest);
    case 'claude-mem-compat':
      return cmdClaudeMemCompat(rest);
    default:
      log.err(`Unknown hooks subcommand: ${subcmd ?? '(none)'}`);
      log.dim('Usage: ecc-tailor hooks <status|set-profile|disable|enable|claude-mem-compat>');
      process.exit(2);
  }
}

function cmdStatus() {
  const cfg = loadConfig();
  const h = cfg.hooks;
  const eff = effectiveDisabled(h);

  log.h1('Hooks status');
  log.info(`  profile:         ${h.profile}`);
  log.info(`  claudeMemCompat: ${h.claudeMemCompat}`);
  log.info(`  disabled:        ${h.disabled.length ? h.disabled.join(', ') : '(none)'}`);
  log.info(`  effective disabled: ${eff.length ? eff.join(', ') : '(none)'}`);
}

function cmdSetProfile(args) {
  const [value] = args;
  if (!value || !VALID_PROFILES.includes(value)) {
    log.err(`Invalid profile: ${JSON.stringify(value ?? '')}. Must be one of: ${VALID_PROFILES.join(', ')}`);
    process.exit(2);
  }

  const cfg = loadConfig();
  cfg.hooks.profile = value;
  saveConfig(cfg);
  regenerateWrapper(cfg);
  log.ok(`hooks.profile set to "${value}" and wrapper regenerated`);
}

function parseIds(args) {
  // Accept comma-separated IDs within each arg, plus multiple args
  return args.flatMap(a => a.split(',').map(s => s.trim()).filter(Boolean));
}

function cmdDisable(args) {
  const ids = parseIds(args);
  if (!ids.length) {
    log.err('No hook IDs provided');
    process.exit(2);
  }

  const cfg = loadConfig();
  const existing = new Set(cfg.hooks.disabled);
  for (const id of ids) existing.add(id);
  cfg.hooks.disabled = [...existing];
  saveConfig(cfg);
  regenerateWrapper(cfg);
  log.ok(`Disabled: ${ids.join(', ')}`);
}

function cmdEnable(args) {
  const ids = parseIds(args);
  if (!ids.length) {
    log.err('No hook IDs provided');
    process.exit(2);
  }

  const cfg = loadConfig();
  const toRemove = new Set(ids);
  cfg.hooks.disabled = cfg.hooks.disabled.filter(id => !toRemove.has(id));
  saveConfig(cfg);
  regenerateWrapper(cfg);
  log.ok(`Enabled (removed from disabled): ${ids.join(', ')}`);
}

function cmdClaudeMemCompat(args) {
  const [value] = args;
  if (value !== 'on' && value !== 'off') {
    log.err(`Invalid value: ${JSON.stringify(value ?? '')}. Must be "on" or "off"`);
    process.exit(2);
  }

  const cfg = loadConfig();
  cfg.hooks.claudeMemCompat = value === 'on';
  saveConfig(cfg);
  regenerateWrapper(cfg);
  log.ok(`hooks.claudeMemCompat set to ${cfg.hooks.claudeMemCompat}`);
}

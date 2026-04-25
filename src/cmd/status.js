import { loadConfig } from '../core/config.js';
import { loadState } from '../core/state.js';
import log from '../core/logger.js';

/**
 * Display the current tailor status: ECC ref, last apply time, symlink counts
 * per layer grouped by kind, and hooks info.
 */
export function statusCmd() {
  const config = loadConfig();
  const state  = loadState();

  // Header info
  log.h1('ecc-tailor status');
  log.info('');
  log.info(`eccRef:     ${state.eccRef    ?? '(none)'}`);
  log.info(`lastApply:  ${state.lastApply ?? '(never)'}`);
  log.info(`forks:      ${Object.keys(state.forks ?? {}).length}`);
  log.info(`ephemeral:  ${Object.keys(state.ephemeralScans ?? {}).length} scans`);
  log.info('');

  // Tally symlinks per layer per kind
  // state.symlinks = { dstAbsPath: { eccSrc, kind, ownedBy, ephemeral } }
  const layers = {}; // { ownedBy: { agent: N, 'skill-dir': N, 'rules-dir': N } }
  for (const entry of Object.values(state.symlinks ?? {})) {
    const owner = entry.ownedBy ?? '(unknown)';
    if (!layers[owner]) {
      layers[owner] = { agent: 0, 'skill-dir': 0, 'rules-dir': 0 };
    }
    const kind = entry.kind;
    if (kind in layers[owner]) {
      layers[owner][kind]++;
    } else {
      layers[owner][kind] = (layers[owner][kind] ?? 0) + 1;
    }
  }

  if (Object.keys(layers).length === 0) {
    log.dim('no symlinks managed (run apply first)');
  } else {
    log.h1('layers:');
    for (const [owner, counts] of Object.entries(layers)) {
      const agents    = counts['agent']     ?? 0;
      const skills    = counts['skill-dir'] ?? 0;
      const ruleDirs  = counts['rules-dir'] ?? 0;
      log.info(
        `  ${owner}: ${agents} agent${agents !== 1 ? 's' : ''}, ` +
        `${skills} skill${skills !== 1 ? 's' : ''}, ` +
        `${ruleDirs} rule dir${ruleDirs !== 1 ? 's' : ''}`,
      );
    }
  }

  log.info('');

  // Hooks info
  const hooks = state.hooks ?? {};
  log.h1('hooks:');
  log.info(`  installed:       ${hooks.installed ? 'yes' : 'no'}`);
  log.info(`  profile:         ${config.hooks?.profile ?? '(default)'}`);
  const compat = config.hooks?.claudeMemCompat;
  log.info(`  claudeMemCompat: ${compat === null ? '(auto — not yet decided)' : compat ? 'yes' : 'no'}`);

  log.info('');

  // MCP info
  const mcp = state.mcp ?? {};
  log.h1('mcp:');
  log.info(`  installed: ${mcp.installed ? 'yes' : 'no'}`);
  log.info(`  servers:   ${(mcp.servers ?? []).length}`);
  if ((mcp.servers ?? []).length > 0) {
    log.dim(`  ${mcp.servers.join(', ')}`);
  }
}

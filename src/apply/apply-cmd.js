import { readFile, copyFile, mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../core/config.js';
import { loadState, saveState } from '../core/state.js';
import { loadBundles } from '../core/bundles.js';
import { resolveEccRoot, getEccRef } from '../core/ecc-repo.js';
import { scanEcc } from '../core/fs-scan.js';
import { resolveDesired, resolveMcp } from '../core/resolve.js';
import { planApply, executeApply } from './apply.js';
import { paths } from '../core/paths.js';
import { readJson, writeJsonAtomic } from '../util/json.js';
import {
  writeHookWrapper, effectiveDisabled,
  rewriteEccHooksJson, filterDisabledHooks, mergeHooksIntoSettings,
} from '../hooks/index.js';
import { mergeMcpServers } from '../mcp/index.js';
import { checkForUpdates } from '../core/upgrade-notify.js';
import { buildProvenance } from './provenance.js';
import log from '../core/logger.js';

/**
 * Detect whether claude-mem is installed by checking:
 * 1. ~/.claude.json mcpServers (legacy / manual MCP config)
 * 2. ~/.claude/plugins/installed_plugins.json (plugin system)
 */
export function detectClaudeMem(claudeJsonPath, pluginsPath) {
  const claudeJson = readJson(claudeJsonPath);
  if (claudeJson?.mcpServers) {
    const found = Object.keys(claudeJson.mcpServers).some(
      key => key.includes('claude-mem') || key.includes('mcp-search'),
    );
    if (found) return true;
  }

  const plugins = readJson(pluginsPath);
  if (plugins?.plugins) {
    return Object.keys(plugins.plugins).some(key => key.includes('claude-mem'));
  }

  return false;
}

/**
 * Resolve claudeMemCompat: if already boolean, return as-is.
 * If null (undecided), auto-detect + optionally prompt.
 * Does NOT persist to config — caller must save after apply succeeds.
 */
async function resolveClaudeMemCompat(config, { dryRun }) {
  const current = config.hooks.claudeMemCompat;
  if (current === true || current === false) return current;

  const detected = detectClaudeMem(paths.claudeJson(), paths.claudePlugins());
  const interactive = !dryRun && process.stdin.isTTY;

  let choice;
  if (!interactive) {
    choice = detected;
    log.dim(`claudeMemCompat: auto-set to ${choice} (claude-mem ${detected ? 'detected' : 'not detected'})`);
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      if (detected) {
        const answer = await new Promise(resolve =>
          rl.question(
            'claude-mem detected → disable 8 overlapping ECC hooks? [Y/n] ',
            resolve,
          ),
        );
        choice = answer.trim().toLowerCase() !== 'n';
      } else {
        const answer = await new Promise(resolve =>
          rl.question(
            'claude-mem not found → use ECC built-in session/memory hooks? [Y/n] ',
            resolve,
          ),
        );
        choice = answer.trim().toLowerCase() === 'n';
      }
    } finally {
      rl.close();
    }
  }

  return choice;
}

/**
 * End-to-end apply flow.
 *
 * @param {string[]} args  - CLI args (may include --dry-run)
 */
export async function applyCmd(args) {
  const dryRun = args.includes('--dry-run');

  // 1. Load config, state
  const config = loadConfig();
  let state    = loadState();

  // 2. Resolve ECC root (clone if needed)
  const eccRoot = resolveEccRoot(config, { clone: true });

  // 3. Load bundles, scan ECC fs
  const bundles = loadBundles();
  const inv     = scanEcc(eccRoot);

  // 4. Resolve desired symlinks
  const home    = process.env.HOME;
  const desired = resolveDesired(config, bundles, inv, { home, eccRoot });

  // 5. Plan
  const plan = await planApply(desired, state, { ecc: eccRoot });

  // 6. If conflicts → print them all, exit code 1, return
  if (plan.conflicts.length > 0) {
    log.err('Conflicts detected — aborting apply:');
    for (const c of plan.conflicts) {
      log.dim(`  conflict: ${c.dst}`);
    }
    process.exit(1);
    return;
  }

  // 7. Print plan summary grouped by scope
  const addCount    = plan.toAdd.length;
  const removeCount = plan.toRemove.length;
  const keepCount   = plan.toKeep.length;

  log.info(`Plan: ${addCount} to add, ${removeCount} to remove, ${keepCount} to keep`);

  const allItems = [
    ...plan.toAdd.map(i => ({ dst: i.dst, ownedBy: i.ownedBy, action: '+' })),
    ...plan.toRemove.map(i => ({ dst: i.dst, ownedBy: i.owned?.ownedBy, action: '-' })),
    ...plan.toKeep.map(i => ({ dst: i.dst, ownedBy: i.ownedBy, action: '=' })),
  ];

  const groups = new Map();
  for (const item of allItems) {
    const scope = item.ownedBy ?? 'global';
    if (!groups.has(scope)) groups.set(scope, []);
    groups.get(scope).push(item);
  }

  let unchangedScopeCount = 0;
  let unchangedItemCount = 0;
  for (const [scope, items] of groups) {
    const hasChanges = items.some(i => i.action !== '=');
    if (!hasChanges) {
      unchangedScopeCount++;
      unchangedItemCount += items.length;
      continue;
    }
    const label = scope === 'global' ? 'global' : scope.replace(/^proj:/, '');
    log.dim(`  [${label}]`);
    for (const item of items) {
      log.dim(`    ${item.action} ${item.dst}`);
    }
  }
  if (unchangedScopeCount > 0) {
    log.dim(`  (${unchangedItemCount} unchanged across ${unchangedScopeCount} other scope${unchangedScopeCount > 1 ? 's' : ''})`);
  }

  // 8. If dry-run → return (don't execute)
  if (dryRun) {
    return;
  }

  // 9. Execute (incremental state flush for crash safety)
  state = await executeApply(plan, state, { ecc: eccRoot, onProgress: saveState });

  // 10. Hook integration (only when hooks.install is enabled)
  let resolvedClaudeMemCompat = config.hooks?.claudeMemCompat ?? null;
  if (config.hooks?.install) {
    const { disabled = [], profile = 'standard' } = config.hooks;

    // 10a. Resolve claudeMemCompat (may prompt on first run)
    const claudeMemCompat = await resolveClaudeMemCompat(config, { dryRun });
    resolvedClaudeMemCompat = claudeMemCompat;

    // 10b. Compute effective disabled list
    const effectiveDisabledList = effectiveDisabled({ claudeMemCompat, disabled });

    // 10b. Write hook wrapper script
    const wrapperPath = writeHookWrapper({ eccRoot, profile, disabled: effectiveDisabledList });

    // 10c. Read ECC's hooks/hooks.json
    const eccHooksJsonRaw = await readFile(join(eccRoot, 'hooks', 'hooks.json'), 'utf8');
    const eccHooksJson = JSON.parse(eccHooksJsonRaw);

    // 10d. Rewrite hooks to use wrapper, then drop disabled entries
    const rewritten = filterDisabledHooks(
      rewriteEccHooksJson(eccHooksJson, wrapperPath, eccRoot),
      effectiveDisabledList,
    );

    // 10e. Merge into settings.json
    const settingsFile = paths.claudeSettings();
    const { backupPath, addedCounts } = await mergeHooksIntoSettings(rewritten, { settingsFile, eccRoot });

    // 10f. Update state
    state = {
      ...state,
      hooks: {
        installed: true,
        settingsBackup: backupPath,
        addedEntries: addedCounts,
        markerId: 'ecc-tailor',
      },
    };

    // 10g. Log
    log.ok(`hooks merged into ${settingsFile} (backup: ${backupPath})`);
    log.dim(`  env.CLAUDE_PLUGIN_ROOT = ${eccRoot}`);
    if (claudeMemCompat && effectiveDisabledList.length > 0) {
      log.dim(`  claude-mem compat: ${effectiveDisabledList.length} hooks disabled (overlap with claude-mem plugin)`);
    } else if (!claudeMemCompat) {
      log.dim('  claude-mem compat: off — all ECC session/memory hooks enabled');
    }
  }

  // 10.5. MCP integration
  let selectedMcp = [];
  if (config.mcp?.install !== false) {
    const mcpCatalog = inv.mcpServers ?? [];
    selectedMcp = resolveMcp(config, bundles, mcpCatalog);

    if (selectedMcp.length > 0) {
      const claudeJsonPath = paths.claudeJson();
      const mcpResult = mergeMcpServers(selectedMcp, { claudeJsonPath });

      state = {
        ...state,
        mcp: {
          installed: true,
          servers: selectedMcp.map(s => s.name),
        },
      };

      if (mcpResult.added.length > 0) {
        log.ok(`MCP: added ${mcpResult.added.join(', ')}`);
      }
      if (mcpResult.removed.length > 0) {
        log.dim(`MCP: removed ${mcpResult.removed.join(', ')}`);
      }

      for (const { server, envVars } of mcpResult.placeholders) {
        log.warn(`MCP "${server}" needs configuration:`);
        for (const [key, val] of envVars) {
          log.dim(`  ${key}=${val}`);
        }
      }
      if (mcpResult.placeholders.length > 0) {
        log.info('Edit ~/.claude.json to set these values.');
      }
    }
  }

  // 10.6. Print dependency provenance
  const provenance = buildProvenance(config, bundles, desired, selectedMcp);

  if (provenance.commands.length > 0 || provenance.mcp.length > 0) {
    log.info('');
    log.h1('Dependencies:');

    if (provenance.commands.length > 0) {
      log.info('  Commands:');
      for (const cmd of provenance.commands) {
        const tag = cmd.auto ? '(auto)' : '(manual)';
        log.dim(`    /${cmd.name}  ← ${cmd.sources.join(', ')} ${tag}`);
      }
    }

    if (provenance.mcp.length > 0) {
      log.info('  MCP servers:');
      for (const mcp of provenance.mcp) {
        log.dim(`    ${mcp.name}  ← ${mcp.sources.join(', ')}`);
      }
    }
  }

  // 11. Install slash command → ~/.claude/commands/ecc-tailor.md
  const templateSrc = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'templates',
    'ecc-tailor-command.md',
  );
  const commandDst = paths.claudeCommand('ecc-tailor');
  await mkdir(dirname(commandDst), { recursive: true });
  await copyFile(templateSrc, commandDst);

  // 12. Update state metadata
  state = { ...state, eccRef: getEccRef(eccRoot), lastApply: new Date().toISOString() };

  // 13. Save state + persist config (claudeMemCompat may have changed from null)
  saveState(state);
  const updatedConfig = {
    ...config,
    hooks: { ...config.hooks, claudeMemCompat: resolvedClaudeMemCompat },
  };
  if (!dryRun) writeJsonAtomic(paths.configFile(), updatedConfig);

  // 13b. Passive upgrade notification (best-effort, non-blocking)
  try { state = await checkForUpdates(eccRoot, state); saveState(state); } catch { /* best-effort */ }

  // 14. Print outcome
  if (addCount === 0 && removeCount === 0 && !config.hooks?.install) {
    log.info('Nothing to do.');
  } else {
    log.ok('apply complete');

    // Print rules notice if any rules-file items were added (dedupe by language)
  }
}

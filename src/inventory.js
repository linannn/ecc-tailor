import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import log from './logger.js';
import { loadConfig } from './config.js';
import { loadState } from './state.js';
import { loadBundles } from './bundles.js';
import { resolveEccRoot } from './ecc-repo.js';
import { scanEcc } from './fs-scan.js';
import { resolveDesired, resolveMcp } from './resolve.js';

const isTTY = process.stdout.isTTY;

const c = {
  reset:  isTTY ? '\x1b[0m'  : '',
  green:  isTTY ? '\x1b[32m' : '',
  yellow: isTTY ? '\x1b[33m' : '',
};

/**
 * Parse inventory command args.
 *
 * Flags:
 *   --type <skill|agent|command|rule>
 *   --filter <regex>
 *   --state <selected|unselected|ignored>
 *   --detail <name>
 *
 * @param {string[]} args
 * @returns {{ type: string|null, filter: string|null, state: string|null, detail: string|null }}
 */
function parseArgs(args) {
  let type = null;
  let filter = null;
  let state = null;
  let detail = null;

  let i = 0;
  while (i < args.length) {
    const arg = args[i++];
    if (arg === '--type' && i < args.length) {
      type = args[i++];
    } else if (arg === '--filter' && i < args.length) {
      filter = args[i++];
    } else if (arg === '--state' && i < args.length) {
      state = args[i++];
    } else if (arg === '--detail' && i < args.length) {
      detail = args[i++];
    }
  }

  return { type, filter, state, detail };
}

/**
 * Render a checkbox indicator with optional color.
 *
 * @param {'selected'|'ignored'|'unselected'} itemState
 * @returns {string}
 */
function renderCheckbox(itemState) {
  if (itemState === 'selected') return `${c.green}[✓]${c.reset}`;
  if (itemState === 'ignored')  return `${c.yellow}[i]${c.reset}`;
  return '[ ]';
}

/**
 * Format a single inventory item line.
 *
 * @param {{ name: string, description: string }} item
 * @param {'selected'|'ignored'|'unselected'} itemState
 * @returns {string}
 */
function formatLine(item, itemState) {
  const checkbox = renderCheckbox(itemState);
  const name = item.name.padEnd(32);
  const desc = (item.description || '').slice(0, 70);
  return `${checkbox} ${name} ${desc}`;
}

/**
 * Determine the selection state of an item by name and type.
 *
 * @param {string} name
 * @param {'skill'|'agent'|'rule'|'command'} itemType
 * @param {Set<string>} selectedSkills
 * @param {Set<string>} selectedAgents
 * @param {Set<string>} ignoredSkills
 * @param {Set<string>} ignoredAgents
 * @returns {'selected'|'ignored'|'unselected'}
 */
function getItemState(name, itemType, selectedSkills, selectedAgents, ignoredSkills, ignoredAgents) {
  if (itemType === 'skill') {
    if (ignoredSkills.has(name))   return 'ignored';
    if (selectedSkills.has(name))  return 'selected';
    return 'unselected';
  }
  if (itemType === 'agent') {
    if (ignoredAgents.has(name))   return 'ignored';
    if (selectedAgents.has(name))  return 'selected';
    return 'unselected';
  }
  // rules/commands don't have selection state
  return 'unselected';
}

/**
 * Print a section of inventory items.
 *
 * @param {string} label   e.g. 'SKILLS'
 * @param {Array<{ name: string, description: string }>} items
 * @param {'skill'|'agent'|'rule'|'command'} itemType
 * @param {Set<string>} selectedSkills
 * @param {Set<string>} selectedAgents
 * @param {Set<string>} ignoredSkills
 * @param {Set<string>} ignoredAgents
 * @param {RegExp|null} filterRe
 * @param {string|null} stateFilter
 */
function printSection(
  label,
  items,
  itemType,
  selectedSkills,
  selectedAgents,
  ignoredSkills,
  ignoredAgents,
  filterRe,
  stateFilter,
) {
  const filtered = items.filter(item => {
    if (filterRe && !filterRe.test(item.name) && !filterRe.test(item.description)) {
      return false;
    }
    if (stateFilter) {
      const s = getItemState(item.name, itemType, selectedSkills, selectedAgents, ignoredSkills, ignoredAgents);
      if (s !== stateFilter) return false;
    }
    return true;
  });

  log.h1(`${label} (${filtered.length})`);
  for (const item of filtered) {
    const s = getItemState(item.name, itemType, selectedSkills, selectedAgents, ignoredSkills, ignoredAgents);
    log.info(formatLine(item, s));
  }
  if (filtered.length > 0) log.info('');
}

/**
 * ecc-tailor inventory [--type <type>] [--filter <regex>] [--state <state>] [--detail <name>]
 *
 * @param {string[]} args
 */
export async function inventoryCmd(args) {
  const { type, filter, state, detail } = parseArgs(args);

  // Load config — uses XDG env vars set in the spawned process
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

  // --detail mode: print full file content for a named item
  if (detail) {
    const skill   = inv.skills.find(s => s.name === detail);
    const agent   = inv.agents.find(a => a.name === detail);
    const rule    = inv.rules.find(r => r.name === detail);
    const command = inv.commands.find(c => c.name === detail);
    const context = (inv.contexts ?? []).find(c => c.name === detail);

    let filePath;
    if (skill) {
      filePath = join(eccRoot, skill.path, 'SKILL.md');
    } else if (agent) {
      filePath = join(eccRoot, agent.path);
    } else if (rule) {
      filePath = join(eccRoot, rule.path);
    } else if (command) {
      filePath = join(eccRoot, command.path);
    } else if (context) {
      filePath = join(eccRoot, context.path);
    } else {
      log.err(`"${detail}" not found in inventory`);
      process.exitCode = 2;
      return;
    }

    let content;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch (err) {
      log.err(`Could not read file: ${err.message}`);
      process.exitCode = 2;
      return;
    }
    process.stdout.write(content);
    return;
  }

  // Normal mode: resolve desired set and load state
  const home = process.env.HOME || homedir();
  const bundles = loadBundles();
  const desired = resolveDesired(cfg, bundles, inv, { home });

  // Build selected sets from desired symlinks
  const selectedSkills = new Set(
    desired
      .filter(e => e.kind === 'skill-dir')
      .map(e => e.eccSrc.replace(/^skills\//, '')),
  );
  const selectedAgents = new Set(
    desired
      .filter(e => e.kind === 'agent')
      .map(e => e.eccSrc.replace(/^agents\//, '').replace(/\.md$/, '')),
  );

  let selectedMcp = new Set();
  try {
    const resolvedMcp = resolveMcp(cfg, bundles, inv.mcpServers ?? []);
    selectedMcp = new Set(resolvedMcp.map(s => s.name));
  } catch {
    // catalog may be empty in degraded state
  }

  // Load ignored lists from state
  const stateData = loadState();
  const ignoredSkills = new Set(stateData.ignored?.skills ?? []);
  const ignoredAgents = new Set(stateData.ignored?.agents ?? []);

  // Build filter regex
  let filterRe = null;
  if (filter) {
    try {
      filterRe = new RegExp(filter, 'i');
    } catch {
      log.err(`Invalid --filter regex: ${filter}`);
      process.exitCode = 2;
      return;
    }
  }

  const showAll = !type;

  if (showAll || type === 'skill') {
    printSection(
      'SKILLS', inv.skills, 'skill',
      selectedSkills, selectedAgents, ignoredSkills, ignoredAgents,
      filterRe, state,
    );
  }

  if (showAll || type === 'agent') {
    printSection(
      'AGENTS', inv.agents, 'agent',
      selectedSkills, selectedAgents, ignoredSkills, ignoredAgents,
      filterRe, state,
    );
  }

  if (showAll || type === 'rule') {
    printSection(
      'RULES', inv.rules, 'rule',
      selectedSkills, selectedAgents, ignoredSkills, ignoredAgents,
      filterRe, state,
    );
  }

  if (showAll || type === 'command') {
    printSection(
      'COMMANDS', inv.commands, 'command',
      selectedSkills, selectedAgents, ignoredSkills, ignoredAgents,
      filterRe, state,
    );
  }

  if (showAll || type === 'context') {
    printSection(
      'CONTEXTS', inv.contexts ?? [], 'context',
      selectedSkills, selectedAgents, ignoredSkills, ignoredAgents,
      filterRe, state,
    );
  }

  if (showAll || type === 'mcp') {
    const mcpItems = (inv.mcpServers ?? []).map(s => ({
      name: s.name,
      description: s.description,
    }));

    const filtered = mcpItems.filter(item => {
      if (filterRe && !filterRe.test(item.name) && !filterRe.test(item.description)) {
        return false;
      }
      if (state) {
        const itemState = selectedMcp.has(item.name) ? 'selected' : 'unselected';
        if (itemState !== state) return false;
      }
      return true;
    });

    log.h1(`MCP SERVERS (${filtered.length})`);
    for (const item of filtered) {
      const checkbox = selectedMcp.has(item.name) ? renderCheckbox('selected') : renderCheckbox('unselected');
      const name = item.name.padEnd(32);
      const desc = (item.description || '').slice(0, 70);
      log.info(`${checkbox} ${name} ${desc}`);
    }
    if (filtered.length > 0) log.info('');
  }
}

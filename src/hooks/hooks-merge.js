import { copyFileSync } from 'node:fs';
import { writeJsonAtomic } from '../util/json.js';
import { readJson } from '../util/json.js';

/**
 * Marker prefix added to every description managed by ecc-tailor.
 * Used for idempotency: any entry whose description starts with this
 * prefix is considered owned by ecc-tailor and may be replaced on
 * subsequent merges.
 */
export const MARKER_PREFIX = '[ecc-tailor] ';

/**
 * Regex to extract <id> <script> <profiles> from the tail of a
 * run-with-flags.js invocation command string.
 */
const RUN_WITH_FLAGS_RE = /run-with-flags\.js\s+(\S+)\s+(\S+)\s+(\S+)\s*$/;

/**
 * Rewrite the parsed ECC hooks/hooks.json object so that every hook
 * command points to our wrapper script instead of run-with-flags.js,
 * and every entry's description is prefixed with MARKER_PREFIX.
 *
 * @param {{ hooks: Record<string, Array<object>> }} eccHooksJson
 *   Parsed ECC hooks.json (shape: { hooks: { PreToolUse: [...], ... } })
 * @param {string} wrapperPath  Absolute path to the ecc-tailor wrapper script.
 * @returns {Record<string, Array<object>>}
 *   Flat map of event → rewritten entries (no outer `hooks` wrapper).
 */
export function rewriteEccHooksJson(eccHooksJson, wrapperPath) {
  const result = {};

  for (const [event, entries] of Object.entries(eccHooksJson.hooks ?? {})) {
    result[event] = entries.map(entry => {
      const rewrittenHooks = (entry.hooks ?? []).map(hook => {
        const m = RUN_WITH_FLAGS_RE.exec(hook.command ?? '');
        if (!m) return { ...hook };
        const [, id, script, profiles] = m;
        return {
          ...hook,
          command: `bash ${wrapperPath} ${id} ${script} ${profiles}`,
        };
      });

      const description = entry.description ?? '';
      const prefixedDescription = description.startsWith(MARKER_PREFIX)
        ? description
        : MARKER_PREFIX + description;

      return {
        ...entry,
        description: prefixedDescription,
        hooks: rewrittenHooks,
      };
    });
  }

  return result;
}

/**
 * Remove entries whose `id` is in the disabled set.
 *
 * @param {Record<string, Array<object>>} rewrittenEvents
 * @param {string[]} disabledIds
 * @returns {Record<string, Array<object>>}
 */
export function filterDisabledHooks(rewrittenEvents, disabledIds) {
  if (!disabledIds || disabledIds.length === 0) return rewrittenEvents;

  const disabled = new Set(disabledIds.map(id => id.toLowerCase()));
  const result = {};

  for (const [event, entries] of Object.entries(rewrittenEvents)) {
    const kept = entries.filter(entry => {
      const id = (entry.id ?? '').toLowerCase();
      return !id || !disabled.has(id);
    });
    if (kept.length > 0) {
      result[event] = kept;
    }
  }

  return result;
}

/**
 * Merge rewritten ECC hook entries into the user's settings.json.
 *
 * Steps:
 *  1. Read existing settings.json (or {} if missing).
 *  2. Back up to settings.json.bak.<ISO-timestamp>.
 *  3. For each event: remove prior ecc-tailor entries, then append new ones.
 *  4. Write back atomically.
 *
 * @param {Record<string, Array<object>>} rewrittenEvents
 *   Output of `rewriteEccHooksJson`.
 * @param {{ settingsFile: string, eccRoot?: string }} opts
 * @returns {{ backupPath: string, addedCounts: Record<string, number> }}
 */
export async function mergeHooksIntoSettings(rewrittenEvents, { settingsFile, eccRoot }) {
  // 1. Read existing settings
  const settings = readJson(settingsFile) ?? {};

  // 2. Backup
  const backupPath = `${settingsFile}.bak.${new Date().toISOString()}`;
  try {
    copyFileSync(settingsFile, backupPath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  // 3. Merge — first strip all prior ecc-tailor entries from every event,
  //    then append new ones. This ensures disabled hooks (removed from
  //    rewrittenEvents) don't linger from a previous apply.
  const hooks = settings.hooks ?? {};
  const addedCounts = {};

  for (const event of Object.keys(hooks)) {
    const entries = hooks[event] ?? [];
    const userOnly = entries.filter(
      e => !(e.description ?? '').startsWith(MARKER_PREFIX),
    );
    if (userOnly.length === 0) {
      delete hooks[event];
    } else {
      hooks[event] = userOnly;
    }
  }

  for (const [event, newEntries] of Object.entries(rewrittenEvents)) {
    const existing = hooks[event] ?? [];
    hooks[event] = [...existing, ...newEntries];
    addedCounts[event] = newEntries.length;
  }

  settings.hooks = hooks;

  // 3b. Set CLAUDE_PLUGIN_ROOT so inline-bootstrap hooks find ECC
  if (eccRoot) {
    const env = settings.env ?? {};
    env.CLAUDE_PLUGIN_ROOT = eccRoot;
    settings.env = env;
  }

  // 4. Write back atomically
  writeJsonAtomic(settingsFile, settings);

  return { backupPath, addedCounts };
}

/**
 * Remove all ecc-tailor-owned hook entries from settings.json.
 * Empty event arrays are deleted entirely.
 * Writes back atomically.
 *
 * @param {{ settingsFile: string }} opts
 * @returns {{ removed: number }}
 */
export async function removeEccTailorHooks({ settingsFile }) {
  const settings = readJson(settingsFile) ?? {};
  const hooks = settings.hooks ?? {};
  let removed = 0;

  for (const [event, entries] of Object.entries(hooks)) {
    const filtered = entries.filter(e => !(e.description ?? '').startsWith(MARKER_PREFIX));
    removed += entries.length - filtered.length;
    if (filtered.length === 0) {
      delete hooks[event];
    } else {
      hooks[event] = filtered;
    }
  }

  if (Object.keys(hooks).length === 0) {
    delete settings.hooks;
  } else {
    settings.hooks = hooks;
  }

  // Clean up CLAUDE_PLUGIN_ROOT env var
  if (settings.env?.CLAUDE_PLUGIN_ROOT) {
    delete settings.env.CLAUDE_PLUGIN_ROOT;
    if (Object.keys(settings.env).length === 0) {
      delete settings.env;
    }
  }

  writeJsonAtomic(settingsFile, settings);

  return { removed };
}

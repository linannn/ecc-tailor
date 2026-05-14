import { writeJsonAtomic } from '../util/json.js';
import { readJson } from '../util/json.js';
import { backupFile } from '../util/backup.js';

/**
 * Marker prefix added to every description managed by ecc-tailor.
 * Used for idempotency: any entry whose description starts with this
 * prefix is considered owned by ecc-tailor and may be replaced on
 * subsequent merges.
 */
export const MARKER_PREFIX = '[ecc-tailor] ';

const ECC_TAILOR_CMD_SIGNATURES = ['ecc-tailor', 'CLAUDE_PLUGIN_ROOT'];

/**
 * Claude Code strips `description` when it rewrites settings.json,
 * so we fall back to matching command content for ownership detection.
 */
export function isOwnedByEccTailor(entry) {
  if ((entry.description ?? '').startsWith(MARKER_PREFIX)) return true;

  return (entry.hooks ?? []).some(hook => {
    const cmd = hook.command ?? '';
    return ECC_TAILOR_CMD_SIGNATURES.some(sig => cmd.includes(sig));
  });
}

/**
 * Regex to extract <id> <script> <profiles> from the tail of a
 * run-with-flags.js invocation command string.
 */
const RUN_WITH_FLAGS_RE = /run-with-flags\.js\s+(\S+)\s+(\S+)\s+(\S+)\s*$/;

/**
 * Matches inline bootstrap node commands that self-resolve CLAUDE_PLUGIN_ROOT
 * at runtime (e.g. pre-bash-dispatcher, post-bash-dispatcher, session hooks).
 * These commands check process.env.CLAUDE_PLUGIN_ROOT first, so prepending
 * the env var makes them resolve correctly when ECC is installed via ecc-tailor
 * rather than as a Claude plugin.
 */
const INLINE_BOOTSTRAP_RE = /^node -e ".+?CLAUDE_PLUGIN_ROOT/;

/**
 * Rewrite the parsed ECC hooks/hooks.json object so that every hook
 * command points to our wrapper script instead of run-with-flags.js,
 * and every entry's description is prefixed with MARKER_PREFIX.
 *
 * @param {{ hooks: Record<string, Array<object>> }} eccHooksJson
 *   Parsed ECC hooks.json (shape: { hooks: { PreToolUse: [...], ... } })
 * @param {string} wrapperPath  Absolute path to the ecc-tailor wrapper script.
 * @param {string} [eccRoot]    Absolute path to the ECC installation root.
 * @returns {Record<string, Array<object>>}
 *   Flat map of event → rewritten entries (no outer `hooks` wrapper).
 */
export function rewriteEccHooksJson(eccHooksJson, wrapperPath, eccRoot) {
  const result = {};

  for (const [event, entries] of Object.entries(eccHooksJson.hooks ?? {})) {
    result[event] = entries.map(entry => {
      const rewrittenHooks = (entry.hooks ?? []).map(hook => {
        const cmd = hook.command ?? '';
        const m = RUN_WITH_FLAGS_RE.exec(cmd);
        if (m) {
          const [, id, script, profiles] = m;
          return {
            ...hook,
            command: `bash ${wrapperPath} ${id} ${script} ${profiles}`,
          };
        }
        if (eccRoot && INLINE_BOOTSTRAP_RE.test(cmd)) {
          return {
            ...hook,
            command: `CLAUDE_PLUGIN_ROOT=${eccRoot} ${cmd}`,
          };
        }
        return { ...hook };
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

  // 2. Backup (rotated — keeps last 3)
  const backupPath = backupFile(settingsFile);

  // 3. Merge — first strip all prior ecc-tailor entries from every event,
  //    then append new ones. This ensures disabled hooks (removed from
  //    rewrittenEvents) don't linger from a previous apply.
  const oldHooks = settings.hooks ?? {};
  const addedCounts = {};

  // Build newHooks immutably: strip ecc-tailor entries from each existing event
  let newHooks = {};
  for (const event of Object.keys(oldHooks)) {
    const entries = oldHooks[event] ?? [];
    const userOnly = entries.filter(e => !isOwnedByEccTailor(e));
    if (userOnly.length > 0) {
      newHooks = { ...newHooks, [event]: userOnly };
    }
  }

  // Append new ecc-tailor entries immutably
  for (const [event, newEntries] of Object.entries(rewrittenEvents)) {
    const existing = newHooks[event] ?? [];
    newHooks = { ...newHooks, [event]: [...existing, ...newEntries] };
    addedCounts[event] = newEntries.length;
  }

  // 3b. Set CLAUDE_PLUGIN_ROOT so inline-bootstrap hooks find ECC
  const oldEnv = settings.env ?? {};
  const newEnv = eccRoot ? { ...oldEnv, CLAUDE_PLUGIN_ROOT: eccRoot } : oldEnv;

  const newSettings = eccRoot
    ? { ...settings, hooks: newHooks, env: newEnv }
    : { ...settings, hooks: newHooks };

  // 4. Write back atomically
  writeJsonAtomic(settingsFile, newSettings);

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
  const oldHooks = settings.hooks ?? {};
  let removed = 0;

  // Build newHooks immutably: strip ecc-tailor entries, omit empty events
  let newHooks = {};
  for (const [event, entries] of Object.entries(oldHooks)) {
    const filtered = entries.filter(e => !isOwnedByEccTailor(e));
    removed += entries.length - filtered.length;
    if (filtered.length > 0) {
      newHooks = { ...newHooks, [event]: filtered };
    }
  }

  // Clean up CLAUDE_PLUGIN_ROOT env var immutably
  let newSettings;
  if (settings.env?.CLAUDE_PLUGIN_ROOT) {
    const { CLAUDE_PLUGIN_ROOT: _, ...restEnv } = settings.env;
    const hasOtherEnv = Object.keys(restEnv).length > 0;
    const hooksUpdate = Object.keys(newHooks).length > 0 ? { hooks: newHooks } : {};
    const envUpdate = hasOtherEnv ? { env: restEnv } : {};
    const { hooks: _h, env: _e, ...restSettings } = settings;
    newSettings = { ...restSettings, ...hooksUpdate, ...envUpdate };
  } else {
    const hooksUpdate = Object.keys(newHooks).length > 0 ? { hooks: newHooks } : {};
    const { hooks: _h, ...restSettings } = settings;
    newSettings = { ...restSettings, ...hooksUpdate };
  }

  writeJsonAtomic(settingsFile, newSettings);

  return { removed };
}

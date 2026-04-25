import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths } from '../core/paths.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Hook IDs that overlap with claude-mem and should be disabled when
 * claudeMemCompat mode is enabled.
 */
export const CLAUDE_MEM_COMPAT_HOOKS = [
  'session:start',
  'stop:session-end',
  'stop:evaluate-session',
  'pre:compact',
  'pre:observe:continuous-learning',
  'post:observe:continuous-learning',
  'session:end:marker',
  'post:session-activity-tracker',
];

/**
 * Return the effective disabled hooks list.
 * If claudeMemCompat is truthy, merges CLAUDE_MEM_COMPAT_HOOKS with the
 * provided disabled array, deduplicating the result.
 *
 * @param {{ claudeMemCompat?: boolean, disabled?: string[] }} opts
 * @returns {string[]}
 */
export function effectiveDisabled({ claudeMemCompat, disabled = [] }) {
  if (!claudeMemCompat) return [...disabled];
  return [...new Set([...CLAUDE_MEM_COMPAT_HOOKS, ...disabled])];
}

/**
 * Generate and write the hook wrapper shell script from the template.
 *
 * @param {{ eccRoot: string, profile: string, disabled: string[] }} params
 * @param {{ wrapperPath?: string }} [opts]
 * @returns {string} The path to the written wrapper script.
 */
export function writeHookWrapper({ eccRoot, profile, disabled }, opts = {}) {
  const tmplPath = join(__dirname, '..', '..', 'templates', 'run-hook.sh.tmpl');
  const tmpl = readFileSync(tmplPath, 'utf8');

  const content = tmpl
    .replace('__ECC_ROOT__', eccRoot)
    .replace('__PROFILE__', profile)
    .replace('__DISABLED__', disabled.join(','));

  const wrapperPath = opts.wrapperPath ?? paths.hookWrapper();
  mkdirSync(dirname(wrapperPath), { recursive: true });
  writeFileSync(wrapperPath, content, 'utf8');
  chmodSync(wrapperPath, 0o755);

  return wrapperPath;
}

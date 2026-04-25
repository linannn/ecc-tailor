import { paths } from './paths.js';
import { readJson } from './util/json.js';

export const DEFAULT_CONFIG = {
  eccPath: null,
  global: {
    bundles: ['global'],
    extras: { agents: [], skills: [], rulesLanguages: [], commands: [], contexts: [], mcp: [] },
    excludes: { agents: [], skills: [], mcp: [] },
  },
  projects: [],
  hooks: { install: true, profile: 'standard', claudeMemCompat: true, disabled: [] },
  mcp: { install: true },
};

const VALID_PROFILES = ['minimal', 'standard', 'strict'];

/**
 * Deep-merge source into target (plain objects only; arrays are replaced).
 * Returns a new object.
 */
function deepMerge(target, source) {
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return source !== undefined ? source : target;
  }
  const result = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (sv !== null && typeof sv === 'object' && !Array.isArray(sv) &&
        tv !== null && typeof tv === 'object' && !Array.isArray(tv)) {
      result[key] = deepMerge(tv, sv);
    } else {
      result[key] = sv;
    }
  }
  return result;
}

/**
 * Validate a config object. Throws a descriptive Error on invalid input.
 *
 * @param {object} cfg
 */
export function validateConfig(cfg) {
  if (!Array.isArray(cfg.global?.bundles)) {
    throw new Error('bundles must be an array');
  }

  if (!Array.isArray(cfg.projects)) {
    throw new Error('projects must be an array');
  }

  for (const project of cfg.projects) {
    if (typeof project.path !== 'string' || !project.path.startsWith('/')) {
      throw new Error(
        `project path must be absolute; got: ${JSON.stringify(project.path)}`,
      );
    }
    if ('bundles' in project && !Array.isArray(project.bundles)) {
      throw new Error(
        `project bundles must be an array; got: ${JSON.stringify(project.bundles)}`,
      );
    }
  }

  const profile = cfg.hooks?.profile;
  if (profile !== undefined && !VALID_PROFILES.includes(profile)) {
    throw new Error(
      `hooks.profile must be one of ${VALID_PROFILES.join('/')}; got: ${JSON.stringify(profile)}`,
    );
  }
}

/**
 * Load and return the config, deep-merged with DEFAULT_CONFIG.
 *
 * @param {{ home?: string }} [opts]
 * @returns {object}
 */
export function loadConfig({ home } = {}) {
  const file = home ? `${home}/config.json` : paths.configFile();
  const raw = readJson(file);
  const cfg = raw ? deepMerge(DEFAULT_CONFIG, raw) : deepMerge({}, DEFAULT_CONFIG);
  validateConfig(cfg);
  return cfg;
}

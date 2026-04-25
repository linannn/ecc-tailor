import { paths } from './paths.js';
import { readJson } from '../util/json.js';

export const DEFAULT_CONFIG = {
  eccPath: null,
  rulesLanguage: 'en',
  global: {
    bundles: ['core'],
    extras: { agents: [], skills: [], rulesLanguages: [], commands: [], contexts: [], mcp: [] },
    excludes: { agents: [], skills: [], mcp: [], commands: [] },
  },
  bundleOverrides: {},
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

  const rl = cfg.rulesLanguage;
  if (rl !== undefined && rl !== 'en' && rl !== 'zh') {
    throw new Error(`rulesLanguage must be "en" or "zh"; got: ${JSON.stringify(rl)}`);
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

  const overrides = cfg.bundleOverrides;
  if (overrides !== undefined && (typeof overrides !== 'object' || Array.isArray(overrides) || overrides === null)) {
    throw new Error('bundleOverrides must be an object');
  }
  if (overrides) {
    for (const [name, ov] of Object.entries(overrides)) {
      if (typeof ov !== 'object' || Array.isArray(ov) || ov === null) {
        throw new Error(`bundleOverrides["${name}"] must be an object with exclude/add`);
      }
      for (const key of ['exclude', 'add']) {
        const sub = ov[key];
        if (sub === undefined) continue;
        if (typeof sub !== 'object' || Array.isArray(sub) || sub === null) {
          throw new Error(`bundleOverrides["${name}"].${key} must be an object`);
        }
        for (const field of ['agents', 'skills', 'mcp']) {
          if (sub[field] !== undefined && !Array.isArray(sub[field])) {
            throw new Error(`bundleOverrides["${name}"].${key}.${field} must be an array`);
          }
        }
      }
    }
  }
}

/**
 * Load and return the config, deep-merged with DEFAULT_CONFIG.
 *
 * @param {{ home?: string }} [opts]
 * @returns {object}
 */
function migrateLegacyBundleName(cfg) {
  const rename = b => b === 'global' ? 'core' : b;
  if (cfg.global?.bundles) {
    cfg.global.bundles = cfg.global.bundles.map(rename);
  }
  for (const proj of (cfg.projects ?? [])) {
    if (proj.bundles) proj.bundles = proj.bundles.map(rename);
  }
  if (cfg.bundleOverrides?.global) {
    cfg.bundleOverrides.core = cfg.bundleOverrides.global;
    delete cfg.bundleOverrides.global;
  }
  return cfg;
}

export function loadConfig({ home } = {}) {
  const file = home ? `${home}/config.json` : paths.configFile();
  const raw = readJson(file);
  const cfg = raw ? deepMerge(DEFAULT_CONFIG, raw) : deepMerge({}, DEFAULT_CONFIG);
  migrateLegacyBundleName(cfg);
  validateConfig(cfg);
  return cfg;
}

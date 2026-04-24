import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Read and parse a JSON file.
 * Returns null if the file does not exist (ENOENT).
 * Throws on any other error.
 *
 * @param {string} file
 * @returns {object|null}
 */
export function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Write obj to file atomically (write tmp → rename).
 * Creates parent directories as needed.
 * Always ends with a newline.
 *
 * @param {string} file
 * @param {object} obj
 */
export function writeJsonAtomic(file, obj) {
  const dir = dirname(file);
  mkdirSync(dir, { recursive: true });

  const tmp = join(dir, `.tmp-${randomBytes(6).toString('hex')}.json`);
  try {
    writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
    renameSync(tmp, file);
  } catch (err) {
    try { writeFileSync(tmp, '', 'utf8'); } catch { /* ignore cleanup error */ }
    throw err;
  }
}

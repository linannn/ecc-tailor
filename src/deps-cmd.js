import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { resolveEccRoot } from './ecc-repo.js';
import { generateDepsDoc } from './deps-doc.js';
import log from './logger.js';

export async function depsCmd(_args) {
  const config = loadConfig();

  let eccRoot;
  try {
    eccRoot = resolveEccRoot(config, { clone: false });
  } catch {
    log.err('ECC clone not found — run "ecc-tailor apply" first or set eccPath in config');
    process.exitCode = 2;
    return;
  }

  const content = generateDepsDoc(eccRoot);

  const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'DEPENDENCIES.md');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content, 'utf8');
  log.ok(`Generated ${outPath}`);
}

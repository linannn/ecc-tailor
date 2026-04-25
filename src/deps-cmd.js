import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { resolveEccRoot } from './ecc-repo.js';
import { generateDepsDoc, generateDepsDocZh } from './deps-doc.js';
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

  const docsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
  mkdirSync(docsDir, { recursive: true });

  const enPath = join(docsDir, 'DEPENDENCIES.md');
  writeFileSync(enPath, generateDepsDoc(eccRoot), 'utf8');

  const zhPath = join(docsDir, 'DEPENDENCIES.zh.md');
  writeFileSync(zhPath, generateDepsDocZh(eccRoot), 'utf8');

  log.ok(`Generated ${enPath}`);
  log.ok(`Generated ${zhPath}`);
}

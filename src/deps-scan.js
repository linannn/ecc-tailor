import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SLASH_CMD_RE = /(?:^|[\s"`'(])\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/g;

/**
 * Scan selected agents/skills for slash command references.
 * Returns a Map of commandName → Set<source> (e.g. "agent:doc-updater").
 *
 * @param {string[]} agentNames
 * @param {string[]} skillNames
 * @param {string} eccRoot
 * @param {Set<string>} knownCommands
 * @returns {Map<string, Set<string>>}
 */
export function scanCommandDeps(agentNames, skillNames, eccRoot, knownCommands) {
  const deps = new Map();

  function scan(filePath, source) {
    let content;
    try { content = readFileSync(filePath, 'utf8'); } catch { return; }
    for (const match of content.matchAll(SLASH_CMD_RE)) {
      const cmd = match[1];
      if (knownCommands.has(cmd)) {
        if (!deps.has(cmd)) deps.set(cmd, new Set());
        deps.get(cmd).add(source);
      }
    }
  }

  for (const name of agentNames) {
    scan(join(eccRoot, 'agents', `${name}.md`), `agent:${name}`);
  }
  for (const name of skillNames) {
    scan(join(eccRoot, 'skills', name, 'SKILL.md'), `skill:${name}`);
  }

  return deps;
}

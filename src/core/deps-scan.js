import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SLASH_CMD_RE = /(?:^|[\s"`'(])\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/g;

function readContent(filePath) {
  try { return readFileSync(filePath, 'utf8'); } catch { return null; }
}

function filePaths(agentNames, skillNames, eccRoot) {
  const entries = [];
  for (const name of agentNames) {
    entries.push({ path: join(eccRoot, 'agents', `${name}.md`), source: `agent:${name}` });
  }
  for (const name of skillNames) {
    entries.push({ path: join(eccRoot, 'skills', name, 'SKILL.md'), source: `skill:${name}` });
  }
  return entries;
}

/**
 * Scan selected agents/skills for slash command references.
 * Returns a Map of commandName → Set<source>.
 *
 * @param {string[]} agentNames
 * @param {string[]} skillNames
 * @param {string} eccRoot
 * @param {Set<string>} knownCommands
 * @returns {Map<string, Set<string>>}
 */
export function scanCommandDeps(agentNames, skillNames, eccRoot, knownCommands) {
  const deps = new Map();
  for (const { path, source } of filePaths(agentNames, skillNames, eccRoot)) {
    const content = readContent(path);
    if (!content) continue;
    for (const match of content.matchAll(SLASH_CMD_RE)) {
      const cmd = match[1];
      if (knownCommands.has(cmd)) {
        if (!deps.has(cmd)) deps.set(cmd, new Set());
        deps.get(cmd).add(source);
      }
    }
  }
  return deps;
}

/**
 * Scan selected agents/skills for MCP server references.
 * Detects two patterns:
 *   1. mcp__SERVERNAME__ (tool call prefix)
 *   2. "SERVERNAME" (JSON config key, quoted name)
 * Returns a Map of serverName → Set<source>.
 *
 * @param {string[]} agentNames
 * @param {string[]} skillNames
 * @param {string} eccRoot
 * @param {Set<string>} knownServers
 * @returns {Map<string, Set<string>>}
 */
export function scanMcpDeps(agentNames, skillNames, eccRoot, knownServers) {
  const deps = new Map();

  const toolPrefixRe = /mcp__([a-z][a-z0-9-]*)__/g;
  const quotedNameRes = [...knownServers].map(name => ({
    name,
    re: new RegExp(`"${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'),
  }));

  for (const { path, source } of filePaths(agentNames, skillNames, eccRoot)) {
    const content = readContent(path);
    if (!content) continue;

    for (const match of content.matchAll(toolPrefixRe)) {
      const serverName = match[1];
      if (knownServers.has(serverName)) {
        if (!deps.has(serverName)) deps.set(serverName, new Set());
        deps.get(serverName).add(source);
      }
    }

    for (const { name, re } of quotedNameRes) {
      if (re.test(content)) {
        if (!deps.has(name)) deps.set(name, new Set());
        deps.get(name).add(source);
      }
    }
  }

  return deps;
}

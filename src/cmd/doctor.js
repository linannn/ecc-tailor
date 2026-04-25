import { readlink, access } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { loadConfig } from '../core/config.js';
import { loadState } from '../core/state.js';
import { resolveEccRoot } from '../core/ecc-repo.js';
import { paths } from '../core/paths.js';
import log from '../core/logger.js';

/**
 * Run health checks and report any problems.
 * Exits with code 1 when problems are found.
 */
export async function doctorCmd() {
  let problems = 0;

  // 1. Load config
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    log.err(`config load failed: ${err.message}`);
    problems++;
    config = null;
  }

  // 2. Load state (state is always readable; missing → empty defaults)
  const state = loadState();

  // 3. Check ECC clone exists
  if (config) {
    try {
      resolveEccRoot(config, { clone: false });
    } catch (err) {
      log.err(`ECC clone not found: ${err.message}`);
      problems++;
    }
  }

  // 4. Check every symlink in state
  for (const [dst, entry] of Object.entries(state.symlinks ?? {})) {
    try {
      const target = await readlink(dst);
      await access(target);
    } catch (err) {
      log.err(`broken symlink: ${dst} → ${entry.eccSrc ?? '?'} (${err.message})`);
      problems++;
    }
  }

  // 5. Check ~/.claude/settings.json readable + parseable (ignore ENOENT)
  const settingsFile = paths.claudeSettings();
  try {
    const raw = readFileSync(settingsFile, 'utf8');
    JSON.parse(raw);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      log.err(`settings.json unreadable or invalid JSON: ${err.message}`);
      problems++;
    }
  }

  // 6. Check MCP state vs ~/.claude.json
  const mcpState = state.mcp ?? {};
  if (mcpState.installed && (mcpState.servers ?? []).length > 0) {
    const claudeJsonPath = paths.claudeJson();
    let claudeJson;
    try {
      const raw = readFileSync(claudeJsonPath, 'utf8');
      claudeJson = JSON.parse(raw);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        log.err(`~/.claude.json unreadable or invalid JSON: ${err.message}`);
        problems++;
      } else {
        log.err('~/.claude.json not found but MCP servers are installed in state');
        problems++;
      }
      claudeJson = null;
    }

    if (claudeJson) {
      const installedMcp = claudeJson.mcpServers ?? {};
      for (const serverName of mcpState.servers) {
        if (!installedMcp[serverName]) {
          log.err(`MCP server "${serverName}" missing from ~/.claude.json`);
          problems++;
        }
      }
    }
  }

  // Report outcome
  if (problems === 0) {
    log.ok('all checks passed');
  } else {
    log.err(`${problems} problem${problems !== 1 ? 's' : ''} found`);
    process.exit(1);
  }
}

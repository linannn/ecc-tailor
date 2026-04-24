import { mkdtempSync, rmSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Creates an isolated HOME/XDG environment rooted in a temp directory.
 *
 * @returns {{
 *   root: string,
 *   home: string,
 *   xdgConfig: string,
 *   xdgState: string,
 *   xdgData: string,
 *   claudeDir: string,
 *   cleanup(): void,
 *   env(): Record<string,string>
 * }}
 */
export function makeTmpEnv() {
  const root = mkdtempSync(join(tmpdir(), 'ecc-tailor-test-'));
  const home      = join(root, 'home');
  const xdgConfig = join(root, 'xdg-config');
  const xdgState  = join(root, 'xdg-state');
  const xdgData   = join(root, 'xdg-data');
  const claudeDir = join(home, '.claude');

  for (const dir of [home, xdgConfig, xdgState, xdgData, claudeDir]) {
    mkdirSync(dir, { recursive: true });
  }

  return {
    root,
    home,
    xdgConfig,
    xdgState,
    xdgData,
    claudeDir,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
    env() {
      return {
        HOME:           home,
        XDG_CONFIG_HOME: xdgConfig,
        XDG_STATE_HOME:  xdgState,
        XDG_DATA_HOME:   xdgData,
      };
    },
  };
}

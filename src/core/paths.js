import { homedir } from 'node:os';
import { join } from 'node:path';

const home = () => process.env.HOME || homedir();

const xdgConfigHome = () =>
  process.env.XDG_CONFIG_HOME || join(home(), '.config');

const xdgStateHome = () =>
  process.env.XDG_STATE_HOME || join(home(), '.local', 'state');

const xdgDataHome = () =>
  process.env.XDG_DATA_HOME || join(home(), '.local', 'share');

export const paths = {
  configDir:    () => join(xdgConfigHome(), 'ecc-tailor'),
  configFile:   () => join(paths.configDir(), 'config.json'),

  stateDir:     () => join(xdgStateHome(), 'ecc-tailor'),
  stateFile:    () => join(paths.stateDir(), 'state.json'),

  dataDir:      () => join(xdgDataHome(), 'ecc-tailor'),
  eccClone:     () => join(paths.dataDir(), 'ecc'),
  hookWrapper:  () => join(paths.dataDir(), 'bin', 'run-hook.sh'),

  claudeDir:    () => join(home(), '.claude'),
  claudeCommand: (name) => join(paths.claudeDir(), 'commands', `${name}.md`),
  claudeSettings: () => join(paths.claudeDir(), 'settings.json'),
  claudeJson:   () => join(home(), '.claude.json'),
};

import { spawnSync } from 'node:child_process';

/**
 * Run a git command synchronously.
 *
 * @param {string[]} args
 * @param {{ cwd?: string, throwOnError?: boolean }} [opts]
 * @returns {{ stdout: string, stderr: string, status: number }}
 */
export function git(args, { cwd, throwOnError = true } = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const status = result.status ?? 1;

  if (throwOnError && status !== 0) {
    const cmd = `git ${args.join(' ')}`;
    throw new Error(`${cmd} exited with ${status}\n${stderr}`.trim());
  }

  return { stdout, stderr, status };
}

/**
 * Return the HEAD SHA of the repository at cwd.
 *
 * @param {string} cwd
 * @returns {string}
 */
export function headSha(cwd) {
  const { stdout } = git(['rev-parse', 'HEAD'], { cwd });
  return stdout.trim();
}

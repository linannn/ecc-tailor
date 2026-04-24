import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Parse the `description:` field from YAML frontmatter.
 *
 * Looks for `---` at the start of the file, finds the closing `---`,
 * then extracts a single-line `description:` value.
 *
 * @param {string} filePath
 * @returns {string}
 */
function parseDescription(filePath) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }

  if (!content.startsWith('---')) return '';

  const end = content.indexOf('\n---', 3);
  if (end === -1) return '';

  const frontmatter = content.slice(3, end);
  for (const line of frontmatter.split('\n')) {
    const m = line.match(/^description:\s*(.+)$/);
    if (m) return m[1].trim();
  }
  return '';
}

/**
 * Read a directory with withFileTypes, returning [] on ENOENT.
 *
 * @param {string} dirPath
 * @returns {import('node:fs').Dirent[]}
 */
function safeDirents(dirPath) {
  try {
    return readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * Scan an ECC checkout directory and return categorised inventory.
 *
 * @param {string} eccRoot  Absolute path to the ECC checkout.
 * @returns {{
 *   agents:   { name: string, path: string, description: string }[],
 *   skills:   { name: string, path: string, description: string }[],
 *   rules:    { name: string, path: string, description: string }[],
 *   commands: { name: string, path: string, description: string }[],
 * }}
 */
export function scanEcc(eccRoot) {
  // agents/*.md
  const agents = safeDirents(join(eccRoot, 'agents'))
    .filter(d => d.isFile() && d.name.endsWith('.md'))
    .map(d => {
      const name = d.name.slice(0, -3); // strip .md
      const path = `agents/${d.name}`;
      const description = parseDescription(join(eccRoot, 'agents', d.name));
      return { name, path, description };
    });

  // skills/*/SKILL.md
  const skills = safeDirents(join(eccRoot, 'skills'))
    .filter(d => d.isDirectory())
    .filter(d => {
      try {
        readFileSync(join(eccRoot, 'skills', d.name, 'SKILL.md'));
        return true;
      } catch {
        return false;
      }
    })
    .map(d => {
      const name = d.name;
      const path = `skills/${d.name}`;
      const description = parseDescription(
        join(eccRoot, 'skills', d.name, 'SKILL.md'),
      );
      return { name, path, description };
    });

  // rules/*/ (directories)
  const rules = safeDirents(join(eccRoot, 'rules'))
    .filter(d => d.isDirectory())
    .map(d => ({
      name: d.name,
      path: `rules/${d.name}`,
      description: '',
    }));

  // commands/*.md
  const commands = safeDirents(join(eccRoot, 'commands'))
    .filter(d => d.isFile() && d.name.endsWith('.md'))
    .map(d => ({
      name: d.name.slice(0, -3),
      path: `commands/${d.name}`,
      description: '',
    }));

  // contexts/*.md
  const contexts = safeDirents(join(eccRoot, 'contexts'))
    .filter(d => d.isFile() && d.name.endsWith('.md'))
    .map(d => ({
      name: d.name.slice(0, -3),
      path: `contexts/${d.name}`,
      description: '',
    }));

  return { agents, skills, rules, commands, contexts };
}

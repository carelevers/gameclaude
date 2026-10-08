// Loads everything in content/: players and boards (JSON) and game modes (JS).
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONTENT_DIR = join(ROOT, 'content');
export const JSON_KINDS = ['players', 'boards'];

async function list(dir) {
  try {
    return (await readdir(dir)).filter((n) => !n.startsWith('.')).sort();
  } catch {
    return [];
  }
}

export async function loadContent(dir = CONTENT_DIR) {
  const result = { players: [], boards: [], modes: [], files: [], parseErrors: [] };
  for (const kind of JSON_KINDS) {
    for (const name of await list(join(dir, kind))) {
      const rel = `content/${kind}/${name}`;
      if (!name.endsWith('.json')) {
        result.parseErrors.push(`${rel}: only .json files belong in content/${kind}/`);
        continue;
      }
      try {
        const data = JSON.parse(await readFile(join(dir, kind, name), 'utf8'));
        result[kind].push(data);
        result.files.push({ kind, name, rel, data });
      } catch (err) {
        result.parseErrors.push(`${rel}: invalid JSON (${err.message})`);
      }
    }
  }
  for (const name of await list(join(dir, 'modes'))) {
    const rel = `content/modes/${name}`;
    if (!name.endsWith('.js')) {
      result.parseErrors.push(`${rel}: only .js files belong in content/modes/`);
      continue;
    }
    const path = join(dir, 'modes', name);
    try {
      const source = await readFile(path, 'utf8');
      const mod = await import(pathToFileURL(path).href);
      result.modes.push(mod.default);
      result.files.push({ kind: 'modes', name, rel, data: mod.default, source });
    } catch (err) {
      result.parseErrors.push(`${rel}: failed to load (${err.message})`);
    }
  }
  return result;
}

// What the browser fetches as content-bundle.json. Modes are loaded by the
// browser as ES modules from content/modes/<id>.js, so only ids go in here.
export function toBundle(loaded) {
  return { players: loaded.players, boards: loaded.boards, modes: loaded.modes.map((m) => m.id) };
}

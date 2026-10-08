import { matchesAny } from './glob.mjs';

// Ownership zones. This is the heart of "the 101st contributor must add more
// than they cost": contribution zones are many small, independent files that
// never conflict; core zones are few, and reviewed by the core team.
export const ZONES = [
  { name: 'players', globs: ['content/players/*.json'], owner: 'community', note: 'one file per player persona' },
  { name: 'boards', globs: ['content/boards/*.json'], owner: 'community', note: 'one file per board' },
  { name: 'modes', globs: ['content/modes/*.js'], owner: 'community', note: 'one file per game mode (code, extra review)' },
  { name: 'tests', globs: ['test/**'], owner: 'community', note: 'tests are always welcome' },
  { name: 'docs', globs: ['docs/**', '*.md'], owner: 'community', note: 'documentation' },
  { name: 'core', globs: ['game/**', 'server/**'], owner: 'core', note: 'engine, UI and server: core team review' },
  { name: 'tooling', globs: ['tools/**', '.github/**', 'package.json', 'tasks/**', '.gitignore', 'Dockerfile', '.dockerignore', 'LICENSE'], owner: 'core', note: 'pipeline and process: core team review' },
];

export function zoneOf(path) {
  return ZONES.find((z) => matchesAny(path, z.globs));
}

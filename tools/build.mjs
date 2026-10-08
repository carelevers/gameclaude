#!/usr/bin/env node
// Usage: node tools/build.mjs [outDir=dist]
// Produces a static build (solo play) for GitHub Pages or any static host.
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadContent, toBundle, ROOT } from './lib/content.mjs';
import { validateContent } from './lib/validate-content.mjs';

const out = join(ROOT, process.argv[2] ?? 'dist');
const loaded = await loadContent();
const { errors } = validateContent(loaded);
if (errors.length) {
  console.error(`Refusing to build: ${errors.length} content error(s). Run npm run validate.`);
  process.exit(1);
}
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(join(ROOT, 'game'), out, { recursive: true });
await cp(join(ROOT, 'content', 'modes'), join(out, 'content', 'modes'), { recursive: true });
await writeFile(join(out, 'content-bundle.json'), JSON.stringify(toBundle(loaded)));
console.log(`Built ${out}: ${loaded.players.length} players, ${loaded.boards.length} boards, ${loaded.modes.length} modes.`);

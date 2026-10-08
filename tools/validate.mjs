#!/usr/bin/env node
// Usage: node tools/validate.mjs
// Checks every file in content/ against the rules in docs/CONTENT.md.
import { loadContent } from './lib/content.mjs';
import { validateContent } from './lib/validate-content.mjs';

const loaded = await loadContent();
const { errors, warnings, playable } = validateContent(loaded);
const counts = `${loaded.players.length} players, ${loaded.boards.length} boards, ${loaded.modes.length} modes (${playable.length} mode/board combinations)`;
for (const w of warnings) console.log(`warning  ${w}`);
for (const e of errors) console.log(`ERROR    ${e}`);
if (errors.length) {
  console.log(`\nContent validation failed: ${errors.length} error(s). ${counts}.`);
  process.exit(1);
}
console.log(`Content OK: ${counts}.`);

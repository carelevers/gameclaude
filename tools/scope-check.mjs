#!/usr/bin/env node
// Usage:
//   node tools/scope-check.mjs [--base origin/main] [--scope "content/players/*.json" ...] [--markdown]
//
// A scope starting with "+" only allows ADDING files ("+content/players/*.json":
// add a new player, but do not touch anyone else's).
// Lists the files changed since --base, groups them by ownership zone and
// fails if a file is outside every known zone, or outside the --scope globs a
// task allowed. The agent worker runs this before it opens a pull request;
// CI runs it on every pull request.
import { execFileSync } from 'node:child_process';
import { ZONES, zoneOf } from './lib/zones.mjs';
import { matchesAny } from './lib/glob.mjs';

const args = process.argv.slice(2);
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'origin/main';
const scope = args.flatMap((a, i) => (args[i - 1] === '--scope' ? [a] : []));
const markdown = args.includes('--markdown');

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
let files;
const added = new Set();
try {
  const mergeBase = git('merge-base', base, 'HEAD');
  const changed = git('diff', '--name-status', '--no-renames', mergeBase).split('\n').filter(Boolean);
  const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean);
  for (const line of changed) {
    const [status, path] = line.split('\t');
    if (status === 'A') added.add(path);
  }
  for (const path of untracked) added.add(path);
  files = [...new Set([...changed.map((l) => l.split('\t')[1]), ...untracked])].sort();
} catch (err) {
  console.error(`scope-check: cannot diff against ${base}: ${err.message}`);
  process.exit(2);
}

const errors = [];
const byZone = new Map();
for (const f of files) {
  const zone = zoneOf(f);
  if (!zone) errors.push(`${f}: not inside any known zone (see tools/lib/zones.mjs)`);
  else byZone.set(zone.name, [...(byZone.get(zone.name) ?? []), f]);
  if (scope.length) {
    const editable = scope.filter((g) => !g.startsWith('+'));
    const addOnly = scope.filter((g) => g.startsWith('+')).map((g) => g.slice(1));
    const ok = matchesAny(f, editable) || (added.has(f) && matchesAny(f, addOnly));
    if (!ok) {
      const why = matchesAny(f, addOnly) ? 'this task may only add new files here, not change existing ones' : `outside this task's scope (${scope.join(', ')})`;
      errors.push(`${f}: ${why}`);
    }
  }
}
const touchesCore = [...byZone.keys()].some((z) => ZONES.find((x) => x.name === z).owner === 'core');

const lines = [];
lines.push(markdown ? '## Scope check' : `Changed files since ${base}: ${files.length}`);
for (const [zone, list] of byZone) {
  const z = ZONES.find((x) => x.name === zone);
  lines.push(markdown ? `- **${zone}** (${z.owner}): ${list.map((f) => `\`${f}\``).join(', ')}` : `  ${zone.padEnd(8)} ${z.owner.padEnd(10)} ${list.join(', ')}`);
}
lines.push(touchesCore ? `${markdown ? '- ' : ''}Touches core zones: needs core-team review.` : `${markdown ? '- ' : ''}Community zones only.`);
for (const e of errors) lines.push(`${markdown ? '- ❌ ' : 'ERROR    '}${e}`);
console.log(lines.join('\n'));
process.exit(errors.length ? 1 : 0);

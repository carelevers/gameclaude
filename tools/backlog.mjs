#!/usr/bin/env node
// Usage:
//   node tools/backlog.mjs --dry-run            print what would be created
//   node tools/backlog.mjs --labels             create/update the task labels
//   node tools/backlog.mjs --create [--ready]   create the issues (skips titles that exist)
//
// The starting backlog: one task per open seat in the 100-player field, plus
// the hand-written tasks in tasks/backlog.json. Every task touches its own
// file, so a hundred volunteers can work at the same time without conflicts.
// --ready marks them task:ready right away (only do this as a maintainer:
// that label is what tells volunteers' agents a task is approved).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadContent } from './lib/content.mjs';
import { gh, ghJson, repoFromGit } from './lib/github.mjs';
import { LABELS } from './lib/tasks.mjs';

const argv = process.argv.slice(2);
const repo = argv.includes('--repo') ? argv[argv.indexOf('--repo') + 1] : null;

const ARCHETYPES = [
  'a retired lighthouse keeper', 'a nervous first-year student', 'a cheerful bus driver', 'a competitive grandmother', 'a former circus knife thrower',
  'a quiet librarian', 'a loud football fan', 'a sleepy night-shift nurse', 'a fisherman from the north coast', 'a chess grandmaster trying something new',
  'a pub owner who never leaves the bar', 'a tulip farmer', 'a teenage prodigy', 'a stand-up comedian', 'a very serious accountant',
  'a pirate (retired)', 'a robot vacuum that gained sentience', 'a ballet dancer', 'a beekeeper', 'a mountain climber who hates heights',
  'a magician who insists it is not magic', 'a cyclist who came by bike from Groningen', 'a jazz drummer', 'a superstitious sailor', 'a kindergarten teacher',
  'a weather presenter', 'a ghost who haunts the pub', 'a cat that learned to throw', 'a baker who smells of fresh bread', 'an astronaut on leave',
  'a gamer who only plays at night', 'a carpenter with a perfect eye', 'a postman who has walked every street', 'a dentist with steady hands', 'a farmer with huge hands',
  'a tired parent of triplets', 'a professional karaoke singer', 'a skater', 'a medieval reenactor', 'a train conductor obsessed with timing',
  'a painter who sees colors differently', 'a marathon runner', 'a goalkeeper', 'a philosopher', 'a street musician',
  'a former boxer', 'a florist', 'a hacker in a hoodie', 'a tour guide who cannot stop explaining', 'a grumpy cook',
  'a mime artist', 'a lifeguard', 'a crossword champion', 'a dog walker with eight dogs', 'a dragon in disguise',
  'a monk on a day off', 'a TV quiz host', 'a scientist measuring every throw', 'a lucky lottery winner', 'a snail racer',
  'a wedding planner', 'a stage actor who overacts', 'a wizard (apprentice)', 'a sumo wrestler', 'a bored royal',
  'a sleepwalker', 'a surfer from Scheveningen', 'a referee who argues with himself', 'a detective', 'an ice skater from Friesland',
  'a viking', 'a delivery rider in a hurry', 'a yoga teacher', 'a tax inspector', 'a zookeeper',
  'a twin who swaps places with their sibling', 'a pigeon fancier', 'a retired pro who still has it', 'a dj', 'a gardener who talks to plants',
  'an inventor of useless machines', 'a dancer from a carnival parade', 'a polar explorer', 'a cheese merchant from Alkmaar', 'a windmill miller',
  'an opera singer', 'a skateboarding grandad', 'a firefighter',
];

// The field should stay a field: mostly club players, a few stars.
const TIERS = [
  { name: 'a star (accuracy 78-90, so nerves must be high enough for the skill budget)', count: 9 },
  { name: 'a strong county player (accuracy 60-77)', count: 24 },
  { name: 'a club regular (accuracy 40-59)', count: 32 },
  { name: 'a beginner (accuracy 15-39)', count: 30 },
];

function form(task) {
  return [
    ['Zone', task.zone],
    ['Size', task.size === 's' ? 'S (about 30 minutes of agent time)' : 'M (about 60 minutes of agent time)'],
    ['Goal', task.goal],
    ['Details', task.details],
    ['Acceptance criteria', task.acceptance],
    ['Scope', task.scope.join('\n')],
    ['Depends on', task.depends ?? ''],
  ]
    .map(([h, v]) => `### ${h}\n\n${v || '_No response_'}`)
    .join('\n\n');
}

const loaded = await loadContent();
const openSeats = Math.max(0, 99 - loaded.players.length);
const tiers = TIERS.flatMap((t) => Array(t.count).fill(t.name));
const players = Array.from({ length: openSeats }, (_, i) => {
  const archetype = ARCHETYPES[i % ARCHETYPES.length];
  const tier = tiers[(i * 37) % tiers.length];
  return {
    title: `Player: ${archetype}`,
    zone: 'players',
    size: 's',
    priority: 2,
    goal: `Design one of the 99 opponents in the field: ${archetype}, playing as ${tier}.`,
    details: [
      'Create ONE new player file in content/players/. Pick a fitting, original name (not a real person) and an id in snake_case; the file name must be <id>.json.',
      'Draw an 8x8 avatar using only palette keys (max 6 colors) and give them a short bio and up to three catchphrases with some personality. Keep it friendly: this is a pub game for everyone.',
      'Skill: accuracy + (100 - nerves) / 2 must stay at or below 120. Look at the existing players first so yours is different from them.',
      'Set "author" to your GitHub handle.',
    ].join('\n\n'),
    acceptance: '- Exactly one new file in content/players/\n- npm test passes\n- The player looks good in the gallery (game/gallery.html)',
    scope: ['+content/players/*.json'],
  };
});

const handWritten = JSON.parse(readFileSync(join(ROOT, 'tasks', 'backlog.json'), 'utf8'));
const tasks = [...handWritten, ...players];

const labelsFor = (t) => [
  `zone:${t.zone === 'docs' ? 'docs' : t.zone}`,
  `size:${t.size}`,
  `priority:${t.priority ?? 2}`,
  ...(argv.includes('--ready') ? [LABELS.ready.name] : []),
];

if (argv.includes('--dry-run') || argv.length === 0) {
  const byZone = {};
  for (const t of tasks) byZone[t.zone] = (byZone[t.zone] ?? 0) + 1;
  console.log(`${tasks.length} tasks: ${Object.entries(byZone).map(([z, n]) => `${n} ${z}`).join(', ')}`);
  for (const t of tasks.slice(0, 5)) console.log(`\n=== ${t.title} [${labelsFor(t).join(', ')}]\n${form(t)}`);
  console.log(`\n... and ${tasks.length - 5} more. Use --create to open them as issues.`);
  process.exit(0);
}

const target = repo ?? repoFromGit();
if (argv.includes('--labels')) {
  for (const l of Object.values(LABELS)) {
    gh(['label', 'create', l.name, '-R', target, '--color', l.color, '--description', l.description, '--force']);
  }
  for (const agent of ['agent:any', 'agent:claude', 'agent:codex']) gh(['label', 'create', agent, '-R', target, '--color', 'ededed', '--force']);
  console.log('labels ready');
}
if (argv.includes('--create')) {
  const existing = new Set(ghJson(['issue', 'list', '-R', target, '--state', 'all', '--limit', '1000', '--json', 'title']).map((i) => i.title));
  let created = 0;
  for (const t of tasks) {
    if (existing.has(t.title)) continue;
    const args = ['issue', 'create', '-R', target, '--title', t.title, '--body', form(t)];
    for (const l of labelsFor(t)) args.push('--label', l);
    console.log(gh(args));
    created++;
  }
  console.log(`created ${created} issue(s)`);
}

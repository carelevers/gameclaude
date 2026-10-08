#!/usr/bin/env node
// Usage: node tools/simulate.mjs [--runs 20] [--seed 1] [--markdown]
// Plays every mode on every board it supports with a full field of 100 bots.
// Fails on crashes, broken standings, non-JSON state or non-determinism.
// Reports balance numbers so reviewers can spot outliers.
import { loadContent } from './lib/content.mjs';
import { Match } from '../game/core/match.js';
import { createBoard } from '../game/core/board.js';
import { buildLineup, FIELD_SIZE } from '../game/core/lineup.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const runs = Number(opt('runs', 20));
const baseSeed = Number(opt('seed', 1));
const markdown = args.includes('--markdown');

const loaded = await loadContent();
const errors = [];
const warnings = [];
const rows = [];
const personaWins = {};
const personaPlaces = {};

function playMatch(mode, boardDef, seed) {
  const size = Math.min(FIELD_SIZE, mode.maxPlayers);
  const players = buildLineup({ personas: loaded.players, size, seed });
  const match = new Match({ mode, boardDef, players, seed });
  while (!match.over) {
    match.resolveRound();
    JSON.parse(JSON.stringify(match.state)); // state must stay plain JSON
  }
  return match;
}

function signature(match) {
  return JSON.stringify([match.round, match.standings().map((s) => [s.player, s.value])]);
}

for (const mode of loaded.modes) {
  for (const boardDef of loaded.boards) {
    let supported;
    try {
      supported = mode.supportsBoard(createBoard(boardDef));
    } catch (err) {
      errors.push(`${mode.id}@${boardDef.id}: crashed during setup: ${err.message}`);
      continue;
    }
    if (!supported) continue;
    const label = `${mode.id}@${boardDef.id}`;
    const rounds = [];
    let winnerAcc = 0;
    let fieldAcc = 0;
    for (let r = 0; r < runs; r++) {
      const seed = baseSeed + r * 7919;
      try {
        const match = playMatch(mode, boardDef, seed);
        const standings = match.standings();
        const ids = new Set(standings.map((s) => s.player));
        if (standings.length !== match.players.length || ids.size !== match.players.length) {
          errors.push(`${label} seed ${seed}: standings must list every player exactly once`);
        }
        if (standings.some((s) => typeof s.value !== 'string' || s.value.length > 40)) errors.push(`${label} seed ${seed}: standing values must be short strings`);
        rounds.push(match.round);
        const win = match.byId.get(standings[0].player).persona;
        winnerAcc += win.accuracy;
        fieldAcc += match.players.reduce((s, p) => s + p.persona.accuracy, 0) / match.players.length;
        if (!win.filler) personaWins[win.id] = (personaWins[win.id] ?? 0) + 1;
        standings.forEach((s, i) => {
          const persona = match.byId.get(s.player).persona;
          if (persona.filler) return;
          (personaPlaces[persona.id] ??= []).push(i + 1);
        });
        if (r === 0 && signature(match) !== signature(playMatch(mode, boardDef, seed))) {
          errors.push(`${label}: non-deterministic (same seed, different result). Use ctx.rng, never Math.random.`);
        }
      } catch (err) {
        errors.push(`${label} seed ${seed}: crashed: ${err.stack.split('\n').slice(0, 3).join(' | ')}`);
      }
    }
    if (rounds.length === 0) continue;
    const avg = rounds.reduce((a, b) => a + b, 0) / rounds.length;
    const capped = rounds.filter((n) => n >= mode.maxRounds).length;
    rows.push({ label, avg, min: Math.min(...rounds), max: Math.max(...rounds), capped, winnerAcc: winnerAcc / rounds.length, fieldAcc: fieldAcc / rounds.length });
    if (capped > rounds.length / 4) warnings.push(`${label}: ${capped}/${rounds.length} matches hit maxRounds (${mode.maxRounds}); the mode may never end`);
    if (winnerAcc / rounds.length <= fieldAcc / rounds.length + 5) warnings.push(`${label}: winners are barely better than the field; skill may not matter in this mode`);
  }
}

const lines = [];
const out = (s = '') => lines.push(s);
const fmt = (n) => n.toFixed(1);
if (markdown) out('## Simulation report\n');
out(markdown ? '| mode@board | rounds avg (min-max) | hit maxRounds | winner accuracy | field accuracy |\n|---|---|---|---|---|' : 'mode@board                       rounds avg (min-max)  capped  winner acc  field acc');
for (const r of rows) {
  out(
    markdown
      ? `| ${r.label} | ${fmt(r.avg)} (${r.min}-${r.max}) | ${r.capped} | ${fmt(r.winnerAcc)} | ${fmt(r.fieldAcc)} |`
      : `${r.label.padEnd(32)} ${`${fmt(r.avg)} (${r.min}-${r.max})`.padEnd(21)} ${String(r.capped).padEnd(7)} ${fmt(r.winnerAcc).padEnd(11)} ${fmt(r.fieldAcc)}`,
  );
}
const avgPlace = Object.entries(personaPlaces)
  .map(([id, places]) => [id, places.reduce((a, b) => a + b, 0) / places.length])
  .sort((a, b) => a[1] - b[1]);
out();
out(`${markdown ? '**Community players by average finish:** ' : 'Community players by average finish: '}${avgPlace.map(([id, p]) => `${id} ${fmt(p)}`).join(', ')}`);
for (const w of warnings) out(`${markdown ? '- ⚠️ ' : 'warning  '}${w}`);
for (const e of errors) out(`${markdown ? '- ❌ ' : 'ERROR    '}${e}`);
console.log(lines.join('\n'));
process.exit(errors.length ? 1 : 0);

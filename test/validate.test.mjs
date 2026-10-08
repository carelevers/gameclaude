import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from '../tools/lib/content.mjs';
import { validateContent } from '../tools/lib/validate-content.mjs';
import { checkModeSource } from '../game/core/modes.js';

const loaded = await loadContent();
const base = loaded.players[0];

function validateWith(player) {
  const f = { kind: 'players', name: `${player.id}.json`, rel: `content/players/${player.id}.json`, data: player };
  return validateContent({ ...loaded, players: [...loaded.players, player], files: [...loaded.files, f] }).errors.join('\n');
}

test('the real content is valid', () => {
  assert.deepEqual(validateContent(loaded).errors, []);
});

test('rejects players that are too good', () => {
  assert.match(validateWith({ ...base, id: 'superman', accuracy: 95, nerves: 0 }), /too good to be true/);
});

test('rejects off-palette avatars and unknown fields', () => {
  const avatar = [...base.avatar];
  avatar[0] = 'XXXXXXXX';
  assert.match(validateWith({ ...base, id: 'bad_art', avatar }), /not .*palette|allowed:/);
  assert.match(validateWith({ ...base, id: 'extra_field', power: 9000 }), /unknown field "power"/);
});

test('rejects duplicate ids and file name mismatches', () => {
  assert.match(validateWith({ ...base }), /already used/);
});

test('mode sources may not use Math.random or the clock', () => {
  assert.equal(checkModeSource('const x = rng.next();', 'm').length, 0);
  assert.match(checkModeSource('const x = Math.random();', 'm').join(), /ctx.rng/);
  assert.match(checkModeSource('const t = Date.now();', 'm').join(), /clock/);
  assert.match(checkModeSource("import fs from 'node:fs';", 'm').join(), /self-contained/);
});
